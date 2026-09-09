import { Link } from 'react-router-dom';
import { getApi } from '@/api/client';
import type { Job } from '@/api/types';
import { JobStepper } from '@/components/JobProgress';
import { PageTitle } from '@/components/RoleGate';
import { Badge, Button, Card, Empty, Hash, KV } from '@/components/ui';
import { useChallenges, useCredentials, useJobs, useLedger, useParties } from '@/hooks/queries';
import { fmtElapsed, fmtTime } from '@/lib/format';
import { PARTIES, ROLES } from '@/lib/registry';
import { useRole } from '@/state/role';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { JobProgress } from '@/components/JobProgress';

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className="mt-1 font-mono text-2xl tabular-nums text-ink-100">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}

function JobRow({ j }: { j: Job }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-ink-100">{j.circuit}</span>
        <span className="text-[11px] text-ink-400">{fmtTime(j.startedAt)}</span>
        {j.elapsedMs != null && <span className="font-mono text-[11px] text-ink-400">{fmtElapsed(j.elapsedMs)}</span>}
      </div>
      <div className="flex items-center gap-3">
        <JobStepper job={j} compact />
        {j.txHash && <Hash value={j.txHash} label="txHash" />}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { role, party, setRole } = useRole();
  const ledger = useLedger();
  const parties = useParties();
  const creds = useCredentials(party);
  const jobs = useJobs(party);
  const challenges = useChallenges();
  const qc = useQueryClient();
  const [encJob, setEncJob] = useState<string | null>(null);
  const registerKey = useMutation({
    mutationFn: () => getApi().registerEncKey(party!),
    onSuccess: (j) => {
      setEncJob(j.id);
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const me = parties.data?.find((p) => p.name === party);
  const held = creds.data?.filter((c) => c.status === 'ACTIVE').length ?? 0;
  const consumed = creds.data?.filter((c) => c.status === 'CONSUMED').length ?? 0;
  const L = ledger.data;
  const roleDef = ROLES.find((r) => r.id === role)!;

  const quick: { to: string; label: string; primary?: boolean }[] =
    role === 'admin'
      ? [{ to: '/admin/policy', label: 'Manage policy', primary: true }, { to: '/demo', label: 'Open demo guide' }]
      : role === 'mine'
        ? [{ to: '/issue', label: 'Issue provenance', primary: true }, { to: '/credentials', label: 'My credentials' }]
        : role === 'verifier'
          ? [{ to: '/verify', label: 'Request a proof', primary: true }, { to: '/admin/policy', label: 'View policy' }]
          : [{ to: '/credentials', label: 'Credentials: scan / transfer / prove', primary: true }, { to: '/admin/policy', label: 'View policy' }];

  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            {party ? PARTIES[party].org : 'Verifier'}
            <Badge tone="accent">{roleDef.label}</Badge>
          </span>
        }
        subtitle={party ? `${PARTIES[party].role} · partyId is pseudonymous; the organisation name lives only in this UI.` : 'No wallet. Reads the public ledger and issues challenges.'}
        actions={quick.map((q) => (
          <Link key={q.to} to={q.to}>
            <Button variant={q.primary ? 'primary' : 'secondary'}>{q.label}</Button>
          </Link>
        ))}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {party ? (
          <>
            <Stat label="Held credentials" value={creds.data ? held : '…'} hint="ACTIVE in my private state" />
            <Stat label="Consumed" value={creds.data ? consumed : '…'} hint="nullifier published" />
            <Stat label="Attestations on chain" value={L?.attestationCount ?? '…'} hint="all parties, opaque keys" />
            <Stat label="Policy" value={`v${L?.policyVersion ?? '…'}`} hint={`carbon threshold ${L?.carbonThreshold ?? '…'}`} />
          </>
        ) : (
          <>
            <Stat label="My challenges" value={challenges.data?.length ?? '…'} hint="issued from this verifier" />
            <Stat label="Attestations on chain" value={L?.attestationCount ?? '…'} />
            <Stat label="Policy" value={`v${L?.policyVersion ?? '…'}`} hint={`carbon threshold ${L?.carbonThreshold ?? '…'}`} />
            <Stat label="Block" value={L?.blockHeight ?? '…'} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {party && (
            <Card title="Identity" subtitle="What the chain knows about me vs. what only I know.">
              <KV
                rows={[
                  { k: 'Organisation', v: <span className="flex items-center justify-end gap-2">{PARTIES[party].org} <Badge tone="muted">off-chain</Badge></span> },
                  { k: 'partyId', v: <Hash value={me?.partyId} head={10} tail={6} label="partyId" /> },
                  {
                    k: 'Certified supplier',
                    v: me ? me.certified ? <Badge tone="accent">certified</Badge> : <Badge tone="warn">not certified</Badge> : '…',
                  },
                  {
                    k: 'Encryption key (X25519)',
                    v: me ? (
                      me.encKeyRegistered ? (
                        <span className="flex items-center justify-end gap-2">
                          <Hash value={me.encPk} label="encPk" /> <Badge tone="accent">registered</Badge>
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-2">
                          <Badge tone="warn">not registered</Badge>
                          <Button size="sm" variant="secondary" loading={registerKey.isPending} onClick={() => registerKey.mutate()}>
                            Register key
                          </Button>
                        </span>
                      )
                    ) : (
                      '…'
                    ),
                  },
                  { k: 'NIGHT / DUST', v: <span className="font-mono text-xs">{me?.night ?? '…'} / {me?.dust ?? '…'}</span> },
                ]}
              />
              {encJob && (
                <div className="mt-3">
                  <JobProgress jobId={encJob} />
                </div>
              )}
              {registerKey.isError && <p className="mt-2 text-xs text-danger">{(registerKey.error as Error).message}</p>}
            </Card>
          )}

          <Card title="Recent jobs" subtitle={party ? `Circuit calls made by ${PARTIES[party].short}.` : 'Verifiers make no circuit calls.'}>
            {!party ? (
              <Empty>Verification is a public ledger read — nothing to prove, nothing to sign.</Empty>
            ) : jobs.data?.length ? (
              <div className="divide-y divide-ink-700/70">{jobs.data.slice(0, 8).map((j) => <JobRow key={j.id} j={j} />)}</div>
            ) : (
              <Empty>No jobs yet.</Empty>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Public ledger" subtitle="Everything an observer can count. Nothing they can read.">
            <KV
              rows={[
                { k: 'Provenance leaves', v: <span className="font-mono">{L?.provenanceLeafCount ?? '…'}</span> },
                { k: 'Nullifiers', v: <span className="font-mono">{L?.nullifierCount ?? '…'}</span> },
                { k: 'Attestations', v: <span className="font-mono">{L?.attestationCount ?? '…'}</span> },
                { k: 'Sealed inbox entries', v: <span className="font-mono">{L?.inboxCount ?? '…'}</span> },
                { k: 'Encryption keys', v: <span className="font-mono">{L?.encKeyCount ?? '…'}</span> },
                { k: 'Certified origins', v: <span className="font-mono">{L?.certifiedOriginCount ?? '…'}</span> },
                { k: 'Certified suppliers', v: <span className="font-mono">{L?.certifiedSupplierCount ?? '…'}</span> },
                { k: 'Block height', v: <span className="font-mono">{L?.blockHeight ?? '…'}</span> },
                { k: 'Contract', v: <Hash value={L?.contractAddress} label="contract" /> },
              ]}
            />
          </Card>
          <Card title="Parties" subtitle="Demo agent hosts four parties.">
            <div className="space-y-2">
              {parties.data?.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setRole(p.name)}
                  className="flex w-full items-center justify-between rounded-md border border-ink-700 px-3 py-2 text-left hover:border-ink-500"
                >
                  <div>
                    <div className="text-sm">{PARTIES[p.name].org}</div>
                    <div className="text-[11px] text-ink-400">{PARTIES[p.name].short}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.certified && <Badge tone="accent">cert</Badge>}
                    {p.encKeyRegistered && <Badge tone="neutral">key</Badge>}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
