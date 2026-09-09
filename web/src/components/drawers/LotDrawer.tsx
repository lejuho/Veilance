import { useEffect, useState } from 'react';
import { getApi } from '@/api/client';
import type { GraphEdge, PartyName, Profile } from '@/api/types';
import { Drawer } from '@/components/Drawer';
import { JobRing } from '@/components/JobRing';
import { Button, ErrorLine, Explore, Field, Hash, Heading, Input, Lock, Reason, Row, Select } from '@/components/ui';
import { useGraph, useOpenRequests } from '@/hooks/queries';
import { useAction } from '@/hooks/useAction';
import { bus } from '@/lib/bus';
import { cx } from '@/lib/format';
import { consumedBy, lotTitle } from '@/lib/lots';
import { CHAIN, PARTIES, PROFILES, VERIFIER, nextInChain, orgName } from '@/lib/registry';
import { isActive } from '@/lib/progress';
import { CheckInbox } from './OrgDrawer';

function TransferForm({ lot }: { lot: GraphEdge }) {
  const [to, setTo] = useState<PartyName>(nextInChain(lot.to));
  const [carbon, setCarbon] = useState(String(lot.carbonClass ?? 0));
  const carbonN = Number(carbon);
  const min = lot.carbonClass ?? 0;
  const valid = Number.isInteger(carbonN) && carbonN >= min && carbonN <= 255;
  const api = getApi();
  const action = useAction((recipient: PartyName, carbonClass: number) => api.transfer(lot.to, lot.credentialId, { recipient, carbonClass }), () => to);
  const consumed = lot.status === 'CONSUMED';
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !action.pending) action.run(to, carbonN);
      }}
      onChange={() => action.job && !isActive(action.job) && action.reset()}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="To">
          <Select value={to} onChange={(e) => setTo(e.target.value as PartyName)}>
            {CHAIN.filter((p) => p !== lot.to).map((p) => (
              <option key={p} value={p}>
                {PARTIES[p].org}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Carbon class">
          <Input type="number" min={min} max={255} value={carbon} onChange={(e) => setCarbon(e.target.value)} />
        </Field>
      </div>
      {action.job ? (
        <JobRing jobId={action.job.id} initial={action.job} onTerminal={(j) => j.stage === 'rejected' && bus.flashLot(lot.id)} />
      ) : (
        <div>
          <Button type="submit" muted={consumed} disabled={!valid || action.pending}>
            Transfer
          </Button>
          <ErrorLine error={action.error} />
        </div>
      )}
    </form>
  );
}

function ProveForm({ lot }: { lot: GraphEdge }) {
  const open = useOpenRequests(lot.to);
  const [profile, setProfile] = useState<Profile>('consumer');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    const newest = open.data?.[0];
    if (!touched && newest) {
      setCode(newest.challenge);
      setProfile(newest.profile);
    }
  }, [open.data, touched]);
  const valid = /^[0-9a-f]{64}$/i.test(code.trim());
  const api = getApi();
  const action = useAction((p: Profile, challenge: string) => api.attest(lot.to, lot.credentialId, { profile: p, challenge }), () => 'verifier');
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !action.pending) action.run(profile, code.trim().toLowerCase());
      }}
      onChange={() => action.job && !isActive(action.job) && action.reset()}
    >
      <Field label="For">
        <Select value="verifier" onChange={() => {}}>
          <option value="verifier">{VERIFIER.org}</option>
        </Select>
      </Field>
      <div>
        <div className="mb-1 text-[11px] text-ink-300">Level</div>
        <div className="flex gap-4 text-[13px]">
          {PROFILES.map((p) => (
            <label key={p.id} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="level"
                value={p.id}
                checked={profile === p.id}
                onChange={() => {
                  setTouched(true);
                  setProfile(p.id);
                }}
                className="accent-accent"
              />
              {p.label}
            </label>
          ))}
        </div>
        {profile === 'regulator' && <p className="mt-1 text-[12px] text-ink-400">Publishes this lot's nullifier</p>}
      </div>
      <Field label="Request code">
        <Input
          mono
          value={code}
          placeholder="64 hex characters"
          onChange={(e) => {
            setTouched(true);
            setCode(e.target.value);
          }}
        />
      </Field>
      {action.job ? (
        <JobRing jobId={action.job.id} initial={action.job} />
      ) : (
        <div>
          <Button type="submit" disabled={!valid || action.pending}>
            Prove
          </Button>
          <ErrorLine error={action.error} />
        </div>
      )}
    </form>
  );
}

