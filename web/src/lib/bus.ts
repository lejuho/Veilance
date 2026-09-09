import { useSyncExternalStore } from 'react';
import type { Job, PartyName } from '@/api/types';
import { jobLabel } from './progress';

/** Tiny shared store: labels for jobs started from a drawer, the set of jobs still running, and the lot to flash red. */
interface BusState {
  active: string[];
  labels: Record<string, string>;
  flash: { lotId: string; until: number } | null;
}
let state: BusState = { active: [], labels: {}, flash: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const bus = {
  startJob(job: Job, recipient?: PartyName | 'verifier') {
    state = {
      ...state,
      active: [...state.active, job.id],
      labels: { ...state.labels, [job.id]: jobLabel(job, recipient) },
    };
    emit();
  },
  endJob(id: string) {
    if (!state.active.includes(id)) return;
    state = { ...state, active: state.active.filter((x) => x !== id) };
    emit();
  },
  flashLot(lotId: string) {
    state = { ...state, flash: { lotId, until: Date.now() + 2000 } };
    emit();
    setTimeout(() => {
      if (state.flash?.lotId === lotId) {
        state = { ...state, flash: null };
        emit();
      }
    }, 2000);
  },
  hasActive: () => state.active.length > 0,
  label: (job: Job) => state.labels[job.id] ?? jobLabel(job),
};

export function useBus(): BusState {
  return useSyncExternalStore(subscribe, () => state);
}
