import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import type { GraphEdge, PartyName } from '@/api/types';
import { Drawer } from '@/components/Drawer';
import { JobRing } from '@/components/JobRing';
import { Button, ErrorLine, Explore, Field, Hash, Heading, Input, Reason, Row, Select } from '@/components/ui';
import { qk, useGraph, useJobs, useParties, usePolicy } from '@/hooks/queries';
import { useAction } from '@/hooks/useAction';
import { cx } from '@/lib/format';
import { STATUS_WORD, lotNumber, newestFirst } from '@/lib/lots';
import { CHAIN, MATERIALS, PARTIES, nextInChain } from '@/lib/registry';

export function LotRow({ lot, edges }: { lot: GraphEdge; edges: GraphEdge[] }) {
  const consumed = lot.status === 'CONSUMED';
  return (
    <Link
      to={{ pathname: '/', search: `?lot=${encodeURIComponent(lot.id)}` }}
      className="flex items-center gap-2 rounded px-1 py-1.5 text-[13px] hover:bg-ink-800"
    >
      <span className={cx('inline-block h-2 w-2 rounded-full', lot.status === 'DELIVERED' ? 'bg-accent' : lot.status === 'ISSUED' ? 'bg-ink-400' : 'border border-ink-400')} />
      <span className={cx('flex-1', consumed && 'text-ink-400')}>
        {lot.materialLabel ?? 'Lot'} · lot {lotNumber(edges, lot.id)} · {STATUS_WORD[lot.status]}
        {!consumed && lot.carbonClass != null && ` · class ${lot.carbonClass}`}
      </span>
      <span className="text-ink-500">›</span>
    </Link>
  );
}

/** Check inbox: runs the scan and shows `1 new lot` or `Nothing new`. */
export function CheckInbox({ party }: { party: PartyName }) {
  const qc = useQueryClient();
  const scan = useMutation({
    mutationFn: () => getApi().scan(party),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.graph });
      qc.invalidateQueries({ queryKey: qk.parties });
    },
  });
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={() => scan.mutate()} disabled={scan.isPending}>
        Check inbox
      </Button>
      {scan.data && (
        <span className={cx('text-[13px]', scan.data.found ? 'text-accent' : 'text-ink-400')}>
          {scan.data.found ? `${scan.data.found} new lot${scan.data.found > 1 ? 's' : ''}` : 'Nothing new'}
        </span>
      )}
      {scan.error && <span className="text-[13px] text-red">{scan.error.message}</span>}
    </div>
  );
}

