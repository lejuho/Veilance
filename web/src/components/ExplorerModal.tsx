import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useExplorerBlock, useExplorerContract, useExplorerTx, useLedgerRaw } from '@/hooks/queries';
import { cx, fmtTime, shortHex } from '@/lib/format';
import { orgName } from '@/lib/registry';
import { Hash, Row } from './ui';

type Kind = 'tx' | 'block' | 'contract';

function external(value: string | undefined, address?: string): string | null {
  const t = import.meta.env.VITE_EXPLORER_URL_TEMPLATE as string | undefined;
  if (!t || (!value && !address)) return null;
  return t.replace('{hash}', value ?? '').replace('{height}', value ?? '').replace('{address}', address ?? '');
}

function TxView({ hash }: { hash: string }) {
  const q = useExplorerTx(hash);
  const loc = useLocation();
  const tx = q.data;
  if (q.isError) return <p className="text-[13px] text-red">{q.error.message}</p>;
  if (!tx) return <p className="text-[13px] text-ink-500">…</p>;
  const action = tx.contractActions[0];
  return (
    <>
      <Row k="Hash" v={<Hash value={tx.hash} full />} />
      <Row
        k="Block"
        v={
          <>
            <Link to={{ pathname: `/explorer/block/${tx.blockHeight}`, search: loc.search }} className="font-mono text-xs text-ink-100 hover:text-accent">
              {tx.blockHeight}
            </Link>
            <span className="text-ink-400">· {fmtTime(tx.timestamp)}</span>
          </>
        }
      />
      <Row
        k="Contract"
        v={
          <>
            <Link to={{ pathname: '/explorer/contract', search: loc.search }} className="font-mono text-xs text-ink-100 hover:text-accent">
              {shortHex(action?.address)}
            </Link>
            <span className="text-ink-400">· {action?.kind ?? '—'}</span>
            {(tx.circuit || tx.party) && (
              <span className="text-ink-400">
                · {tx.circuit ?? action?.entryPoint} {tx.party && `· ${orgName(tx.party)}`}
              </span>
            )}
          </>
        }
      />
      <Raw data={tx} />
    </>
  );
}

function BlockView({ height }: { height: number }) {
  const q = useExplorerBlock(height);
  const loc = useLocation();
  const b = q.data;
  if (q.isError) return <p className="text-[13px] text-red">{q.error.message}</p>;
  if (!b) return <p className="text-[13px] text-ink-500">…</p>;
  return (
    <>
      <Row k="Hash" v={<Hash value={b.hash} full />} />
      <Row k="Time" v={fmtTime(b.timestamp)} />
      <Row k="Transactions" v={b.txCount} />
      <div className="mt-1 space-y-1">
        {b.txHashes.map((h) => (
          <Link key={h} to={{ pathname: `/explorer/tx/${h}`, search: loc.search }} className="block font-mono text-xs text-ink-200 hover:text-accent">
            {h}
          </Link>
        ))}
      </div>
      <Raw data={b} />
    </>
  );
}

function ContractView() {
  const [tab, setTab] = useState<'contract' | 'ledger'>('contract');
  const c = useExplorerContract(true);
  const l = useLedgerRaw(tab === 'ledger');
  const loc = useLocation();
  return (
    <>
      <div className="mb-3 flex gap-1 border-b border-ink-700 text-[13px]">
        {(['contract', 'ledger'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx('-mb-px border-b-2 px-3 py-1.5 capitalize', tab === t ? 'border-accent text-ink-100' : 'border-transparent text-ink-400 hover:text-ink-200')}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'contract' &&
        (c.isError ? (
          <p className="text-[13px] text-red">{c.error.message}</p>
        ) : !c.data ? (
          <p className="text-[13px] text-ink-500">…</p>
        ) : (
          <>
            <Row k="Address" v={<Hash value={c.data.address} full />} />
            <Row
              k="Deployed"
              v={
                c.data.deployBlockHeight != null ? (
                  <Link to={{ pathname: `/explorer/block/${c.data.deployBlockHeight}`, search: loc.search }} className="font-mono text-xs hover:text-accent">
                    block {c.data.deployBlockHeight}
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <Row k="Actions" v={c.data.actionCount} />
            <div className="mt-1 max-h-64 divide-y divide-ink-700/60 overflow-y-auto rounded-md border border-ink-700">
              {c.data.actions.map((a) => (
                <Link
                  key={a.txHash}
                  to={{ pathname: `/explorer/tx/${a.txHash}`, search: loc.search }}
                  className="flex items-center gap-3 px-3 py-1.5 text-[12px] hover:bg-ink-800"
                >
                  <span className="w-14 font-mono text-ink-300">{a.blockHeight}</span>
                  <span className="flex-1 font-mono text-ink-100">{a.circuit ?? a.entryPoint ?? a.kind}</span>
                  <span className="text-ink-400">{a.party ? orgName(a.party) : ''}</span>
                </Link>
              ))}
            </div>
          </>
        ))}
      {tab === 'ledger' &&
        (l.isError ? (
          <p className="text-[13px] text-red">{l.error.message}</p>
        ) : !l.data ? (
          <p className="text-[13px] text-ink-500">…</p>
        ) : (
          <div className="divide-y divide-ink-700/60">
            {Object.entries(l.data)
              .filter(([, v]) => ['number', 'string', 'boolean'].includes(typeof v))
              .map(([k, v]) => (
                <Row key={k} k={<span className="font-mono text-xs">{k}</span>} v={typeof v === 'string' && /^[0-9a-f]{32,}$/i.test(v) ? <Hash value={v} /> : <span className="font-mono text-xs">{String(v)}</span>} />
              ))}
          </div>
        ))}
    </>
  );
}

function Raw({ data }: { data: unknown }) {
  return (
    <details className="mt-3 text-[12px]">
      <summary className="cursor-pointer select-none text-ink-400">Raw</summary>
      <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-ink-700 bg-ink-900 p-3 font-mono text-[11px] text-ink-200">{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

export function ExplorerModal({ kind, value, onClose }: { kind: Kind; value?: string; onClose: () => void }) {
  const title = kind === 'tx' ? 'Transaction' : kind === 'block' ? `Block ${value}` : 'Contract';
  const ext = external(value);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose} role="dialog" aria-modal>
      <div className="w-full max-w-xl animate-fadeIn rounded-lg border border-ink-600 bg-ink-850 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <div className="flex items-center gap-4">
            {ext && (
              <a href={ext} target="_blank" rel="noreferrer" className="text-xs text-ink-300 hover:text-accent">
                Open in external explorer ↗
              </a>
            )}
            <button onClick={onClose} className="text-ink-400 hover:text-ink-100" aria-label="Close">
              ✕
            </button>
          </div>
        </header>
        <div className="p-5">
          {kind === 'tx' && value && <TxView hash={value} />}
          {kind === 'block' && value && <BlockView height={Number(value)} />}
          {kind === 'contract' && <ContractView />}
        </div>
      </div>
    </div>
  );
}
