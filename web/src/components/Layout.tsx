import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getApi } from '@/api/client';
import type { Role } from '@/api/types';
import { useHealth, useLedger } from '@/hooks/queries';
import { cx } from '@/lib/format';
import { ROLES } from '@/lib/registry';
import { useRole } from '@/state/role';
import { Badge, Banner, Hash } from './ui';
import { useQueryClient } from '@tanstack/react-query';
import { DemoBar } from '@/pages/Demo';

const NAV: { to: string; label: string; roles: Role[] }[] = [
  { to: '/', label: 'Dashboard', roles: ['admin', 'mine', 'refiner', 'batteryMfr', 'verifier'] },
  { to: '/admin/policy', label: 'Policy', roles: ['admin', 'mine', 'refiner', 'batteryMfr', 'verifier'] },
  { to: '/issue', label: 'Issue', roles: ['mine'] },
  { to: '/credentials', label: 'Credentials', roles: ['mine', 'refiner', 'batteryMfr'] },
  { to: '/verify', label: 'Verify', roles: ['verifier'] },
  { to: '/demo', label: 'Demo', roles: ['admin', 'mine', 'refiner', 'batteryMfr', 'verifier'] },
];

function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#0f1318" stroke="#2a3541" />
        <path d="M8 9l8 14 8-14" fill="none" stroke="#6ee7d8" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-ink-100">Veilance</div>
        <div className="hidden text-[11px] text-ink-400 sm:block">Prove the chain. Keep the chain private.</div>
      </div>
    </div>
  );
}

function Health() {
  const h = useHealth();
  const api = getApi();
  const booting = h.data?.ready === false;
  const ok = !!h.data?.ok && !booting;
  const partial = h.data && !ok && (h.data.devnet.node || h.data.devnet.indexer);
  const tone = h.isError ? 'bg-danger' : booting ? 'bg-warn animate-pulseDot' : ok ? 'bg-accent' : partial ? 'bg-warn' : 'bg-ink-500';
  const label = h.isError
    ? 'agent unreachable'
    : !h.data
      ? 'connecting'
      : booting
        ? `agent starting… ${h.data.step ?? ''}`
        : api.mode === 'mock'
          ? 'mock devnet'
          : ok
            ? 'devnet'
            : 'devnet degraded';
  const title = h.data
    ? `node ${h.data.devnet.node ? 'ok' : 'down'} · indexer ${h.data.devnet.indexer ? 'ok' : 'down'} · proof server ${h.data.devnet.proofServer.ok ? 'ok' : 'down'} ${h.data.devnet.proofServer.version ?? ''}${api.baseUrl ? `\n${api.baseUrl}` : ''}`
    : h.error?.message;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-300" title={title}>
      <span className={cx('inline-block h-2 w-2 rounded-full', tone, ok && 'shadow-[0_0_8px_rgba(110,231,216,0.7)]')} />
      {label}
    </span>
  );
}

function RoleSwitcher() {
  const { role, setRole } = useRole();
  const nav = useNavigate();
  return (
    <div className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-900 p-0.5" role="radiogroup" aria-label="Active party">
      {ROLES.map((r) => (
        <button
          key={r.id}
          role="radio"
          aria-checked={role === r.id}
          title={r.hint}
          onClick={() => {
            setRole(r.id);
            // Land on a page that exists for this role.
            const path = window.location.pathname;
            const allowed = NAV.find((n) => n.to === path)?.roles;
            if (allowed && !allowed.includes(r.id)) nav('/');
          }}
          className={cx(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            role === r.id ? 'bg-ink-700 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-200',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/** Shown while the agent is booting (health.ready === false), failed to boot, or is unreachable. */
function AgentStatus() {
  const h = useHealth();
  const api = getApi();
  if (h.isError)
    return (
      <Banner tone="danger" className="mb-5" title="Party agent unreachable">
        {api.baseUrl ?? 'agent'} — {(h.error as Error).message}. Start it with <code className="font-mono">cd agent && npm run dev</code>, or unset <code className="font-mono">VITE_API_URL</code> for mock mode.
      </Banner>
    );
  if (h.data?.bootError)
    return (
      <Banner tone="danger" className="mb-5" title="Party agent failed to start">
        <span className="font-mono text-xs">{h.data.bootError}</span>
      </Banner>
    );
  if (h.data?.ready === false)
    return (
      <Banner tone="warn" className="mb-5" title="Agent starting…">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulseDot rounded-full bg-warn" />
          Building wallets, DUST and providers for the four parties (up to ~60 s on a cold start). Step: <span className="font-mono">{h.data.step ?? '…'}</span>
        </span>
      </Banner>
    );
  if (h.data && !h.data.deployed)
    return (
      <Banner tone="warn" className="mb-5" title="Contract not deployed">
        The agent is ready but has no contract address. An admin needs to POST /deploy.
      </Banner>
    );
  return null;
}

export function Layout() {
  const { role } = useRole();
  const ledger = useLedger();
  const health = useHealth();
  const api = getApi();
  const qc = useQueryClient();
  const contract = ledger.data?.contractAddress ?? health.data?.contractAddress;
  return (
    <div className="min-h-screen bg-ink-900 text-ink-100">
      <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <NavLink to="/" className="shrink-0">
            <Wordmark />
          </NavLink>
          <RoleSwitcher />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Health />
            <span className="text-ink-600">|</span>
            <Badge tone="neutral" mono title="policyVersion">
              policy v{ledger.data?.policyVersion ?? '…'}
            </Badge>
            <Badge tone="neutral" mono title="carbonThreshold">
              carbon ≤ {ledger.data?.carbonThreshold ?? '…'}
            </Badge>
            <span className="hidden items-center gap-1 text-ink-400 md:inline-flex">
              contract <Hash value={contract} label="contract address" />
            </span>
            {api.mode === 'mock' && api.resetMock && (
              <button
                onClick={() => {
                  if (confirm('Reset the mock chain? All simulated state will be wiped.')) {
                    api.resetMock!();
                    qc.invalidateQueries();
                  }
                }}
                className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400 hover:text-ink-200"
                title="Mock mode: wipe the simulated chain"
              >
                reset mock
              </button>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-2">
          {NAV.filter((n) => n.roles.includes(role)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                cx('rounded px-2.5 py-1 text-xs font-medium', isActive ? 'bg-accent-faint text-accent' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100')
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24">
        <AgentStatus />
        <Outlet />
      </main>
      <DemoBar />
      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-[11px] text-ink-500">
        {api.mode === 'mock' ? (
          <>
            Mock adapter — no agent connected. Set <code className="font-mono">VITE_API_URL</code> to talk to a party agent (agent/API.md).
          </>
        ) : (
          <>
            Party agent at <code className="font-mono">{api.baseUrl}</code>
          </>
        )}
      </footer>
    </div>
  );
}
