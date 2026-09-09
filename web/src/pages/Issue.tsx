import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApi } from '@/api/client';
import type { Job, PartyName } from '@/api/types';
import { DisclosurePreview } from '@/components/DisclosurePreview';
import { JobProgress } from '@/components/JobProgress';
import { PageTitle, RoleGate } from '@/components/RoleGate';
import { Badge, Banner, Button, Card, Field, Hash, Input, KV, Private, Select } from '@/components/ui';
import { useParties, usePolicy } from '@/hooks/queries';
import { MATERIALS, PARTIES, RECIPIENTS } from '@/lib/registry';
import { useRole } from '@/state/role';

export function Issue() {
  return (
    <RoleGate allow={['mine']} why="Only the root issuer (Mine) creates provenance.">
      <IssueForm />
    </RoleGate>
  );
}

function IssueForm() {
  const { party } = useRole();
  const me = party as PartyName;
  const policy = usePolicy();
  const parties = useParties();
  const qc = useQueryClient();

  const [recipient, setRecipient] = useState<PartyName>('refiner');
  const [originId, setOriginId] = useState('');
  const [material, setMaterial] = useState('Cobalt');
  const [carbon, setCarbon] = useState('3');
  const [quantity, setQuantity] = useState('12.5 t');
  const [price, setPrice] = useState('');
  const [memo, setMemo] = useState('');
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!originId && policy.data?.origins.length) setOriginId(policy.data.origins[0].originId);
  }, [policy.data, originId]);

  const meParty = parties.data?.find((p) => p.name === me);
  const rcpt = parties.data?.find((p) => p.name === recipient);
  const carbonN = Number(carbon);
  const carbonOk = Number.isInteger(carbonN) && carbonN >= 0 && carbonN <= 255;
  const blockers: string[] = [];
  if (meParty && !meParty.certified) blockers.push('You are not a certified supplier — the contract will reject issueProvenance.');
  if (rcpt && !rcpt.encKeyRegistered) blockers.push(`${PARTIES[recipient].org} has not registered an encryption key — the entry cannot be sealed.`);
  if (policy.data && !policy.data.origins.length) blockers.push('No certified origins in policy.');

  const m = useMutation({
    mutationFn: () =>
      getApi().issue(me, {
        recipient,
        originId,
        materialType: material.toLowerCase(),
        carbonClass: carbonN,
        note: [quantity && `qty=${quantity}`, price && `price=${price}`, memo].filter(Boolean).join('; ') || undefined,
      }),
    onSuccess: (j) => {
      setJob(j);
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const originLabel = policy.data?.origins.find((o) => o.originId === originId)?.label;
  const busy = !!job && ['queued', 'preparing', 'proving', 'submitting'].includes(job.stage);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Issue provenance"
        subtitle="Create the root credential for a batch. One commitment goes on chain; everything you type here stays in this agent."
        actions={meParty ? meParty.certified ? <Badge tone="accent">certified issuer</Badge> : <Badge tone="warn">not certified</Badge> : null}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Batch" subtitle="🔒 fields are shown to you and sealed for the recipient. They are never written to the ledger in clear.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Recipient" locked hint={rcpt ? (rcpt.encKeyRegistered ? 'Encryption key registered ✓' : 'No encryption key yet') : undefined}>
              <Select value={recipient} onChange={(e) => setRecipient(e.target.value as PartyName)} disabled={busy}>
                {RECIPIENTS.filter((r) => r !== me).map((r) => (
                  <option key={r} value={r}>
                    {PARTIES[r].org} ({PARTIES[r].short})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Origin" locked hint="Only certified origins are listed.">
              <Select value={originId} onChange={(e) => setOriginId(e.target.value)} disabled={busy || !policy.data?.origins.length}>
                {policy.data?.origins.map((o) => (
                  <option key={o.originId} value={o.originId}>
                    {o.label ?? o.originId.slice(0, 12) + '…'}
                  </option>
                ))}
                {!policy.data?.origins.length && <option value="">— none certified —</option>}
              </Select>
            </Field>
            <Field label="Material" locked>
              <Select value={material} onChange={(e) => setMaterial(e.target.value)} disabled={busy}>
                {MATERIALS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Carbon class (0–255)" locked hint="Lower is better. Downstream can only raise it.">
              <Input type="number" min={0} max={255} value={carbon} onChange={(e) => setCarbon(e.target.value)} disabled={busy} />
            </Field>
            <Field label="Quantity" locked hint="Memo only (L2). Not in the MVP circuit.">
              <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={busy} />
            </Field>
            <Field label="Unit price" locked hint="Memo only (L2).">
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="USD / kg" disabled={busy} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Contract memo" locked>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="PO number, incoterms…" disabled={busy} />
              </Field>
            </div>
          </div>
          {!carbonOk && <p className="mt-2 text-xs text-danger">Carbon class must be an integer 0–255.</p>}
          {blockers.length > 0 && (
            <Banner tone="warn" className="mt-4" title="Pre-check">
              <ul className="list-disc pl-4">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <div className="mt-1">
                Fix on <Link to="/admin/policy" className="underline">Policy</Link> (Admin) or via the recipient's dashboard.
              </div>
            </Banner>
          )}
          {m.isError && <Banner tone="danger" className="mt-4">{(m.error as Error).message}</Banner>}
          <div className="mt-5 flex items-center gap-3">
            <Button size="lg" disabled={!carbonOk || !originId || busy} loading={m.isPending} onClick={() => m.mutate()}>
              Issue provenance
            </Button>
            <span className="text-xs text-ink-400">circuit issueProvenance · one ZK proof</span>
          </div>
          {job && (
            <div className="mt-5">
              <JobProgress jobId={job.id} initial={job}>
                {(j) => (
                  <div className="mt-2 rounded-md border border-accent/30 bg-accent-faint/40 p-4">
                    <div className="text-sm font-semibold text-accent">Credential issued</div>
                    <KV
                      className="mt-1"
                      rows={[
                        { k: 'Commitment', v: <Hash value={String(j.result?.commitment ?? '')} head={12} tail={6} label="commitment" /> },
                        { k: 'Inbox index', v: <span className="font-mono">{String(j.result?.inboxIndex ?? '—')}</span> },
                        { k: 'Recipient', v: <span className="flex items-center justify-end gap-2">{PARTIES[recipient].org} <Badge tone="muted">off-chain</Badge></span> },
                        { k: 'Origin · material · carbon', v: <Private width="w-28" /> },
                      ]}
                    />
                    <p className="mt-2 text-xs text-ink-300">
                      The recipient will receive it by scanning the chain — the sealed entry can only be opened with their X25519 key. No off-chain hand-off needed.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Link to="/credentials">
                        <Button size="sm" variant="secondary">My credentials</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => setJob(null)}>
                        Issue another
                      </Button>
                    </div>
                  </div>
                )}
              </JobProgress>
            </div>
          )}
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <DisclosurePreview
            party={me}
            op="issue"
            extraPrivate={[originLabel ? `Origin label "${originLabel}"` : '', quantity ? `Quantity ${quantity}` : ''].filter(Boolean)}
          />
          <Card title="What the observer sees">
            <KV
              rows={[
                { k: 'Mine', v: <Private width="w-28" /> },
                { k: 'Supplier', v: <Private width="w-20" /> },
                { k: 'Quantity', v: <Private width="w-16" /> },
                { k: 'Certification', v: <span className="font-mono text-accent">Verified ✓</span> },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
