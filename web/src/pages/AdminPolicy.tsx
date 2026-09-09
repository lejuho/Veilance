import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getApi } from '@/api/client';
import type { Job, PartyName } from '@/api/types';
import { JobProgress } from '@/components/JobProgress';
import { PageTitle } from '@/components/RoleGate';
import { Badge, Banner, Button, Card, Empty, Field, Hash, Input, LockTag, Modal, Select } from '@/components/ui';
import { useJobs, useLedger, usePolicy, useTxs } from '@/hooks/queries';
import { fmtTime } from '@/lib/format';
import { HOLDERS, PARTIES, partyByNameOrOrg } from '@/lib/registry';
import { useRole } from '@/state/role';

export function AdminPolicy() {
  const { role, setRole } = useRole();
  const isAdmin = role === 'admin';
  const policy = usePolicy();
  const ledger = useLedger();
  const txs = useTxs();
  const jobs = useJobs('admin');
  const qc = useQueryClient();

  const [bootstrapJobs, setBootstrapJobs] = useState<Job[] | null>(null);
  const [originOpen, setOriginOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [lastJob, setLastJob] = useState<Job | null>(null);
  const [threshold, setThreshold] = useState<string>('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['jobs'] });
  const bootstrap = useMutation({
    mutationFn: () => getApi().bootstrap(),
    onSuccess: (r) => {
      setBootstrapJobs(r.jobs);
      invalidate();
    },
  });
  const setThr = useMutation({
    mutationFn: (t: number) => getApi().setCarbonThreshold(t),
    onSuccess: (j) => {
      setLastJob(j);
      setThreshold('');
      invalidate();
    },
  });

  const P = policy.data;
  const active = jobs.data?.some((j) => ['queued', 'preparing', 'proving', 'submitting'].includes(j.stage));

  return (
    <div className="space-y-6">
      <PageTitle
        title="Policy"
        subtitle={
          <>
            policy <span className="font-mono text-ink-100">v{P?.policyVersion ?? '…'}</span> · carbon threshold{' '}
            <span className="font-mono text-ink-100">{P?.carbonThreshold ?? '…'}</span> · every change bumps the version and invalidates older attestations.
          </>
        }
        actions={
          isAdmin ? (
            <Badge tone="accent">Admin key present</Badge>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setRole('admin')}>
              Read-only — switch to Admin
            </Button>
          )
        }
      />

      {isAdmin && (
        <Card
          title="Bootstrap demo policy"
          subtitle="Certifies the default origin (DRC Mine X), certifies Mine / Refiner / Battery Manufacturer, sets carbon threshold 5, registers all four encryption keys. Each is its own proof, run sequentially."
          actions={
            <Button onClick={() => bootstrap.mutate()} loading={bootstrap.isPending} disabled={!!active}>
              Bootstrap demo policy
            </Button>
          }
        >
          {bootstrap.isError && <Banner tone="danger">{(bootstrap.error as Error).message}</Banner>}
          {bootstrapJobs ? (
            <ol className="space-y-2">
              {bootstrapJobs.map((j, i) => (
                <li key={j.id} className="flex gap-3">
                  <span className="mt-4 w-5 shrink-0 font-mono text-xs text-ink-500">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <JobProgress
                      jobId={j.id}
                      initial={j}
                      title={
                        <>
                          <span className="font-mono text-ink-100">{j.circuit}</span>
                          <span className="ml-2 text-ink-400">{j.party !== 'admin' ? `as ${PARTIES[j.party].short}` : ''}</span>
                        </>
                      }
                    />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Nothing bootstrapped in this session. Existing policy is left untouched — already-certified items are skipped.</Empty>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Certified origins"
          subtitle="On chain: the originId hash in the allow-list tree. The label is L3 only."
          actions={isAdmin && <Button size="sm" variant="secondary" onClick={() => setOriginOpen(true)}>Add origin</Button>}
        >
          {P?.origins.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="pb-2 font-medium">
                    Label <LockTag />
                  </th>
                  <th className="pb-2 font-medium">originId</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/70">
                {P.origins.map((o) => (
                  <tr key={o.originId}>
                    <td className="py-2">{o.label ?? <span className="text-ink-500">(no label)</span>}</td>
                    <td className="py-2">
                      <Hash value={o.originId} label="originId" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No certified origins. {isAdmin ? 'Bootstrap or add one.' : ''}</Empty>
          )}
          <p className="mt-3 text-[11px] text-ink-400">{P ? 256 - P.origins.length : '…'} of 256 slots free.</p>
        </Card>

        <Card
          title="Certified suppliers"
          subtitle="On chain: certLeaf = H(partyId, certId). The organisation name is L3 only."
          actions={isAdmin && <Button size="sm" variant="secondary" onClick={() => setSupplierOpen(true)}>Add supplier</Button>}
        >
          {P?.suppliers.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="pb-2 font-medium">
                    Organisation <LockTag />
                  </th>
                  <th className="pb-2 font-medium">partyId</th>
                  <th className="pb-2 font-medium">certId</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/70">
                {P.suppliers.map((s) => {
                  const pn = partyByNameOrOrg(s.partyName);
                  const org = pn ? PARTIES[pn].org : s.partyName;
                  return (
                  <tr key={s.partyId + s.certId}>
                    <td className="py-2">
                      {org ?? s.label ?? <span className="text-ink-500">(unknown)</span>}
                      {s.label && org && <div className="text-[11px] text-ink-400">{s.label.replace(`${org} · `, '')}</div>}
                    </td>
                    <td className="py-2">
                      <Hash value={s.partyId} label="partyId" />
                    </td>
                    <td className="py-2">
                      <Hash value={s.certId} label="certId" />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty>No certified suppliers.</Empty>
          )}
          <p className="mt-3 text-[11px] text-ink-400">{P ? 256 - P.suppliers.length : '…'} of 256 slots free.</p>
        </Card>

        <Card title="Carbon threshold" subtitle="OEM procurement predicate: holder proves carbonClass ≤ threshold without revealing the class.">
          <div className="flex items-end gap-3">
            <Field label="New threshold (0–255)">
              <Input type="number" min={0} max={255} value={threshold} disabled={!isAdmin} onChange={(e) => setThreshold(e.target.value)} placeholder={String(P?.carbonThreshold ?? '')} />
            </Field>
            <Button
              disabled={!isAdmin || threshold === '' || !!active}
              loading={setThr.isPending}
              onClick={() => setThr.mutate(Number(threshold))}
            >
              Set threshold
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-ink-400">Lowering it after an attestation makes that attestation STALE on the verifier side (policyVersion mismatch).</p>
          {setThr.isError && <Banner tone="danger" className="mt-3">{(setThr.error as Error).message}</Banner>}
          {lastJob && (
            <div className="mt-4">
              <JobProgress jobId={lastJob.id} initial={lastJob} />
            </div>
          )}
        </Card>

        <Card title="Policy transactions" subtitle="From the indexer (best effort).">
          {txs.data?.length ? (
            <div className="divide-y divide-ink-700/70">
              {txs.data.slice(0, 12).map((t) => (
                <div key={t.txHash} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span className="font-mono text-ink-100">{t.circuit ?? 'tx'}</span>
                  <span className="text-ink-400">{t.timestamp ? fmtTime(t.timestamp) : ''}</span>
                  <span className="text-ink-400">
                    block <span className="font-mono text-ink-200">{t.blockHeight}</span>
                  </span>
                  <Hash value={t.txHash} label="txHash" />
                </div>
              ))}
            </div>
          ) : (
            <Empty>No transactions indexed yet{ledger.data ? ` (block ${ledger.data.blockHeight})` : ''}.</Empty>
          )}
        </Card>
      </div>

      <AddOriginModal open={originOpen} onClose={() => setOriginOpen(false)} onJob={(j) => { setLastJob(j); invalidate(); }} />
      <AddSupplierModal open={supplierOpen} onClose={() => setSupplierOpen(false)} onJob={(j) => { setLastJob(j); invalidate(); }} />
    </div>
  );
}

function AddOriginModal({ open, onClose, onJob }: { open: boolean; onClose: () => void; onJob: (j: Job) => void }) {
  const [label, setLabel] = useState('');
  const [originId, setOriginId] = useState('');
  const m = useMutation({
    mutationFn: () => getApi().addOrigin({ label, originId: originId.trim() || undefined }),
    onSuccess: (j) => {
      onJob(j);
      onClose();
      setLabel('');
      setOriginId('');
    },
  });
  const validId = originId.trim() === '' || /^[0-9a-f]{64}$/i.test(originId.trim());
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add certified origin"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!label.trim() || !validId} loading={m.isPending}>
            Certify origin
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Display name" locked hint="Stored in the agent registry only (L3).">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="DRC Mine X" autoFocus />
        </Field>
        <Field label="originId (32-byte hex)" hint="Leave empty to let the agent generate a salted random id.">
          <Input mono value={originId} onChange={(e) => setOriginId(e.target.value)} placeholder="auto-generate" />
        </Field>
        {!validId && <p className="text-xs text-danger">originId must be 64 hex characters.</p>}
        <Banner tone="neutral">Only the originId hash is recorded on chain. The name never leaves this agent.</Banner>
        {m.isError && <Banner tone="danger">{(m.error as Error).message}</Banner>}
      </div>
    </Modal>
  );
}

function AddSupplierModal({ open, onClose, onJob }: { open: boolean; onClose: () => void; onJob: (j: Job) => void }) {
  const [partyName, setPartyName] = useState<PartyName>('mine');
  const [certId, setCertId] = useState('');
  const [certLabel, setCertLabel] = useState('');
  const m = useMutation({
    mutationFn: () => getApi().addSupplier({ partyName, certId: certId.trim() || undefined, certLabel: certLabel.trim() || undefined }),
    onSuccess: (j) => {
      onJob(j);
      onClose();
      setCertId('');
      setCertLabel('');
    },
  });
  const validId = certId.trim() === '' || /^[0-9a-f]{64}$/i.test(certId.trim());
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add certified supplier"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!validId} loading={m.isPending}>
            Certify supplier
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Organisation" locked hint="partyId is filled from the agent's registry.">
          <Select value={partyName} onChange={(e) => setPartyName(e.target.value as PartyName)}>
            {HOLDERS.map((p) => (
              <option key={p} value={p}>
                {PARTIES[p].org} ({PARTIES[p].short})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="certId (32-byte hex)" hint="Leave empty to use the party's configured certificate id.">
          <Input mono value={certId} onChange={(e) => setCertId(e.target.value)} placeholder="party default" />
        </Field>
        <Field label="Certification type" locked>
          <Input value={certLabel} onChange={(e) => setCertLabel(e.target.value)} placeholder="RMI conformant / ISO 14001" />
        </Field>
        {!validId && <p className="text-xs text-danger">certId must be 64 hex characters.</p>}
        {m.isError && <Banner tone="danger">{(m.error as Error).message}</Banner>}
      </div>
    </Modal>
  );
}
