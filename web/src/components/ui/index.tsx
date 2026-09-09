import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx, truncHex } from '@/lib/format';

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-ink-950 hover:bg-accent-dim disabled:bg-ink-600 disabled:text-ink-300',
  secondary: 'bg-ink-700 text-ink-100 hover:bg-ink-600 border border-ink-600 disabled:text-ink-400',
  ghost: 'bg-transparent text-ink-200 hover:bg-ink-800 disabled:text-ink-500',
  danger: 'bg-danger-faint text-danger border border-danger/40 hover:bg-danger/20 disabled:opacity-50',
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        size === 'sm' ? 'h-8 px-3 text-xs' : size === 'lg' ? 'h-11 px-5 text-sm' : 'h-9 px-4 text-sm',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('h-3.5 w-3.5 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Card ---------- */
export function Card({ className, children, title, subtitle, actions }: { className?: string; children?: ReactNode; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx('rounded-lg border border-ink-700 bg-ink-850', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-300">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ---------- Badge ---------- */
type Tone = 'neutral' | 'accent' | 'danger' | 'warn' | 'muted';
const TONE: Record<Tone, string> = {
  neutral: 'border-ink-600 text-ink-200 bg-ink-800',
  accent: 'border-accent/40 text-accent bg-accent-faint',
  danger: 'border-danger/40 text-danger bg-danger-faint',
  warn: 'border-warn/40 text-warn bg-warn-faint',
  muted: 'border-ink-700 text-ink-400 bg-transparent',
};
export function Badge({ tone = 'neutral', children, className, mono, title }: { tone?: Tone; children: ReactNode; className?: string; mono?: boolean; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4 tracking-wide', mono && 'font-mono', TONE[tone], className)}>
      {children}
    </span>
  );
}

/* ---------- Form controls ---------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(function Input({ className, mono, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        'h-9 w-full rounded-md border border-ink-600 bg-ink-900 px-3 text-sm text-ink-100 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none disabled:opacity-50',
        mono && 'font-mono text-xs',
        className,
      )}
      {...rest}
    />
  );
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cx(
        'h-9 w-full appearance-none rounded-md border border-ink-600 bg-ink-900 bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath d=%27M3 4.5l3 3 3-3%27 fill=%27none%27 stroke=%27%238494a3%27 stroke-width=%271.5%27/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_10px_center] bg-no-repeat px-3 pr-8 text-sm text-ink-100 focus:border-accent/60 focus:outline-none disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
export function Field({ label, hint, children, locked }: { label: ReactNode; hint?: ReactNode; children: ReactNode; locked?: boolean }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-ink-300">
        <span>{label}</span>
        {locked && <LockTag />}
      </div>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-400">{hint}</p>}
    </label>
  );
}

/** "🔒 off-chain" marker from spec.md: value is shown here but never goes on chain. */
export function LockTag({ children = 'off-chain' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-ink-600 px-1 py-px text-[10px] uppercase tracking-wider text-ink-400" title="Shown in this UI only. Never written to the ledger.">
      <LockIcon className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}
export function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/* ---------- Hash: truncated mono + copy-on-click ---------- */
export function Hash({ value, head = 8, tail = 4, className, label }: { value?: string | null; head?: number; tail?: number; className?: string; label?: string }) {
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
      title={`${label ? label + ': ' : ''}${value}\n(click to copy)`}
      className={cx('group inline-flex items-center gap-1 rounded font-mono text-xs text-ink-200 hover:text-accent', className)}
    >
      <span>{truncHex(value, head, tail)}</span>
      <span className={cx('text-[10px] transition-opacity', copied ? 'text-accent opacity-100' : 'text-ink-500 opacity-0 group-hover:opacity-100')}>
        {copied ? 'copied' : 'copy'}
      </span>
    </button>
  );
}

/* ---------- PRIVATE redaction block: the product's whole point ---------- */
export function Private({ label, className, width = 'w-24' }: { label?: string; className?: string; width?: string }) {
  return (
    <span
      className={cx('inline-flex items-center gap-2 align-middle', className)}
      title="This value exists only in the holder's private state. It is not on chain and not disclosed."
    >
      <span className={cx('h-4 rounded-sm bg-[repeating-linear-gradient(90deg,#3c4a58_0_6px,#2a3541_6px_8px)]', width)} aria-hidden />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300">{label ?? 'private'}</span>
    </span>
  );
}

/* ---------- Key/value list ---------- */
export function KV({ rows, className }: { rows: { k: ReactNode; v: ReactNode }[]; className?: string }) {
  return (
    <dl className={cx('divide-y divide-ink-700/70', className)}>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-2 text-sm">
          <dt className="text-ink-300">{r.k}</dt>
          <dd className="text-right text-ink-100">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose} role="dialog" aria-modal>
      <div className="w-full max-w-lg animate-fadeIn rounded-lg border border-ink-600 bg-ink-850 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-100" aria-label="Close">
            ✕
          </button>
        </header>
        <div className="p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-ink-700 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- Banner ---------- */
export function Banner({ tone = 'neutral', title, children, className }: { tone?: 'danger' | 'warn' | 'accent' | 'neutral'; title?: ReactNode; children?: ReactNode; className?: string }) {
  const t =
    tone === 'danger'
      ? 'border-danger/50 bg-danger-faint text-danger'
      : tone === 'warn'
        ? 'border-warn/50 bg-warn-faint text-warn'
        : tone === 'accent'
          ? 'border-accent/50 bg-accent-faint text-accent'
          : 'border-ink-600 bg-ink-800 text-ink-200';
  return (
    <div className={cx('rounded-md border px-4 py-3 text-sm', t, className)} role={tone === 'danger' ? 'alert' : undefined}>
      {title && <div className="font-semibold">{title}</div>}
      {children && <div className={cx(title ? 'mt-1' : '', 'text-[13px] opacity-90')}>{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-ink-400">{children}</div>;
}

export function Check({ state }: { state: 'ok' | 'fail' | 'pending' | 'na' }) {
  if (state === 'ok') return <span className="font-mono text-accent">✓</span>;
  if (state === 'fail') return <span className="font-mono text-danger">✗</span>;
  if (state === 'pending') return <span className="inline-block h-2 w-2 animate-pulseDot rounded-full bg-ink-400" />;
  return <span className="font-mono text-ink-500">—</span>;
}
