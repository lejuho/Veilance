import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import type { Job, PartyName, Profile, DisclosureOp } from '@/api/types';

const ACTIVE = new Set(['queued', 'preparing', 'proving', 'submitting']);
export const isActiveJob = (j?: Job | null) => !!j && ACTIVE.has(j.stage);
export const isTerminalJob = (j?: Job | null) => !!j && !ACTIVE.has(j.stage);

export const qk = {
  health: ['health'] as const,
  parties: ['parties'] as const,
  ledger: ['ledger'] as const,
  policy: ['policy'] as const,
  txs: ['txs'] as const,
  jobs: (party?: PartyName | null) => ['jobs', party ?? 'all'] as const,
  job: (id: string) => ['job', id] as const,
  credentials: (party: PartyName) => ['credentials', party] as const,
  disclosure: (party: PartyName, op: DisclosureOp, profile?: Profile) => ['disclosure', party, op, profile ?? ''] as const,
  challenges: ['challenges'] as const,
  verify: (challenge: string, holder: PartyName, profile: Profile) => ['verify', challenge, holder, profile] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: qk.health,
    queryFn: () => getApi().health(),
    // Poll fast while the agent is still booting (ready:false) or unreachable, slower once ready.
    refetchInterval: (q) => (q.state.data && q.state.data.ready !== false ? 10_000 : 2_000),
    retry: 1,
  });
}
export function useParties() {
  return useQuery({ queryKey: qk.parties, queryFn: () => getApi().parties(), refetchInterval: 5_000 });
}
export function useLedger() {
  return useQuery({ queryKey: qk.ledger, queryFn: () => getApi().ledger(), refetchInterval: 5_000 });
}
export function usePolicy() {
  return useQuery({ queryKey: qk.policy, queryFn: () => getApi().policy(), refetchInterval: 5_000 });
}
export function useTxs() {
  return useQuery({ queryKey: qk.txs, queryFn: () => getApi().txs(), refetchInterval: 5_000 });
}
export function useJobs(party?: PartyName | null) {
  return useQuery({
    queryKey: qk.jobs(party),
    queryFn: () => getApi().jobs(party ?? undefined),
    refetchInterval: (q) => (q.state.data?.some(isActiveJob) ? 1_000 : 5_000),
  });
}
/** Polls a single job every 1 s while active, then stops. Also invalidates ledger-derived queries when it finishes. */
export function useJob(id: string | null | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.job(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const j = await getApi().job(id!);
      if (isTerminalJob(j)) {
        // Refresh everything the confirmation could have changed.
        qc.invalidateQueries({ queryKey: qk.ledger });
        qc.invalidateQueries({ queryKey: qk.policy });
        qc.invalidateQueries({ queryKey: qk.parties });
        qc.invalidateQueries({ queryKey: qk.txs });
        qc.invalidateQueries({ queryKey: ['credentials'] });
        qc.invalidateQueries({ queryKey: ['jobs'] });
        qc.invalidateQueries({ queryKey: ['verify'] });
      }
      return j;
    },
    refetchInterval: (q) => (q.state.data && isTerminalJob(q.state.data) ? false : 1_000),
  });
}
export function useCredentials(party: PartyName | null) {
  return useQuery({
    queryKey: qk.credentials(party ?? 'admin'),
    enabled: !!party,
    queryFn: () => getApi().credentials(party!),
    refetchInterval: 5_000,
  });
}
export function useDisclosure(party: PartyName | null, op: DisclosureOp, profile?: Profile) {
  return useQuery({
    queryKey: qk.disclosure(party ?? 'admin', op, profile),
    queryFn: () => getApi().disclosurePreview(party ?? 'admin', op, profile),
    staleTime: 60_000,
  });
}
export function useChallenges() {
  return useQuery({ queryKey: qk.challenges, queryFn: () => getApi().challenges(), refetchInterval: 5_000 });
}
export function useVerify(challenge: string | null, holder: PartyName | null, profile: Profile | null) {
  return useQuery({
    queryKey: qk.verify(challenge ?? '', holder ?? 'mine', profile ?? 'consumer'),
    enabled: !!challenge && !!holder && !!profile,
    queryFn: () => getApi().verify(challenge!, holder!, profile!),
    refetchInterval: 2_000,
  });
}
export function useScan(party: PartyName | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getApi().scan(party!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credentials'] });
      qc.invalidateQueries({ queryKey: qk.parties });
    },
  });
}
