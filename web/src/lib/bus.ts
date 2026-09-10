import { useSyncExternalStore } from 'react';
import type { Job, PartyName } from '@/api/types';
import { jobLabel } from './progress';

/** Tiny shared store: labels for jobs started from a drawer, the set of jobs still running, and the lot to flash red. */
interface BusState {
  active: string[];
  recipients: Record<string, PartyName | 'verifier' | undefined>;
  flash: { lotId: string; until: number } | null;
}
let state: BusState = { active: [], recipients: {}, flash: null };
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
      recipients: { ...state.recipients, [job.id]: recipient },
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
  label: (job: Job) => jobLabel(job, state.recipients[job.id]),
};

export function useBus(): BusState {
  return useSyncExternalStore(subscribe, () => state);
}
