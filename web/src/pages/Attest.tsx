import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getApi } from '@/api/client';
import type { Job, PartyName, Profile } from '@/api/types';
import { DisclosurePreview } from '@/components/DisclosurePreview';
import { JobProgress } from '@/components/JobProgress';
import { PageTitle, RoleGate } from '@/components/RoleGate';
import { Badge, Banner, Button, Card, Check, Empty, Field, Hash, Input, KV, LockTag } from '@/components/ui';
import { useCredentials, useLedger, useParties, usePolicy } from '@/hooks/queries';
import { cx } from '@/lib/format';
import { PARTIES, PROFILES, predicatesFor } from '@/lib/registry';
import { useRole } from '@/state/role';

export function Attest() {
  return (
    <RoleGate allow={['mine', 'refiner', 'batteryMfr']}>
      <AttestForm />
    </RoleGate>
  );
}

function AttestForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { party } = useRole();
  const me = party as PartyName;
  const creds = useCredentials(me);
  const parties = useParties();
  const policy = usePolicy();
  const ledger = useLedger();
  const qc = useQueryClient();

  const cred = creds.data?.find((c) => c.id === id);
  const [challenge, setChallenge] = useState(params.get('challenge') ?? '');
  const [profile, setProfile] = useState<Profile>((params.get('profile') as Profile) || 'procurement');
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => {
    const c = params.get('challenge');
    if (c) setChallenge(c);
    const p = params.get('profile') as Profile | null;
    if (p && PROFILES.some((x) => x.id === p)) setProfile(p);
  }, [params]);

  const meParty = parties.data?.find((p) => p.name === me);
  const challengeOk = /^[0-9a-f]{64}$/i.test(challenge.trim());
  const threshold = policy.data?.carbonThreshold ?? ledger.data?.carbonThreshold;

  /** Local pre-evaluation of each predicate (FR-V-08). */
  const rows = useMemo(() => {
    if (!cred) return [];
    const originOk = policy.data ? policy.data.origins.some((o) => o.originId === cred.originId) : null;
    const certOk = meParty ? meParty.certified : null;
    const carbonOk = threshold == null ? null : cred.carbonClass <= threshold;
    const notConsumed = cred.status === 'ACTIVE';
    const byKey: Record<string, { ok: boolean | null; detail: string }> = {
      responsibleSourcing: { ok: originOk, detail: 'origin is in the certified allow-list' },
      chainOfCustody: { ok: true, detail: 'commitment proven in provenanceTree with my ownerSecret' },
      supplierCertification: { ok: certOk, detail: 'my certLeaf is in certifiedSuppliers' },
      carbonThreshold: { ok: carbonOk, detail: `carbonClass ≤ ${threshold ?? '…'} — only the inequality is proven` },
      restrictedSource: { ok: originOk, detail: 'implied by allow-list membership' },
      duplicateClaim: { ok: notConsumed, detail: 'nullifier not in set (Regulator reveals the nullifier)' },
    };
    return predicatesFor(profile).map((p) => ({ ...p, ...byKey[p.key] }));
  }, [cred, profile, meParty, policy.data, threshold]);
  const expectedFail = rows.some((r) => r.ok === false);

  const m = useMutation({
    mutationFn: () => getApi().attest(me, cred!.id, { profile, challenge: challenge.trim().toLowerCase() }),
    onSuccess: (j) => {
      setJob(j);
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  if (creds.isLoading) return <Empty>Loading…</Empty>;
  if (!cred)
    return (
      <Empty>
        Credential not found. <Link to="/credentials" className="underline">Back</Link>
      </Empty>
    );
  const busy = !!job && ['queued', 'preparing', 'proving', 'submitting'].includes(job.stage);
  const resultUrl = `/verify/${challenge.trim().toLowerCase()}?holder=${me}&profile=${profile}`;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Prove policy"
        subtitle="Answer a verifier's challenge with a zero-knowledge attestation. They learn that the predicates hold — and nothing else."
        actions={<Link to="/credentials" className="text-xs text-ink-300 underline">← credentials</Link>}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title="Credential" subtitle="Private state — used as witness, never disclosed.">
            <KV
              rows={[
                { k: 'Commitment', v: <Hash value={cred.commitment} head={12} tail={6} label="commitment" /> },
                { k: <span className="flex items-center gap-1">Material <LockTag /></span>, v: cred.materialLabel ?? cred.materialType },
                { k: <span className="flex items-center gap-1">Origin <LockTag /></span>, v: cred.originLabel ?? <Hash value={cred.originId} /> },
                { k: <span className="flex items-center gap-1">Carbon class <LockTag /></span>, v: <span className="font-mono">{cred.carbonClass}</span> },
                { k: 'Status', v: <Badge tone={cred.status === 'ACTIVE' ? 'accent' : 'danger'}>{cred.status}</Badge> },
              ]}
            />
          </Card>

          <Card title="Challenge and profile">
            <Field label="Challenge (32-byte hex from the verifier)" hint="Paste it, or open the verifier's share link and it is filled in.">
              <Input mono value={challenge} onChange={(e) => setChallenge(e.target.value)} placeholder="64 hex characters" disabled={busy} />
            </Field>
            {challenge && !challengeOk && <p className="mt-1 text-xs text-danger">Challenge must be exactly 64 hex characters.</p>}

            <div className="mt-4 mb-1.5 text-xs font-medium text-ink-300">Profile</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PROFILES.map((p) => (
                <button
                  key={p.id}
                  disabled={busy}
                  onClick={() => setProfile(p.id)}
                  className={cx(
                    'rounded-md border p-3 text-left transition-colors',
                    profile === p.id ? 'border-accent bg-accent-faint' : 'border-ink-700 hover:border-ink-500',
                  )}
                >
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="mt-0.5 text-[11px] text-ink-400">{p.circuit}</div>
                </button>
              ))}
            </div>

            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-300">Predicates this proof covers · local pre-check</div>
              <ul className="space-y-1.5">
                {rows.map((r) => (
                  <li key={r.key} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 w-4 text-center">
                      <Check state={r.ok === null ? 'pending' : r.ok ? 'ok' : 'fail'} />
                    </span>
                    <span className={r.ok === false ? 'text-danger' : ''}>
                      {r.label}
                      {r.polarity === 'negative' && <span className="text-ink-400"> (must be absent)</span>}
                    </span>
                    <span className="text-[11px] text-ink-400">{r.detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            {profile === 'regulator' && (
              <Banner tone="warn" className="mt-4" title="Linkability warning">
                The Regulator profile publishes this credential's nullifier. Any later transfer of the same credential becomes linkable to this attestation.
              </Banner>
            )}
            {expectedFail && (
              <Banner tone="warn" className="mt-4" title="A predicate is expected to fail">
                The contract will reject this attestation. You can still submit to demonstrate the rejection.
              </Banner>
            )}
            {m.isError && <Banner tone="danger" className="mt-4">{(m.error as Error).message}</Banner>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="lg" disabled={!challengeOk || busy} loading={m.isPending} onClick={() => m.mutate()} variant={expectedFail ? 'danger' : 'primary'}>
                Submit attestation
              </Button>
              <span className="text-xs text-ink-400">circuit {PROFILES.find((p) => p.id === profile)!.circuit} · one ZK proof</span>
            </div>

            {job && (
              <div className="mt-5">
                <JobProgress jobId={job.id} initial={job}>
                  {(j) => (
                    <div className="mt-2 rounded-md border border-accent/30 bg-accent-faint/40 p-4">
                      <div className="text-sm font-semibold text-accent">Attestation recorded</div>
                      <KV
                        className="mt-1"
                        rows={[
                          { k: 'Attestation key', v: <Hash value={String(j.result?.attestationKey ?? '')} head={12} tail={6} label="attestationKey" /> },
                          { k: 'Profile', v: <span className="font-mono">{String(j.result?.profile ?? profile)}</span> },
                          { k: 'Policy version at proof', v: <span className="font-mono">v{String(j.result?.policyVersion ?? '')}</span> },
                        ]}
                      />
                      <p className="mt-2 text-xs text-ink-300">
                        The verifier recomputes the same key from the challenge and your partyId and reads the ledger entry — no message back needed.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Link to={resultUrl}>
                          <Button size="sm" variant="secondary">Open the verifier's result view</Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </JobProgress>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <DisclosurePreview party={me} op="attest" profile={profile} />
          <Card title="Who is asking">
            <KV
              rows={[
                { k: 'Profile', v: PROFILES.find((p) => p.id === profile)!.who },
                { k: 'Holder (me)', v: <span className="flex items-center justify-end gap-2">{PARTIES[me].org} <Badge tone="muted">off-chain</Badge></span> },
                { k: 'Challenge', v: challengeOk ? <Hash value={challenge.trim()} label="challenge" /> : <span className="text-ink-500">—</span> },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
