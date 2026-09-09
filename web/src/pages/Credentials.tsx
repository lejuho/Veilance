import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import type { Credential, PartyName, Profile } from '@/api/types';
import { PageTitle, RoleGate } from '@/components/RoleGate';
import { Badge, Banner, Button, Card, Empty, Hash, LockTag } from '@/components/ui';
import { useCredentials, useParties, useScan } from '@/hooks/queries';
import { cx, fmtTime } from '@/lib/format';
import { PARTIES, profileDef } from '@/lib/registry';
import { useRole } from '@/state/role';

export function Credentials() {
  return (
    <RoleGate allow={['mine', 'refiner', 'batteryMfr']} why="Credentials live in a holder's private state.">
      <CredentialList />
    </RoleGate>
  );
}

function CredentialList() {
  const { party } = useRole();
  const me = party as PartyName;
  const creds = useCredentials(me);
  const parties = useParties();
  const scan = useScan(me);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'CONSUMED'>('ALL');
  const [params] = useSearchParams();
  const challenge = params.get('challenge');
  const profile = (params.get('profile') as Profile | null) ?? null;
  const attestQuery = challenge ? `?challenge=${encodeURIComponent(challenge)}${profile ? `&profile=${profile}` : ''}` : '';

  const meParty = parties.data?.find((p) => p.name === me);
  const list = (creds.data ?? []).filter((c) => filter === 'ALL' || c.status === filter);
  const lastScan = scan.data;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Credentials"
        subtitle={`${PARTIES[me].org} · private state. Nothing on this page is readable on chain except the commitment hashes.`}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-900 p-0.5">
              {(['ALL', 'ACTIVE', 'CONSUMED'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cx('rounded px-2 py-1 text-xs', filter === f ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200')}>
                  {f}
                </button>
              ))}
            </div>
            <Button onClick={() => scan.mutate()} loading={scan.isPending} disabled={meParty ? !meParty.encKeyRegistered : false} title="Trial-decrypt new inbox entries with my X25519 key">
              Scan inbox
            </Button>
          </>
        }
      />

      {challenge && (
        <Banner tone="accent" title={`Attestation request${profile ? ` · ${profileDef(profile).label}` : ''}`}>
          A verifier is waiting for a proof against challenge <span className="font-mono">{challenge.slice(0, 12)}…</span>. Pick an ACTIVE credential and click <b>Prove policy</b>.
        </Banner>
      )}
      {meParty && !meParty.encKeyRegistered && (
        <Banner tone="warn" title="No encryption key registered">
          Nothing can be sealed to you until registerEncKey runs. Register it from the <Link to="/" className="underline">dashboard</Link>.
        </Banner>
      )}
      {scan.isError && <Banner tone="danger">{(scan.error as Error).message}</Banner>}
      {lastScan && (
        <Banner tone={lastScan.found ? 'accent' : 'neutral'}>
          Scan finished: {lastScan.found ? `${lastScan.found} new credential${lastScan.found > 1 ? 's' : ''} decrypted and verified against provenanceTree.` : 'no new entries addressed to me.'}
        </Banner>
      )}

      {creds.isLoading ? (
        <Empty>Loading…</Empty>
      ) : list.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((c) => (
            <CredentialCard key={c.id} c={c} attestQuery={attestQuery} />
          ))}
        </div>
      ) : (
        <Empty>{creds.data?.length ? 'Nothing matches the filter.' : 'No credentials in private state. Click Scan inbox after someone issues or transfers to you.'}</Empty>
      )}
    </div>
  );
}

function CredentialCard({ c, attestQuery }: { c: Credential; attestQuery: string }) {
  const consumed = c.status === 'CONSUMED';
  return (
    <Card className={cx(consumed && 'opacity-90')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">commitment</div>
          <Hash value={c.commitment} head={12} tail={6} label="commitment" className="text-sm" />
        </div>
        <Badge tone={consumed ? 'danger' : 'accent'}>{c.status}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="flex items-center gap-1 text-[11px] text-ink-400">
            Material <LockTag />
          </dt>
          <dd className="mt-0.5">{c.materialLabel ?? c.materialType}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-[11px] text-ink-400">
            Origin <LockTag />
          </dt>
          <dd className="mt-0.5" title={c.originId}>
            {c.originLabel ?? <Hash value={c.originId} />}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-[11px] text-ink-400">
            Carbon class <LockTag />
          </dt>
          <dd className="mt-0.5 font-mono">{c.carbonClass}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-400">
        <span>received {fmtTime(c.receivedAt)}</span>
        {c.inboxIndex != null && <span>inbox #{c.inboxIndex}</span>}
        {c.issuedBy && (
          <span className="inline-flex items-center gap-1">
            from {PARTIES[c.issuedBy].org} <LockTag />
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4">
        {!consumed ? (
          <>
            <Link to={`/credentials/${c.id}/transfer`}>
              <Button size="sm">Transfer</Button>
            </Link>
            <Link to={`/credentials/${c.id}/attest${attestQuery}`}>
              <Button size="sm" variant="secondary">Prove policy</Button>
            </Link>
          </>
        ) : (
          <>
            <Link to={`/credentials/${c.id}/transfer?attack=1`}>
              <Button size="sm" variant="danger" title="Attack demo: the contract must reject a second spend">
                Transfer again (attack demo)
              </Button>
            </Link>
            <span className="text-[11px] text-ink-400">Nullifier already on chain — the contract will reject this.</span>
          </>
        )}
      </div>
    </Card>
  );
}
