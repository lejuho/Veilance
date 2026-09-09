import { Link, useLocation } from 'react-router-dom';
import { useHealth, usePolicy, useTip } from '@/hooks/queries';
import { cx, shortHex } from '@/lib/format';

export function TopBar() {
  const health = useHealth();
  const tip = useTip();
  const policy = usePolicy();
  const loc = useLocation();
  const h = health.data;
  const ok = !!h && h.ok && h.devnet.node && h.devnet.indexer && h.devnet.proofServer.ok && h.ready !== false;
  const dot = health.isError ? 'bg-red' : ok ? 'bg-accent' : 'bg-amber';
  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b border-ink-700 bg-ink-850 px-4">
      <Link to="/" className="text-[15px] font-semibold tracking-tight text-ink-100">
        Veilance
      </Link>
      <span className="flex items-center gap-2 text-xs text-ink-300">
        <span className={cx('inline-block h-2 w-2 rounded-full', dot)} />
        chain <span className="font-mono text-ink-100">{tip.data ? `#${tip.data.blockHeight}` : '—'}</span>
      </span>
      <span className="text-xs text-ink-300">
        contract{' '}
        <Link to={{ pathname: '/explorer/contract', search: loc.search }} className="font-mono text-ink-100 hover:text-accent">
          {shortHex(h?.contractAddress)}
        </Link>
      </span>
      <Link
        to={{ pathname: '/', search: '?policy=1' }}
        className={cx(
          'ml-auto rounded-full border px-3 py-1 text-xs',
          loc.search.includes('policy=1') ? 'border-accent text-accent' : 'border-ink-600 text-ink-200 hover:border-ink-400',
        )}
      >
        Policy v{policy.data?.policyVersion ?? '—'}
      </Link>
    </header>
  );
}