export function LotDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const graph = useGraph();
  const edges = graph.data?.edges ?? [];
  const lot = edges.find((e) => e.id === id) ?? edges.find((e) => e.credentialId === id);
  const [mode, setMode] = useState<'transfer' | 'prove' | null>(null);
  useEffect(() => setMode(null), [id]);
  if (!lot)
    return (
      <Drawer title="Lot" onClose={onClose}>
        {!graph.isPending && <p className="text-[13px] text-ink-500">—</p>}
      </Drawer>
    );
  const held = lot.status !== 'ISSUED';
  const next = consumedBy(edges, lot);
  const consumedBlock = next?.blockHeight ?? lot.consumedBlockHeight;
  const consumedTx = next?.txHash ?? lot.consumedTxHash;
  return (
    <Drawer title={lotTitle(edges, lot)} subtitle={held ? `held by ${orgName(lot.to)}` : `issued to ${orgName(lot.to)}`} onClose={onClose}>
      <Row k="Origin" v={<>{lot.originLabel ?? '—'} <Lock /></>} />
      <Row k="Carbon class" v={<>{lot.carbonClass ?? '—'} <Lock /></>} />

      <Heading>Timeline</Heading>
      <Row
        k="Issued"
        v={
          <>
            <span>
              block {lot.blockHeight ?? '—'} · {orgName(lot.from)}
            </span>
            <Explore tx={lot.txHash} />
          </>
        }
      />
      <Row k="Delivered" v={held ? `scanned by ${orgName(lot.to)}` : <span className="text-ink-500">—</span>} />
      <Row
        k="Transferred"
        v={
          lot.status === 'CONSUMED' ? (
            <>
              <span>
                block {consumedBlock ?? '—'} · to {orgName(next?.to)}
              </span>
              <Explore tx={consumedTx} />
            </>
          ) : (
            <span className="text-ink-500">—</span>
          )
        }
      />

      <div className="mt-6">
        {held ? (
          <>
            <div className="flex gap-2">
              <Button variant={mode ? (mode === 'transfer' ? 'secondary' : 'ghost') : 'primary'} muted={!mode && lot.status === 'CONSUMED'} onClick={() => setMode('transfer')}>
                Transfer
              </Button>
              <Button variant={mode === 'prove' ? 'secondary' : 'ghost'} className={cx(!mode && 'border border-ink-600')} onClick={() => setMode('prove')}>
                Prove compliance
              </Button>
            </div>
            {mode === 'transfer' && <TransferForm key={lot.id} lot={lot} />}
            {mode === 'prove' && <ProveForm key={lot.id} lot={lot} />}
          </>
        ) : (
          <CheckInbox party={lot.to} />
        )}
        <Reason>{null}</Reason>
      </div>

      <details className="mt-6 text-[13px]">
        <summary className="cursor-pointer select-none text-[11px] font-medium uppercase tracking-wider text-ink-400">Evidence</summary>
        <Row k="Commitment" v={<Hash value={lot.commitment} />} />
        <Row k="Nullifier" v={<Hash value={lot.nullifier} />} />
        <Row k="Inbox #" v={<span className="font-mono text-xs">{lot.inboxIndex ?? '—'}</span>} />
      </details>
    </Drawer>
  );
}
