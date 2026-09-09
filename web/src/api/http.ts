import type { VeilanceApi } from './client';
import { staticDisclosure } from './disclosure';
import { ApiError, type PartyName } from './types';

export function createHttpApi(baseUrl: string): VeilanceApi {
  const base = baseUrl.replace(/\/$/, '');

  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(base + path, {
        ...init,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      });
    } catch (e) {
      throw new ApiError(`Agent unreachable at ${base} (${(e as Error).message})`, 'NETWORK', 0);
    }
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!res.ok) {
      const b = body as { error?: string; code?: string } | null;
      throw new ApiError(b?.error ?? `HTTP ${res.status}`, b?.code ?? `HTTP_${res.status}`, res.status);
    }
    return body as T;
  }
  const post = <T,>(path: string, body?: unknown) =>
    req<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

  return {
    mode: 'http',
    baseUrl: base,
    health: () => req('/health'),
    parties: () => req('/parties'),
    deploy: () => post('/deploy'),
    ledger: () => req('/ledger'),
    policy: () => req('/ledger/policy'),
    txs: () => req('/ledger/txs'),
    job: (id) => req(`/jobs/${encodeURIComponent(id)}`),
    jobs: (party?: PartyName) => req(party ? `/jobs?party=${party}` : '/jobs'),
    addOrigin: (input) => post('/admin/origins', input),
    addSupplier: (input) => post('/admin/suppliers', input),
    setCarbonThreshold: (threshold) => post('/admin/carbon-threshold', { threshold }),
    bootstrap: () => post('/admin/bootstrap'),
    registerEncKey: (party) => post(`/parties/${party}/enc-key`),
    credentials: (party) => req(`/parties/${party}/credentials`),
    scan: (party) => post(`/parties/${party}/scan`),
    issue: (party, input) => post(`/parties/${party}/issue`, input),
    transfer: (party, id, input) => post(`/parties/${party}/credentials/${encodeURIComponent(id)}/transfer`, input),
    attest: (party, id, input) => post(`/parties/${party}/credentials/${encodeURIComponent(id)}/attest`, input),
    disclosurePreview: async (party, op, profile) => {
      try {
        const q = new URLSearchParams({ op });
        if (profile) q.set('profile', profile);
        return await req(`/parties/${party}/disclosure-preview?${q}`);
      } catch {
        return staticDisclosure(op, profile);
      }
    },
    createChallenge: (input) => post('/verify/challenges', input),
    challenges: () => req('/verify/challenges'),
    verify: (challenge, holder, profile) =>
      req(`/verify/${encodeURIComponent(challenge)}?holder=${holder}&profile=${profile}`),
  };
}
