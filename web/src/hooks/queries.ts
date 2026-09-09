import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import type { Job, PartyName, Profile } from '@/api/types';
import { bus } from '@/lib/bus';
import { isActive } from '@/lib/progress';

export const qk = {
  health: ['health'] as const,
  tip: ['tip'] as const,
  graph: ['graph'] as const,
  parties: ['parties'] as const,
  policy: ['policy'] as const,
  jobs: ['jobs'] as const,
  job: (id: string) => ['job', id] as const,
  challenges: ['challenges'] as const,
  open: (holder: PartyName) => ['open', holder] as const,
  verify: (challenge: string, holder: PartyName, profile: Profile) => ['verify', challenge, holder, profile] as const,
};

export function useHealth() {
  return useQuery({ queryKey: qk.health, queryFn: () => getApi().health(), refetchInterval: 10_000, retry: 0 });
}
export function useTip() {
  return useQuery({ queryKey: qk.tip, queryFn: () => getApi().explorerTip(), refetchInterval: 10_000, retry: 0 });
}
/** Every 5 s; every 1 s while a job runs so the seconds tick. */
export function useGraph() {
  return useQuery({
    queryKey: qk.graph,
    queryFn: () => getApi().graph(),
    refetchInterval: (q) => (q.state.data?.activeJob || q.state.data?.queue.length || bus.hasActive() ? 1_000 : 5_000),
    retry: 0,
  });
}
export function useParties() {
  return useQuery({ queryKey: qk.parties, queryFn: () => getApi().parties(), refetchInterval: 5_000 });
}
export function usePolicy() {
  return useQuery({ queryKey: qk.policy, queryFn: () => getApi().policy(), refetchInterval: 5_000 });
}
export function useJobs() {
  return useQuery({ queryKey: qk.jobs, queryFn: () => getApi().jobs(), refetchInterval: 5_000 });
}
/** Polls one job every 1 s until it ends, then refreshes everything it could have changed. */
export function useJob(id: string | null | undefined, initial?: Job) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.job(id ?? ''),
    enabled: !!id,
    initialData: initial,
    queryFn: async () => {
      const j = await getApi().job(id!);
      if (!isActive(j)) {
        bus.endJob(j.id);
        for (const key of [qk.graph, qk.parties, qk.policy, qk.jobs, qk.challenges, ['open'], ['verify']])
          qc.invalidateQueries({ queryKey: key });
      }
      return j;
    },
    refetchInterval: (q) => (q.state.data && !isActive(q.state.data) ? false : 1_000),
  });
}
export function useChallenges() {
  return useQuery({ queryKey: qk.challenges, queryFn: () => getApi().challenges(), refetchInterval: 5_000 });
}
export function useOpenRequests(holder: PartyName) {
  return useQuery({ queryKey: qk.open(holder), queryFn: () => getApi().openRequests(holder), refetchInterval: 5_000, retry: 0 });
}
export function useVerify(challenge: string, holder: PartyName, profile: Profile) {
  return useQuery({
    queryKey: qk.verify(challenge, holder, profile),
    queryFn: () => getApi().verify(challenge, holder, profile),
    refetchInterval: 5_000,
  });
}
export function useExplorerTx(hash?: string) {
  return useQuery({ queryKey: ['explorer', 'tx', hash], enabled: !!hash, queryFn: () => getApi().explorerTx(hash!), retry: 0 });
}
export function useExplorerBlock(height?: number) {
  return useQuery({ queryKey: ['explorer', 'block', height], enabled: height != null, queryFn: () => getApi().explorerBlock(height!), retry: 0 });
}
export function useExplorerContract(enabled: boolean) {
  return useQuery({ queryKey: ['explorer', 'contract'], enabled, queryFn: () => getApi().explorerContract(), refetchInterval: 10_000, retry: 0 });
}
export function useLedgerRaw(enabled: boolean) {
  return useQuery({ queryKey: ['explorer', 'ledger'], enabled, queryFn: () => getApi().explorerLedgerRaw(), refetchInterval: 10_000, retry: 0 });
}
