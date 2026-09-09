import { useEffect } from 'react';
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
import { CHAIN } from './lib/registry';

/** The one screen. Drawer state lives in the query string; the explorer modal in the path. */
export function Screen({ explorer }: { explorer?: 'tx' | 'block' | 'contract' }) {
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

  const drawer = policy ? (
    <PolicyDrawer onClose={close} />
  ) : lot ? (
    <LotDrawer id={lot} onClose={close} />
  ) : org === 'verifier' ? (
    <VerifierDrawer req={req} onClose={close} />
  ) : org && CHAIN.includes(org as PartyName) ? (
    <OrgDrawer id={org as PartyName} onClose={close} />
  ) : null;

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="map-bg relative min-h-0 flex-1 overflow-hidden">
        <Map
          selectedOrg={policy ? null : org}
          selectedLot={lot}
          onOrg={(id) => go(`?org=${id}`)}
          onLot={(id) => go(`?lot=${encodeURIComponent(id)}`)}
          onProof={(challenge) => go(challenge ? `?org=verifier&req=${challenge}` : '?org=verifier')}
        />
        {drawer}
      </div>
      <StatusBar />
      {explorer && <ExplorerModal kind={explorer} value={route.hash ?? route.height} onClose={closeExplorer} />}
    </div>
  );
}
