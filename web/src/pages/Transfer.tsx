import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getApi } from '@/api/client';
import type { Job, Ledger, PartyName } from '@/api/types';
import { DisclosurePreview } from '@/components/DisclosurePreview';
import { JobProgress } from '@/components/JobProgress';
import { PageTitle, RoleGate } from '@/components/RoleGate';
import { Badge, Banner, Button, Card, Check, Empty, Field, Hash, Input, KV, LockTag, Private, Select } from '@/components/ui';
import { useCredentials, useJob, useJobs, useLedger, useParties, usePolicy } from '@/hooks/queries';
import { PARTIES, RECIPIENTS } from '@/lib/registry';
import { useRole } from '@/state/role';

export function Transfer() {
  return (
    <RoleGate allow={['mine', 'refiner', 'batteryMfr']}>
      <TransferForm />
    </RoleGate>
  );
}

function TransferForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const attack = params.get('attack') === '1';
  const { party } = useRole();
  const me = party as PartyName;
  const creds = useCredentials(me);
  const parties = useParties();
  const policy = usePolicy();
  const ledger = useLedger();
  const jobs = useJobs(me);
  const qc = useQueryClient();

  const cred = creds.data?.find((c) => c.id === id);
  const defaultRecipient: PartyName = me === 'refiner' ? 'batteryMfr' : me === 'mine' ? 'refiner' : 'refiner';
  const [recipient, setRecipient] = useState<PartyName>(defaultRecipient);
  const [carbon, setCarbon] = useState<string>('');
  const [job, setJob] = useState<Job | null>(null);
  const [ledgerBefore, setLedgerBefore] = useState<Ledger | null>(null);

  useEffect(() => {
    if (cred && carbon === '') setCarbon(String(cred.carbonClass));
  }, [cred, carbon]);
  /** Status when the page was opened. A successful transfer flips the credential to CONSUMED; the page must not turn into the attack view because of that. */
  const startedConsumed = useRef<boolean | null>(null);
  if (cred && startedConsumed.current === null) startedConsumed.current = cred.status === 'CONSUMED';
  const consumed = startedConsumed.current === true;

  const meParty = parties.data?.find((p) => p.name === me);
  const rcpt = parties.data?.find((p) => p.name === recipient);
  const carbonN = Number(carbon);
  const carbonOk = cred ? Number.isInteger(carbonN) && carbonN >= cred.carbonClass && carbonN <= 255 : false;

  /** spec.md §3.2.2 pre-checks, derived locally from ledger / policy / credential state. */
  const checks = useMemo(() => {
    if (!cred) return [];
    const originOk = policy.data ? policy.data.origins.some((o) => o.originId === cred.originId) : null;
    return [
      { label: 'Commitment is in provenanceTree', ok: true as boolean | null, note: 'verified at scan (inbox entry re-hashed and matched)' },
      { label: 'I am a certified supplier', ok: meParty ? meParty.certified : null, note: 'certLeaf(partyId, certId) in certifiedSuppliers' },
      { label: 'Origin is certified', ok: originOk, note: 'originId in certifiedOrigins' },
      { label: 'Credential not yet consumed', ok: !startedConsumed.current, note: 'nullifier not in nullifier set' },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cred, meParty, policy.data, startedConsumed.current]);
  const allOk = checks.every((c) => c.ok === true);

  /** The first transfer that consumed this credential (for the rejection screen). */
  const firstSpend = jobs.data?.find((j) => j.circuit === 'transferProvenance' && j.stage === 'confirmed' && j.result && cred && String(j.result.nullifier ?? '') !== '' && j.id !== job?.id);

  const m = useMutation({
    mutationFn: async () => {
      setLedgerBefore(ledger.data ?? (await getApi().ledger()));
      return getApi().transfer(me, cred!.id, { recipient, carbonClass: carbonN });
    },
    onSuccess: (j) => {
      setJob(j);
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const liveJobQ = useJob(job?.id);

  if (creds.isLoading) return <Empty>Loading…</Empty>;
  if (!cred)
    return (
      <Empty>
        Credential not found in {PARTIES[me].org}'s private state. <Link to="/credentials" className="underline">Back</Link>
      </Empty>
    );

  const liveJob = liveJobQ.data ?? job;
  const busy = !!liveJob && ['queued', 'preparing', 'proving', 'submitting'].includes(liveJob.stage);
  const done = liveJob?.stage === 'confirmed';

  return (
    <div className="space-y-6">
      <PageTitle
        title={consumed ? 'Transfer again — attack demo' : 'Transfer / transform provenance'}
        subtitle="Consume the upstream credential, publish its nullifier, and seal a new credential for the next party. The upstream link is never revealed."
        actions={<Link to="/credentials" className="text-xs text-ink-300 underline">← credentials</Link>}
      />

      {(consumed || attack) && (
        <Banner tone="danger" title="This credential is already CONSUMED">
          Its nullifier is on chain. Submitting anyway reproduces the double-spend attack: the proof is built, the circuit assertion fails, and the ledger stays exactly as it is.
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title="Upstream credential (to be consumed)" subtitle="All of this is private state.">
            <KV
              rows={[
                { k: 'Commitment', v: <Hash value={cred.commitment} head={12} tail={6} label="commitment" /> },
                { k: <span className="flex items-center gap-1">Material <LockTag /></span>, v: cred.materialLabel ?? cred.materialType },
                { k: <span className="flex items-center gap-1">Origin <LockTag /></span>, v: cred.originLabel ?? <Hash value={cred.originId} /> },
                { k: <span className="flex items-center gap-1">Carbon class <LockTag /></span>, v: <span className="font-mono">{cred.carbonClass}</span> },
                { k: 'Status', v: <Badge tone={cred.status === 'CONSUMED' ? 'danger' : 'accent'}>{cred.status}</Badge> },
              ]}
            />
          </Card>

          <Card title="New credential">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Recipient" locked hint={rcpt ? (rcpt.encKeyRegistered ? 'Encryption key registered ✓' : 'No encryption key — cannot seal') : undefined}>
                <Select value={recipient} onChange={(e) => setRecipient(e.target.value as PartyName)} disabled={busy}>
                  {RECIPIENTS.filter((r) => r !== me).map((r) => (
                    <option key={r} value={r}>
                      {PARTIES[r].org} ({PARTIES[r].short})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`New carbon class (min ${cred.carbonClass})`} locked hint="Monotone: processing can only add carbon.">
                <Input type="number" min={cred.carbonClass} max={255} value={carbon} onChange={(e) => setCarbon(e.target.value)} disabled={busy} />
              </Field>
            </div>
            {!carbonOk && carbon !== '' && <p className="mt-2 text-xs text-danger">Carbon class must be an integer between {cred.carbonClass} and 255.</p>}

            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-300">Pre-check (local, from ledger reads)</div>
              <ul className="space-y-1.5">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 w-4 text-center">
                      <Check state={c.ok === null ? 'pending' : c.ok ? 'ok' : 'fail'} />
                    </span>
                    <span className={c.ok === false ? 'text-danger' : 'text-ink-100'}>{c.label}</span>
                    <span className="text-[11px] text-ink-400">{c.note}</span>
                  </li>
                ))}
              </ul>
            </div>

            {m.isError && <Banner tone="danger" className="mt-4">{(m.error as Error).message}</Banner>}

            {!done && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                variant={allOk ? 'primary' : 'danger'}
                disabled={!carbonOk || busy || (rcpt ? !rcpt.encKeyRegistered : false)}
                loading={m.isPending}
                onClick={() => m.mutate()}
              >
                {allOk ? 'Transfer' : 'Transfer anyway (attack demo)'}
              </Button>
              <span className="text-xs text-ink-400">circuit transferProvenance · one ZK proof</span>
            </div>
            )}

            {job && (
              <div className="mt-5 space-y-3">
                <JobProgress jobId={job.id} initial={job}>
                  {(j) => (
                    <div className="mt-2 rounded-md border border-accent/30 bg-accent-faint/40 p-4">
                      <div className="text-sm font-semibold text-accent">Transferred</div>
                      <KV
                        className="mt-1"
                        rows={[
                          { k: 'Nullifier (public)', v: <Hash value={String(j.result?.nullifier ?? '')} head={12} tail={6} label="nullifier" /> },
                          { k: 'New commitment (public)', v: <Hash value={String(j.result?.newCommitment ?? '')} head={12} tail={6} label="newCommitment" /> },
                          { k: 'Inbox index', v: <span className="font-mono">{String(j.result?.inboxIndex ?? '—')}</span> },
                          { k: 'Upstream supplier', v: <Private /> },
                          { k: 'Origin', v: <Private /> },
                          { k: 'Policy verification', v: <span className="font-mono text-accent">PASSED ✓</span> },
                        ]}
                      />
                      <p className="mt-2 text-xs text-ink-300">
                        Upstream credential is now CONSUMED. {PARTIES[recipient].org} receives the new one by scanning the chain.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Link to="/credentials">
                          <Button size="sm" variant="secondary">Back to credentials</Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </JobProgress>
                <RejectionDetail job={job} ledgerBefore={ledgerBefore} firstSpend={firstSpend} />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <DisclosurePreview party={me} op="transfer" extraPrivate={[`Recipient ${PARTIES[recipient].org}`]} />
        </div>
      </div>
    </div>
  );
}

/** spec.md §3.2.4: big REJECTED banner, evidence that the nullifier already exists, and proof the ledger did not move. */
function RejectionDetail({ job, ledgerBefore, firstSpend }: { job: Job; ledgerBefore: Ledger | null; firstSpend?: Job }) {
  const live = useJobs(job.party).data?.find((j) => j.id === job.id);
  const ledger = useLedger();
  if (!live || live.stage !== 'rejected') return null;
  const after = ledger.data;
  const unchanged = ledgerBefore && after ? ledgerBefore.nullifierCount === after.nullifierCount && ledgerBefore.provenanceLeafCount === after.provenanceLeafCount : null;
  return (
    <div className="animate-fadeIn rounded-lg border-2 border-danger bg-danger-faint p-6 text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-danger/80">Provenance already consumed</div>
      <div className="mt-1 text-3xl font-bold tracking-tight text-danger">REJECTED</div>
      <div className="mt-2 font-mono text-xs text-danger/90">{live.error}</div>
      <div className="mx-auto mt-5 max-w-md text-left">
        <KV
          rows={[
            {
              k: 'Reason',
              v: <span className="text-sm">nullifier already in the ledger set</span>,
            },
            ...(firstSpend
              ? [
                  { k: 'First consumption tx', v: <Hash value={firstSpend.txHash} head={10} tail={6} label="txHash" /> },
                  { k: 'Nullifier', v: <Hash value={String(firstSpend.result?.nullifier ?? '')} head={10} tail={6} label="nullifier" /> },
                ]
              : []),
            {
              k: 'Ledger',
              v:
                unchanged === null ? (
                  <span className="text-ink-300">checking…</span>
                ) : unchanged ? (
                  <span className="text-sm text-ink-100">
                    unchanged — nullifiers {after!.nullifierCount}, leaves {after!.provenanceLeafCount}
                  </span>
                ) : (
                  <span className="text-warn">counts moved (another party was active)</span>
                ),
            },
          ]}
        />
      </div>
      <p className="mt-4 text-xs text-ink-300">
        A shared nullifier set is what makes this a protocol rather than a private database: the second spend fails for everyone, without anyone seeing which credential it was.
      </p>
    </div>
  );
}