function IssueForm() {
  const policy = usePolicy();
  const parties = useParties();
  const [to, setTo] = useState<PartyName>(nextInChain('mine'));
  const [material, setMaterial] = useState(MATERIALS[0]);
  const [origin, setOrigin] = useState('');
  const [carbon, setCarbon] = useState('3');
  const originId = origin || policy.data?.origins[0]?.originId || '';
  const recipient = parties.data?.find((p) => p.name === to);
  const carbonN = Number(carbon);
  const action = useAction((input: Parameters<typeof api.issue>[1]) => api.issue('mine', input), () => to);
  const api = getApi();
  const why = !policy.data?.origins.length ? 'Certify an origin in Policy first' : recipient && !recipient.encKeyRegistered ? `${PARTIES[to].org} has no receiving key` : null;
  const valid = !why && Number.isInteger(carbonN) && carbonN >= 0 && carbonN <= 255 && !!originId;
  return (
    <form
      className="mt-2 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !action.pending) action.run({ recipient: to, originId, materialType: material.toLowerCase(), carbonClass: carbonN });
      }}
      onChange={() => action.job && !['queued', 'preparing', 'proving', 'submitting'].includes(action.job.stage) && action.reset()}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="To">
          <Select value={to} onChange={(e) => setTo(e.target.value as PartyName)}>
            {CHAIN.filter((p) => p !== 'mine').map((p) => (
              <option key={p} value={p}>
                {PARTIES[p].org}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Material">
          <Select value={material} onChange={(e) => setMaterial(e.target.value)}>
            {MATERIALS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Origin">
          <Select value={originId} onChange={(e) => setOrigin(e.target.value)}>
            {!policy.data?.origins.length && <option value="">—</option>}
            {policy.data?.origins.map((o) => (
              <option key={o.originId} value={o.originId}>
                {o.label ?? o.originId.slice(0, 12)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Carbon class">
          <Input type="number" min={0} max={255} value={carbon} onChange={(e) => setCarbon(e.target.value)} />
        </Field>
      </div>
      {action.job ? (
        <JobRing jobId={action.job.id} initial={action.job} />
      ) : (
        <div>
          <Button type="submit" disabled={!valid || action.pending}>
            Issue
          </Button>
          <Reason>{why}</Reason>
          <ErrorLine error={action.error} />
        </div>
      )}
      <details className="text-[12px] text-ink-400">
        <summary className="cursor-pointer select-none">What goes on chain</summary>
        <ul className="mt-1 list-disc pl-5">
          <li>one 32-byte commitment</li>
          <li>one sealed 192-byte delivery</li>
        </ul>
      </details>
    </form>
  );
}

export function OrgDrawer({ id, onClose }: { id: PartyName; onClose: () => void }) {
  const graph = useGraph();
  const parties = useParties();
  const jobs = useJobs();
  const node = graph.data?.nodes.find((n) => n.id === id);
  const party = parties.data?.find((p) => p.name === id);
  const certified = node?.certified ?? party?.certified ?? false;
  const keyed = node?.encKeyRegistered ?? party?.encKeyRegistered ?? false;
  const certJob = jobs.data?.find(
    (j) => j.circuit === 'certifySupplier' && j.stage === 'confirmed' && (j.result?.partyName === id || (party && j.result?.partyId === party.partyId)),
  );
  const keyJob = jobs.data?.find((j) => j.circuit === 'registerEncKey' && j.party === id && j.stage === 'confirmed');
  const edges = graph.data?.edges ?? [];
  const lots = newestFirst(edges.filter((e) => e.to === id && e.status !== 'ISSUED'));
  const [issuing, setIssuing] = useState(false);
  useEffect(() => setIssuing(false), [id]);
  const register = useAction(() => getApi().registerEncKey(id));
  const why = !certified ? 'Ask the policy admin to certify this organisation' : !keyed ? 'Register the receiving key first' : null;

  return (
    <Drawer
      title={node?.org ?? PARTIES[id].org}
      subtitle={
        <>
          {node?.role ?? PARTIES[id].role} · id <Hash value={party?.partyId} />
        </>
      }
      onClose={onClose}
    >
      <Row
        k="Certified"
        v={
          certified ? (
            <>
              <span className="text-accent">✓</span>
              {certJob?.blockHeight != null && <span className="text-ink-300">since block {certJob.blockHeight}</span>}
              <Explore tx={certJob?.txHash} />
            </>
          ) : (
            <span className="text-ink-500">—</span>
          )
        }
      />
      <Row
        k="Receiving key"
        v={
          keyed ? (
            <>
              <span className="text-accent">✓</span>
              <span className="text-ink-300">registered</span>
              <Explore tx={keyJob?.txHash} />
            </>
          ) : register.job ? (
            <JobRing jobId={register.job.id} initial={register.job} />
          ) : (
            <>
              <span className="text-ink-500">—</span>
              <Button size="sm" variant="secondary" onClick={() => register.run()} disabled={register.pending}>
                Register
              </Button>
            </>
          )
        }
      />

      <Heading>Lots</Heading>
      {lots.length ? (
        <div className="-mx-1">
          {lots.map((l) => (
            <LotRow key={l.id} lot={l} edges={edges} />
          ))}
        </div>
      ) : (
        <p className="py-1.5 text-[13px] text-ink-500">—</p>
      )}

      <div className="mt-6">
        {id === 'mine' ? (
          issuing ? (
            <IssueForm />
          ) : (
            <div>
              <Button onClick={() => setIssuing(true)} disabled={!!why}>
                Issue lot
              </Button>
              <Reason>{why}</Reason>
            </div>
          )
        ) : (
          <>
            {keyed ? <CheckInbox party={id} /> : <Button variant="secondary" disabled>Check inbox</Button>}
            <Reason>{!keyed ? 'Register the receiving key first' : null}</Reason>
          </>
        )}
      </div>
    </Drawer>
  );
}
