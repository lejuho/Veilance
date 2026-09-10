import { t, useI18n } from '@/lib/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const clamp = (n: number) => Math.max(0.15, Math.min(2, n));

/** Camera coordinates stay separate from the supply-chain data. */
export function GraphViewport({ children, width, height = 140 }: { children: ReactNode; width: number; height?: number }) {
  useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const fit = () => {
    const el = host.current;
    if (!el) return;
    const scale = clamp(Math.min(1, (el.clientWidth - 64) / width, (el.clientHeight - 100) / height));
    setView({ x: (el.clientWidth - width * scale) / 2, y: el.clientHeight / 2 - height * scale / 2, scale });
  };
  useEffect(() => {
    const el = host.current!;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setView(v => {
        if (e.shiftKey) return { ...v, x: v.x - e.deltaY, y: v.y - e.deltaX };
        const scale = clamp(v.scale * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.04 : 0.002)));
        const ratio = scale / v.scale;
        return { x: x - (x - v.x) * ratio, y: y - (y - v.y) * ratio, scale };
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); el.removeEventListener('wheel', wheel); };
  }, [width, height]);
  const zoom = (factor: number) => {
    const el = host.current!;
    setView(v => {
      const scale = clamp(v.scale * factor);
      return { x: el.clientWidth / 2 - (el.clientWidth / 2 - v.x) * scale / v.scale, y: el.clientHeight / 2 - (el.clientHeight / 2 - v.y) * scale / v.scale, scale };
    });
  };
  return (
    <div className="relative min-h-0 flex-1">
      <div ref={host} tabIndex={0} role="region" aria-label={t("Supply chain graph. Drag to pan, scroll to zoom. Arrow keys move the view; plus and minus zoom; Home fits all.")}
        className="absolute inset-0 touch-none overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent cursor-grab active:cursor-grabbing"
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          const moves: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
          if (moves[e.key]) { e.preventDefault(); const [x, y] = moves[e.key]; setView(v => ({ ...v, x: v.x + x, y: v.y + y })); }
          if (e.key === '+' || e.key === '=') zoom(1.2);
          if (e.key === '-') zoom(1 / 1.2);
          if (e.key === 'Home') { e.preventDefault(); fit(); }
        }}
        onPointerDown={e => {
          if (e.button !== 0 || (e.target as HTMLElement).closest('button, a')) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          const old = pointers.current.get(e.pointerId);
          if (!old) return;
          const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
          const next = { x: e.clientX, y: e.clientY };
          pointers.current.set(e.pointerId, next);
          const rect = e.currentTarget.getBoundingClientRect();
          setView(v => {
            if (!other) return { ...v, x: v.x + next.x - old.x, y: v.y + next.y - old.y };
            const before = Math.hypot(old.x - other.x, old.y - other.y);
            const after = Math.hypot(next.x - other.x, next.y - other.y);
            const scale = clamp(v.scale * after / Math.max(1, before));
            const x = (old.x + other.x) / 2 - rect.left;
            const y = (old.y + other.y) / 2 - rect.top;
            return { scale, x: x + (next.x - old.x) / 2 - (x - v.x) * scale / v.scale, y: y + (next.y - old.y) / 2 - (y - v.y) * scale / v.scale };
          });
        }}
        onLostPointerCapture={e => pointers.current.delete(e.pointerId)}
        onPointerUp={e => pointers.current.delete(e.pointerId)}
        onPointerCancel={e => pointers.current.delete(e.pointerId)}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>{children}</div>
      </div>
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-ink-600 bg-ink-850 p-1.5 text-xs shadow-xl">
        <button className="h-8 w-8 rounded hover:bg-ink-700" aria-label={t("Zoom out")} onClick={() => zoom(1 / 1.2)}>−</button>
        <span className="w-12 text-center tabular-nums text-ink-300">{Math.round(view.scale * 100)}%</span>
        <button className="h-8 w-8 rounded hover:bg-ink-700" aria-label={t("Zoom in")} onClick={() => zoom(1.2)}>+</button>
        <button className="h-8 whitespace-nowrap rounded border-l border-ink-600 px-3 hover:bg-ink-700" onClick={fit}>{t("Fit to view")}</button>
      </div>
    </div>
  );
}
