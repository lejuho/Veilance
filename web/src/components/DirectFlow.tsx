import { t, useI18n } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import { useGraph } from '@/hooks/queries';
import { useWorkspace } from '@/lib/workspace';
import { orgName } from '@/lib/registry';
import { lotTitle } from '@/lib/lots';
import { GraphViewport } from './GraphViewport';

export function DirectFlow() {
  useI18n();
  const graph = useGraph();
  const viewer = useWorkspace();
  const navigate = useNavigate();
  const edges = graph.data?.edges ?? [];
  if (graph.isPending) return <p className="m-auto text-sm text-ink-400">{t("거래 기록을 불러오는 중…")}</p>;
  if (graph.isError) return <p className="m-auto text-sm text-red">{t("거래 기록을 불러오지 못했습니다.")}</p>;
  if (!edges.length && !graph.data?.attestations.length) return <p className="m-auto p-8 text-sm text-ink-400">{t("아직 표시할 거래가 없습니다. 재료를 받거나 보내면 여기에 나타납니다.")}</p>;
  return <GraphViewport width={950} height={Math.min(420, 100 + edges.length * 92 + (graph.data?.attestations.length ? 64 : 0))}>
    <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-6">
      <p className="mb-4 text-xs text-ink-400">{t("내 회사가 참여한 직접 거래만 표시합니다. 각 줄은 하나의 전달 기록입니다.")}</p>
      {edges.map(e => <div key={e.id} className="flex items-center gap-4">
        <div className={`w-56 shrink-0 rounded-xl border p-4 ${e.from === viewer ? 'border-accent bg-ink-800' : 'border-ink-600 bg-ink-850'}`}><p className="text-sm font-semibold">{orgName(e.from)}</p><p className="mt-1 text-xs text-ink-400">{e.from === viewer ? t("우리 회사 · 보냄") : t("직접 거래처 · 보냄")}</p></div>
        <button onClick={() => navigate(`/?lot=${encodeURIComponent(e.id)}`)} className="flex-1 rounded-full border border-ink-600 px-3 py-2 text-xs text-ink-200 hover:border-accent">{lotTitle(edges, e)} →</button>
        <div className={`w-56 shrink-0 rounded-xl border p-4 ${e.to === viewer ? 'border-accent bg-ink-800' : 'border-ink-600 bg-ink-850'}`}><p className="text-sm font-semibold">{orgName(e.to)}</p><p className="mt-1 text-xs text-ink-400">{e.to === viewer ? t("우리 회사 · 받음") : t("직접 거래처 · 받음")}</p></div>
      </div>)}
      {!!graph.data?.attestations.length && <div className="flex items-center justify-between rounded-xl border border-ink-600 p-4 text-sm"><span>{orgName(viewer)} → OEM</span><span className="text-ink-300">{t("증명 기록")}{graph.data.attestations.length}{t("건 · 재료 전달이 아닌 검사 결과")}</span></div>}
    </div>
  </GraphViewport>;
}
