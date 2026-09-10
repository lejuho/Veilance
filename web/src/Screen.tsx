import { t, useI18n } from '@/lib/i18n';
import { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { PartyName } from './api/types';
import { ExplorerModal } from './components/ExplorerModal';
import { Map } from './components/Map';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';
import { LotDrawer } from './components/drawers/LotDrawer';
import { OrgDrawer } from './components/drawers/OrgDrawer';
import { PolicyDrawer } from './components/drawers/PolicyDrawer';
import { VerifierDrawer } from './components/drawers/VerifierDrawer';
import { CHAIN, orgName } from './lib/registry';
import { WorkspaceHome } from './components/WorkspaceHome';
import { DirectFlow } from './components/DirectFlow';
import { Select } from './components/ui';
import { useWorkspace, WorkspaceSwitchContext, type Workspace } from './lib/workspace';

/** The one screen. Drawer state lives in the query string; the explorer modal in the path. */
export function Screen({ explorer }: { explorer?: 'tx' | "block" | "contract" }) {
  useI18n();
  const viewer = useWorkspace();
  const switchViewer = useContext(WorkspaceSwitchContext);
  const [tab, setTab] = useState<'home' | 'flow'>('home');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const loc = useLocation();
  const route = useParams();
  const org = params.get('org');
  const lot = params.get('lot');
  const policy = params.get('policy');
  const req = params.get('req');
  const go = (search: string) => navigate({ pathname: '/', search });
  const close = () => go('');
  const closeExplorer = () => navigate({ pathname: '/', search: loc.search });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (explorer) closeExplorer();
      else if (org || lot || policy) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const drawer = policy && viewer === 'admin' ? (
    <PolicyDrawer onClose={close} />
  ) : lot && viewer !== 'verifier' ? (
    <LotDrawer id={lot} onClose={close} requestCode={req} />
  ) : org === 'verifier' && viewer === 'admin' ? (
    <VerifierDrawer req={req} onClose={close} />
  ) : org && CHAIN.includes(org as PartyName) && (viewer === 'admin' || viewer === org) ? (
    <OrgDrawer id={org as PartyName} onClose={close} />
  ) : null;

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="map-bg relative min-h-0 flex-1 overflow-hidden">
        <div className={`flex h-full min-w-0 flex-col ${drawer ? 'md:mr-[452px]' : ''}`}>
          <div className="border-b border-ink-700 px-5 pb-4 pt-5 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs text-ink-400">{viewer === 'admin' ? t("통합 운영 · 전체 공급망") : orgName(viewer)}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{viewer === 'verifier' ? t("공급사 검증") : viewer === 'admin' ? t("공급망 운영") : t("내 재고와 할 일")}</h1><p className="mt-2 text-sm text-ink-300">{viewer === 'verifier' ? t("공급사의 상세 재고를 받지 않고 구매 기준 충족 여부를 확인하세요.") : viewer === 'admin' ? t("시연용 전체 보기입니다. 여러 회사의 운영 정보를 함께 표시합니다.") : t("받은 재료를 확인하고, 구매사의 증명 요청에 응답하세요.")}</p></div>
              <label className="w-48"><span className="mb-1 block text-[11px] text-ink-400">{t("데모 보기 전환")}</span><Select aria-label={t("데모 보기 전환")} value={viewer} onChange={e => { switchViewer(e.target.value as Workspace); setTab('home'); close(); }}>
                {([...CHAIN, 'verifier', 'admin'] as Workspace[]).map(id => <option key={id} value={id}>{id === 'admin' ? t("통합 운영 (데모)") : orgName(id)}</option>)}
              </Select></label>
            </div>
            {viewer !== 'admin' && viewer !== 'verifier' && <div className="mt-5 flex gap-2" role="group" aria-label={t("업무 화면")}><button aria-pressed={tab === 'home'} onClick={() => setTab('home')} className={`rounded-lg px-4 py-2 text-sm ${tab === 'home' ? 'bg-ink-700 text-ink-100' : 'text-ink-400'}`}>{t("내 재고 · 할 일")}</button><button aria-pressed={tab === 'flow'} onClick={() => setTab('flow')} className={`rounded-lg px-4 py-2 text-sm ${tab === 'flow' ? 'bg-ink-700 text-ink-100' : 'text-ink-400'}`}>{t("내 거래 흐름")}</button><button onClick={() => go(`?org=${viewer}`)} className="ml-auto text-xs text-ink-400">{t("회사 설정")}</button></div>}
          </div>
        {viewer === 'admin' ? (
        <Map
          selectedOrg={policy ? null : org}
          selectedLot={lot}
          onOrg={(id) => go(`?org=${id}`)}
          onLot={(id) => go(`?lot=${encodeURIComponent(id)}`)}
          onProof={(challenge) => go(challenge ? `?org=verifier&req=${challenge}` : '?org=verifier')}
        />
        ) : viewer !== 'verifier' && tab === 'flow' ? <DirectFlow /> : <div className="min-h-0 flex-1 overflow-y-auto"><WorkspaceHome key={viewer} req={req} /></div>}
        </div>
        {drawer}
      </div>
      <StatusBar key={viewer} />
      {explorer && viewer === 'admin' && <ExplorerModal kind={explorer} value={route.hash ?? route.height} onClose={closeExplorer} />}
    </div>
  );
}
