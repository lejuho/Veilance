import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Job, PartyName } from '@/api/types';
import { bus } from '@/lib/bus';
import { qk } from './queries';

/** Starts a circuit call and hands the returned job to a JobRing. */
export function useAction<TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<Job>, recipient?: () => PartyName | 'verifier' | undefined) {
  const qc = useQueryClient();
  const [job, setJob] = useState<Job | null>(null);
  const m = useMutation({
    mutationFn: (args: TArgs) => fn(...args),
    onSuccess: (j) => {
      bus.startJob(j, recipient?.());
      qc.setQueryData(qk.job(j.id), j);
      qc.invalidateQueries({ queryKey: qk.graph });
      setJob(j);
    },
  });
  return {
    job,
    run: (...args: TArgs) => m.mutate(args),
    pending: m.isPending,
    error: m.error,
    reset: () => {
      setJob(null);
      m.reset();
    },
  };
}
