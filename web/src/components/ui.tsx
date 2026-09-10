import { t, useI18n } from '@/lib/i18n';
import { Link, useLocation } from 'react-router-dom';
import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx, shortHex } from '@/lib/format';

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  /** Clickable but visually quiet (a Consumed lot's Transfer). */
  muted?: boolean;
}
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-ink-950 hover:bg-accent-dim disabled:bg-ink-600 disabled:text-ink-300',
  secondary: 'border border-ink-500 bg-ink-800 text-ink-100 hover:bg-ink-700 disabled:text-ink-400',
  ghost: 'bg-transparent text-ink-200 hover:bg-ink-800 disabled:text-ink-500',
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', muted, className, children, ...rest }, ref) {
  useI18n();
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-4 text-sm',
        VARIANT[variant],
        muted && 'opacity-40 hover:opacity-70',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

/* ---------- Form controls ---------- */
const CONTROL = 'h-8 w-full rounded-md border border-ink-600 bg-ink-900 px-2.5 text-[13px] text-ink-100 focus:border-accent/60 focus:outline-none disabled:opacity-50';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(function Input({ className, mono, ...rest }, ref) {
  useI18n();
  return <input ref={ref} className={cx(CONTROL, mono && 'font-mono text-xs', className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  useI18n();
  return (
    <select
      ref={ref}
      className={cx(
        CONTROL,
        'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath d=%27M3 4.5l3 3 3-3%27 fill=%27none%27 stroke=%27%238494a3%27 stroke-width=%271.5%27/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  useI18n();
  return (
    <label className={cx("block", className)}>
      <div className="mb-1 text-[11px] text-ink-300">{label}</div>
      {children}
    </label>
  );
}

/* ---------- Hash: short mono + copy on click ---------- */
export function Hash({ value, className, full }: { value?: string | null; className?: string; full?: boolean }) {
  useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  if (!value) return <span className={cx('font-mono text-xs text-ink-500', className)}>—</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
      }}
      title={t(copied ? 'Copied' : 'Copy')}
      className={cx('inline-flex items-center gap-1 rounded font-mono text-xs text-ink-200 hover:text-accent', full && 'break-all text-left', className)}
    >
      <span>{full ? value : shortHex(value)}</span>
      {copied ? <span className="text-[11px] text-accent">✓</span> : <CopyIcon />}
    </button>
  );
}

/* ---------- ↗ explorer link (keeps the drawer query so closing returns here) ---------- */
export function Explore({ tx, block, contract, className, children }: { tx?: string; block?: number; contract?: boolean; className?: string; children?: ReactNode }) {
  useI18n();
  const loc = useLocation();
  const pathname = tx ? `/explorer/tx/${tx}` : block != null ? `/explorer/block/${block}` : contract ? '/explorer/contract' : null;
  if (!pathname) return null;
  return (
    <Link to={{ pathname, search: loc.search }} className={cx('text-ink-300 hover:text-accent', className)} aria-label={t("Open in explorer")}>
      {children ?? '↗'}
    </Link>
  );
}

function CopyIcon() {
  useI18n();
  return (
    <svg className="h-3 w-3 text-ink-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
    </svg>
  );
}

/* ---------- lock: stays private ---------- */
export function Lock() {
  useI18n();
  return (
    <span title={t("never on chain")} className="inline-flex cursor-default text-ink-400" aria-label={t("never on chain")}>
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <rect x="3" y="7" width="10" height="7" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
      </svg>
    </span>
  );
}
export function LockBlock({ label }: { label: string }) {
  useI18n();
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span className="text-ink-300">{label}</span>
      <span className="inline-flex items-center gap-2" title={t("never on chain")}>
        <span className="lock-block h-3.5 w-20 rounded-sm" aria-hidden />
        <Lock />
      </span>
    </div>
  );
}

/* ---------- ✓ / ✗ / — ---------- */
export function Mark({ state }: { state: boolean | null | undefined }) {
  useI18n();
  if (state === true) return <span className="font-mono text-accent">✓</span>;
  if (state === false) return <span className="font-mono text-red">✗</span>;
  return <span className="font-mono text-ink-500">—</span>;
}

/* ---------- key / value row ---------- */
export function Row({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  useI18n();
  return (
    <div className={cx('flex items-center justify-between gap-4 py-1.5 text-[13px]', className)}>
      <span className="text-ink-300">{k}</span>
      <span className="flex items-center gap-2 text-right text-ink-100">{v}</span>
    </div>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  useI18n();
  return <h4 className="mb-1 mt-5 text-[11px] font-medium uppercase tracking-wider text-ink-400">{children}</h4>;
}

/** One-line reason under a disabled button. */
export function Reason({ children }: { children?: ReactNode }) {
  useI18n();
  if (!children) return null;
  return <p className="mt-1.5 text-[12px] text-ink-400">{children}</p>;
}

export function ErrorLine({ error }: { error?: unknown }) {
  useI18n();
  if (!error) return null;
  return <p className="mt-2 text-[13px] text-red">{(error as Error).message}</p>;
}
