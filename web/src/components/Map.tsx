import { t, useI18n } from '@/lib/i18n';
import { Fragment } from 'react';
import type { GraphAttestation, GraphEdge, NodeId } from '@/api/types';
import { GraphViewport } from './GraphViewport';
import { useGraph, usePolicy } from '@/hooks/queries';
import { useBus } from '@/lib/bus';
import { cx } from '@/lib/format';
import { STATUS_WORD, lotNumber, newestFirst, slotOf, materialName, isBackward } from '@/lib/lots';
import { NODES, PARTIES, VERIFIER, profileLabel } from '@/lib/registry';

const MAX_PILLS = 3;

function LotPill({ lot, edges, selected, flash, onClick }: { lot: GraphEdge; edges: GraphEdge[]; selected: boolean; flash: boolean; onClick: () => void }) {
  useI18n();
  const consumed = lot.status === 'CONSUMED';
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-ink-850 px-2.5 py-1 text-[12px] transition-colors',
        flash ? 'border-red bg-red-faint text-red' : selected ? 'border-accent text-ink-100' : 'border-ink-600 text-ink-200 hover:border-ink-400',
      )}
    >
      <span
        className={cx(
          'inline-block h-2 w-2 rounded-full',
          flash ? 'bg-red' : lot.status === 'DELIVERED' ? 'bg-accent' : lot.status === 'ISSUED' ? 'bg-ink-400' : 'bg-ink-600',
        )}
      />
      <span className={cx(consumed && !flash && 'text-ink-400 line-through decoration-ink-500')}>
        {isBackward(lot) ? '↩ ' : ''}{materialName(lot)} {t("· lot")}{lotNumber(edges, lot.id)} · {t(STATUS_WORD[lot.status])}
      </span>
    </button>
  );
}

function ProofPill({ att, onClick }: { att: GraphAttestation; onClick: () => void }) {
  useI18n();
  const policy = usePolicy();
  const stale = !!policy.data && String(att.policyVersion) !== String(policy.data.policyVersion);
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-ink-600 bg-ink-850 px-2.5 py-1 text-[12px] text-ink-200 hover:border-ink-400">
      <span className={cx('inline-block h-2 w-2 rounded-full', stale ? 'bg-amber' : 'bg-accent')} />
      {profileLabel(att.profile)} · v{att.policyVersion}{stale ? t(" · Re-verify") : t(" · Proof recorded")}
    </button>
  );
}

function Edge({ caption, children }: { caption: string; children: React.ReactNode[] }) {
  useI18n();
  return (
    <div className="relative flex min-w-[270px] flex-1 items-center self-stretch">
      <div className="h-px w-full bg-ink-500" />
      <span className="absolute right-0 top-1/2 -translate-y-1/2 border-y-[5px] border-l-[7px] border-y-transparent border-l-ink-500" aria-hidden />
      <div className="absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1.5">{children}</div>
      {!children.length && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0d1116] px-1.5 text-[10px] uppercase tracking-wider text-ink-500" aria-hidden>
          {caption}
        </span>
      )}
    </div>
  );
}

export function Map({
  selectedOrg,
  selectedLot,
  onOrg,
  onLot,
  onProof,
}: {
  selectedOrg: string | null;
  selectedLot: string | null;
  onOrg: (id: NodeId) => void;
  onLot: (id: string) => void;
  onProof: (challenge?: string) => void;
}) {
  useI18n();
  const graph = useGraph();
  const { flash } = useBus();
  const edges = graph.data?.edges ?? [];
  const atts = [...(graph.data?.attestations ?? [])].reverse();
  const running = graph.data?.activeJob?.party;
  if (graph.isError) return <div className="m-auto p-6 text-sm text-ink-300">{t("Unable to load the supply chain.")}<button className="text-accent underline" onClick={() => graph.refetch()}>{t("Try again")}</button></div>;
  if (graph.isPending) return <div className="m-auto p-6 text-sm text-ink-300">{t("Loading inventory and proof records…")}</div>;
  const pillsFor = (slot: number) => {
    if (slot === NODES.length - 2) {
      const shown = atts.slice(0, MAX_PILLS).map((a, i) => <ProofPill key={a.attestationKey + i} att={a} onClick={() => onProof(a.challenge)} />);
      if (atts.length > MAX_PILLS) shown.push(<More key="more" n={atts.length - MAX_PILLS} onClick={() => onProof()} />);
      return shown;
    }
    const lots = newestFirst(edges.filter((e) => slotOf(e) === slot));
    const shown = lots
      .slice(0, MAX_PILLS)
      .map((l) => <LotPill key={l.id} lot={l} edges={edges} selected={selectedLot === l.id} flash={flash?.lotId === l.id} onClick={() => onLot(l.id)} />);
    if (lots.length > MAX_PILLS) shown.push(<More key="more" n={lots.length - MAX_PILLS} onClick={() => onOrg(lots[0].to)} />);
    return shown;
  };
  return (
    <GraphViewport width={NODES.length * 210 + (NODES.length - 1) * 290}>
    <div className="flex h-[140px] items-center">
      {NODES.map((id, i) => {
        const node = graph.data?.nodes.find((n) => n.id === id);
        const verifier = id === 'verifier';
        const meta = verifier ? VERIFIER : PARTIES[id];
        const issued = id === 'mine' ? edges.filter((e) => e.from === 'mine').length : 0;
        return (
          <Fragment key={id}>
            {i > 0 && <Edge caption={verifier ? 'proof' : 'lot'}>{pillsFor(i - 1)}</Edge>}
            <button
              onClick={() => onOrg(id)}
              aria-pressed={selectedOrg === id}
              className={cx(
                'w-[210px] shrink-0 rounded-lg border bg-ink-850 p-4 text-left transition-colors',
                selectedOrg === id ? 'border-accent' : 'border-ink-600 hover:border-ink-400',
                running === id && 'animate-soft border-amber/70',
              )}
            >
              <div className="text-[16px] font-semibold leading-tight">{node?.org ?? meta.org}</div>
              <div className="text-[12px] text-ink-400">{id === 'mine' ? t("01 · Extract raw materials") : id === 'refiner' ? t("02 · Refine materials") : id === 'batteryMfr' ? t("03 · Make batteries") : t("04 · Verify before buying")}</div>
              <div className="mt-3 flex items-center justify-between text-[12px]">
                {verifier ? (
                  <span className="text-ink-200">{node ? node.attestations : '—'} {t("recorded proofs")}</span>
                ) : (
                  <>
                    <span className={node?.certified ? 'text-accent' : 'text-ink-400'}>{node ? (node.certified ? t("✓ Policy-listed") : t("Not policy-listed")) : t("Loading…")}</span>
                    <span className="text-ink-300">{id === 'mine' ? t("{count} lots issued", { count: issued }) : t("{count} lots held", { count: node?.held ?? "—" })}</span>
                  </>
                )}
              </div>
            </button>
          </Fragment>
        );
      })}
    </div>
    </GraphViewport>
  );
}

function More({ n, onClick }: { n: number; onClick: () => void }) {
  useI18n();
  return (
    <button onClick={onClick} className="rounded-full border border-ink-600 bg-ink-850 px-2 py-0.5 text-[11px] text-ink-300 hover:border-ink-400">
      +{n}
    </button>
  );
}
