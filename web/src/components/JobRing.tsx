import { t, useI18n } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { getApi } from '@/api/client';
import type { Job } from '@/api/types';
import { useJob } from '@/hooks/queries';
import { cx, reason } from '@/lib/format';
import { STAGE_WORD, elapsedMs, expectedMs, isActive } from '@/lib/progress';
import { Explore } from './ui';

export function Ring({ pct, over, seconds, size = 36 }: { pct: number; over: boolean; seconds: number; size?: number }) {
  useI18n();
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <span className={cx('relative inline-block shrink-0', over && 'animate-blink')} style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2a3541" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#f2b544"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] tabular-nums text-ink-100">{seconds}</span>
    </span>
  );
}

/** Renders in place of an action button: ring + one word while running, then the confirmed or rejected line. */
export function JobRing({ jobId, initial, onTerminal }: { jobId: string; initial?: Job; onTerminal?: (job: Job) => void }) {
  useI18n();
  const q = useJob(jobId, initial);
  const job = q.data ?? initial;
  const active = isActive(job);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (job && !active && notified.current !== job.id) {
      notified.current = job.id;
      onTerminal?.(job);
    }
  }, [job, active, onTerminal]);
  if (!job) return null;
  if (active) {
    const ms = elapsedMs(job, now);
    const exp = expectedMs(getApi().mode);
    return (
      <div className="flex h-9 items-center gap-3" role="status">
        <Ring pct={ms / exp} over={ms > exp} seconds={Math.floor(ms / 1000)} />
        <span className="text-sm text-amber">{t(STAGE_WORD[job.stage])}</span>
      </div>
    );
  }
  if (job.stage === 'confirmed')
    return (
      <div className="flex h-9 items-center gap-2 text-sm text-accent" role="status">
        {t("Confirmed · block")}{job.blockHeight} <Explore tx={job.txHash} className="text-accent" />
      </div>
    );
  return (
    <div className="flex min-h-9 items-center text-sm text-red" role="alert">
      {job.stage === 'rejected' ? t("Rejected by contract — {reason}", { reason: reason(job.error) }) : t("Failed — {reason}", { reason: reason(job.error) })}
    </div>
  );
}
