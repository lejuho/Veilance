import type { DisclosureOp, DisclosurePreview as DP, PartyName, Profile } from '@/api/types';
import { useDisclosure } from '@/hooks/queries';
import { LockIcon } from './ui';
import { cx } from '@/lib/format';

/** Two columns — "Goes on chain" / "Stays private" — shown before every submit (spec.md FR-I-05, FR-T-08). */
export function DisclosurePreview({ party, op, profile, extraPublic, extraPrivate, className }: { party: PartyName | null; op: DisclosureOp; profile?: Profile; extraPublic?: string[]; extraPrivate?: string[]; className?: string }) {
  const q = useDisclosure(party, op, profile);
  const d: DP = q.data ?? { public: [], private: [] };
  const pub = [...d.public, ...(extraPublic ?? [])];
  const priv = [...d.private, ...(extraPrivate ?? [])];
  return (
    <div className={cx('rounded-lg border border-ink-700', className)}>
      <div className="border-b border-ink-700 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-300">Disclosure preview</div>
      <div className="grid grid-cols-1 divide-y divide-ink-700 md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-100">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" /> Goes on chain
          </div>
          <ul className="space-y-1.5 text-[13px] text-ink-200">
            {pub.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-ink-500">·</span>
                <span>{p}</span>
              </li>
            ))}
            {!pub.length && <li className="text-ink-500">{q.isLoading ? 'Loading…' : 'Nothing'}</li>}
          </ul>
        </div>
        <div className="bg-ink-900/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-100">
            <LockIcon className="h-3 w-3 text-ink-300" /> Stays private
          </div>
          <ul className="space-y-1.5 text-[13px] text-ink-200">
            {priv.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="inline-block h-3 w-8 shrink-0 translate-y-1 rounded-sm bg-[repeating-linear-gradient(90deg,#3c4a58_0_5px,#2a3541_5px_7px)]" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
            {!priv.length && <li className="text-ink-500">{q.isLoading ? 'Loading…' : 'Nothing'}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
