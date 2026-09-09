import { useNavigate } from 'react-router-dom';
import type { Challenge } from '@/api/types';
import { Badge, Button, Card } from '@/components/ui';
import { PageTitle } from '@/components/RoleGate';
import { useChallenges } from '@/hooks/queries';
import { cx } from '@/lib/format';
import { ROLES } from '@/lib/registry';
import { DEMO_STEPS, setDemoStep, useDemoStep, type DemoStep } from '@/state/demo';
import { useRole } from '@/state/role';

export function resolvePath(step: DemoStep, newest: Challenge | undefined): { path: string; note?: string } {
  if (typeof step.path === 'string') return { path: step.path };
  if (!newest) return { path: '/verify', note: 'No challenge yet — generate one first.' };
  if (step.path.kind === 'holderLink') return { path: `/credentials?challenge=${newest.challenge}&profile=${newest.profile}` };
  return { path: `/verify/${newest.challenge}?holder=${newest.holder}&profile=${newest.profile}` };
}

/** Switches role + navigates + records the current step. Used by the page and the presenter bar. */
export function useGoToStep() {
  const nav = useNavigate();
  const { setRole } = useRole();
  const challenges = useChallenges();
  const newest = challenges.data?.[0];
  return (i: number) => {
    const step = DEMO_STEPS[i];
    if (!step) return;
    setDemoStep(i);
    setRole(step.role);
    nav(resolvePath(step, newest).path);
  };
}

export function Demo() {
  const current = useDemoStep();
  const go = useGoToStep();
  const challenges = useChallenges();
  const newest = challenges.data?.[0];
  return (
    <div className="space-y-6">
      <PageTitle
        title="3-minute demo"
        subtitle="landing.md §10. Each stop switches the active party and opens the right page; a presenter bar at the bottom carries the script."
        actions={
          <>
            {current !== null && (
              <Button variant="ghost" onClick={() => setDemoStep(null)}>
                Exit guided mode
              </Button>
            )}
            <Button size="lg" onClick={() => go(0)}>
              {current === null ? 'Start guided demo' : 'Restart from step 1'}
            </Button>
          </>
        }
      />
      <ol className="space-y-3">
        {DEMO_STEPS.map((s, i) => {
          const role = ROLES.find((r) => r.id === s.role)!;
          const { note } = resolvePath(s, newest);
          const active = current === i;
          const first = i === 0 || DEMO_STEPS[i - 1].n !== s.n;
          return (
            <li key={s.id}>
              {first && <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{s.landing}</div>}
              <Card className={cx(active && 'border-accent/60')}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink-400">{String(i + 1).padStart(2, '0')}</span>
                      <h3 className="text-sm font-semibold">{s.title}</h3>
                      <Badge tone={active ? 'accent' : 'neutral'}>{role.label}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink-200">{s.action}</p>
                    <p className="mt-1 text-[13px] italic text-ink-400">Say: {s.say}</p>
                    {note && <p className="mt-1 text-xs text-warn">{note}</p>}
                  </div>
                  <Button variant={active ? 'primary' : 'secondary'} onClick={() => go(i)}>
                    Go
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Sticky presenter strip; visible whenever guided mode is on. */
export function DemoBar() {
  const current = useDemoStep();
  const go = useGoToStep();
  const nav = useNavigate();
  if (current === null) return null;
  const step = DEMO_STEPS[current];
  const role = ROLES.find((r) => r.id === step.role)!;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-accent/30 bg-ink-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="font-mono text-[11px] text-accent">
          DEMO {current + 1}/{DEMO_STEPS.length}
        </span>
        <span className="text-sm font-medium">{step.title}</span>
        <Badge tone="accent">{role.label}</Badge>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-300" title={step.action}>
          {step.action}
        </span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={current === 0} onClick={() => go(current - 1)}>
            ← Prev
          </Button>
          <Button size="sm" variant="secondary" onClick={() => go(current)} title="Re-open this step's page as the right party">
            Open
          </Button>
          <Button size="sm" disabled={current >= DEMO_STEPS.length - 1} onClick={() => go(current + 1)}>
            Next →
          </Button>
          <Button size="sm" variant="ghost" onClick={() => nav('/demo')} title="Script">
            Script
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDemoStep(null)} title="Exit guided mode">
            ✕
          </Button>
        </div>
      </div>
    </div>
  );
}
