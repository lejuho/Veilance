import { t, useI18n } from '@/lib/i18n';
import type { ReactNode } from 'react';

export function Drawer({ title, subtitle, onClose, children, inline = false }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; inline?: boolean }) {
  useI18n();
  return (
    <aside className={inline ? "flex min-h-0 flex-col rounded-xl border border-ink-600 bg-ink-850" : "absolute bottom-4 right-4 top-4 z-20 flex w-[min(420px,calc(100%-32px))] animate-fadeIn flex-col rounded-lg border border-ink-600 bg-ink-850 shadow-2xl"} aria-label={inline ? t("Verification workspace") : t("Drawer")}>
      <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-semibold">{title}</h2>
          {subtitle && <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-400">{subtitle}</div>}
        </div>
        {!inline && <button onClick={onClose} className="mt-0.5 text-ink-400 hover:text-ink-100" aria-label={t("Close")}>
          ✕
        </button>}
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-6">{children}</div>
    </aside>
  );
}
