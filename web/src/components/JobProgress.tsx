import { useEffect, useState, type ReactNode } from 'react';
import type { Job, JobStage } from '@/api/types';
import { useJob, isActiveJob } from '@/hooks/queries';
import { cx, fmtElapsed } from '@/lib/format';
import { Banner, Hash, Spinner } from './ui';
import { getApi } from '@/api/client';

const STEPS: { id: JobStage; label: string; copy: string }[] = [
  { id: 'preparing', label: 'Preparing', copy: 'Building witnesses and sealing the entry…' },
  { id: 'proving', label: 'Proving', copy: 'Generating zero-knowledge proof… typically 20–40 s on the proof server.' },
  { id: 'submitting', label: 'Submitting', copy: 'Balancing with DUST and submitting to the node…' },
  { id: 'confirmed', label: 'Confirmed', copy: 'Included in a block.' },
];
const ORDER: Record<JobStage, number> = { queued: 0, preparing: 1, proving: 2, submitting: 3, confirmed: 4, rejected: 4, failed: 4 };

function useElapsed(job: Job | undefined) {
  const [now, setNow] = useState(Date.now());
  const active = isActiveJob(job);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [active]);
  if (!job) return 0;
  if (job.elapsedMs != null) return job.elapsedMs;
  const end = job.finishedAt ? new Date(job.finishedAt).getTime() : now;
  return Math.max(0, end - new Date(job.startedAt).getTime());
}

export function JobStepper({ job, compact }: { job: Job; compact?: boolean }) {
  const idx = ORDER[job.stage];
  const failed = job.stage === 'rejected' || job.stage === 'failed';
  return (
    <ol className={cx('flex items-center', compact ? 'gap-2' : 'gap-3')}>
      {STEPS.map((s, i) => {
        const n = i + 1;
        // A contract assert fails while the circuit runs (during proving); submission never happens.
        // For a generic failure we don't know the stage, so only "preparing" is shown as done.
        const done = failed ? n === 1 : idx > n || (idx === n && s.id === 'confirmed' && job.stage === 'confirmed');
        const current = idx === n && !done && !failed;
        const isFailHere = failed && n === 2 && job.stage === 'rejected';
        const showFail = failed && n === 4;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={cx(
                'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-mono',
                showFail || isFailHere
                  ? 'border-danger bg-danger-faint text-danger'
                  : done
                    ? 'border-accent bg-accent text-ink-950'
                    : current
                      ? 'border-accent text-accent'
                      : 'border-ink-600 text-ink-500',
              )}
            >
              {showFail ? '!' : isFailHere ? '✗' : done ? '✓' : current ? <Spinner className="h-3 w-3" /> : n}
            </span>
            <span className={cx('text-xs', showFail || isFailHere ? 'text-danger' : done || current ? 'text-ink-100' : 'text-ink-500')}>
              {showFail ? (job.stage === 'rejected' ? 'Rejected' : 'Failed') : isFailHere ? 'Circuit assert failed' : s.label}
            </span>
            {i < STEPS.length - 1 && <span className={cx('h-px w-6', done ? 'bg-accent/60' : 'bg-ink-700')} />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Inline job progress: stepper + elapsed timer + honest proving copy, then tx hash/block, or a red rejection banner.
 * Polls GET /jobs/:id every 1 s while active.
 */
export function JobProgress({
  jobId,
  initial,
  title,
  onDone,
  children,
}: {
  jobId: string;
  initial?: Job;
  title?: ReactNode;
  onDone?: (job: Job) => void;
  /** Rendered under the tx line once confirmed (completion card). */
  children?: (job: Job) => ReactNode;
}) {
  const q = useJob(jobId);
  const job = q.data ?? initial;
  const elapsed = useElapsed(job);
  const [notified, setNotified] = useState(false);
  useEffect(() => {
    if (job && !isActiveJob(job) && !notified) {
      setNotified(true);
      onDone?.(job);
    }
  }, [job, notified, onDone]);

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-300">
        <Spinner /> Loading job…
      </div>
    );
  }
  const step = STEPS.find((s) => s.id === job.stage);
  const active = isActiveJob(job);
  const mock = getApi().mode === 'mock';

  return (
    <div className="animate-fadeIn rounded-lg border border-ink-700 bg-ink-900/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-ink-300">
          {title ?? (
            <>
              circuit <span className="font-mono text-ink-100">{job.circuit}</span>
            </>
          )}
          <span className="ml-2 font-mono text-ink-500">{job.id}</span>
        </div>
        <div className="font-mono text-xs tabular-nums text-ink-300">
          {fmtElapsed(elapsed)}
          {active && <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent align-middle" />}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <JobStepper job={job} />
      </div>
      {active && (
        <p className="mt-3 text-xs text-ink-300">
          {job.stage === 'queued' ? 'Queued behind another proof…' : step?.copy}
          {mock && job.stage === 'proving' && <span className="text-ink-500"> (mock: a few seconds)</span>}
        </p>
      )}
      {job.stage === 'proving' && (
        <div className="mt-2 h-1 overflow-hidden rounded bg-ink-700">
          <div className="h-full w-1/3 animate-shimmer rounded bg-[linear-gradient(90deg,transparent,#6ee7d8,transparent)] bg-[length:200%_100%]" />
        </div>
      )}
      {job.stage === 'confirmed' && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-300">
            <span>
              tx <Hash value={job.txHash} head={10} tail={6} label="txHash" />
            </span>
            <span>
              block <span className="font-mono text-ink-100">{job.blockHeight}</span>
            </span>
            <span>
              proof + finality <span className="font-mono text-ink-100">{fmtElapsed(elapsed)}</span>
            </span>
          </div>
          {children?.(job)}
        </div>
      )}
      {job.stage === 'rejected' && (
        <Banner tone="danger" className="mt-3" title="REJECTED by the contract">
          <div className="font-mono text-xs">{job.error ?? 'assertion failed'}</div>
          <div className="mt-1 text-[12px] text-danger/80">The circuit assertion failed while executing against live ledger state, before any proof was generated. Nothing was written — the ledger is unchanged.</div>
        </Banner>
      )}
      {job.stage === 'failed' && (
        <Banner tone="warn" className="mt-3" title="Job failed">
          <div className="font-mono text-xs">{job.error ?? 'unknown error'}</div>
        </Banner>
      )}
    </div>
  );
}
