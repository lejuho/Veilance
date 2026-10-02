// Veilance v2 web — client for the v2 node (agent/API_V2.md).
// With VITE_V2_DEMO=1 every call goes to the in-browser simulation (sim.ts).

import { SIM_ENABLED, SimError, simRequest } from './sim';
// The API key lives in sessionStorage only: closing the tab signs out.

// The `auto` Pages build (mode.ts) takes the node URL from `?api=<url>`, remembered in
// localStorage, because a tunnel's address can change between runs.
const URL_KEY = 'veilance-v2-url';
const BUILD_URL = (import.meta.env.VITE_V2_URL as string | undefined) || 'http://localhost:4100';
const cleanUrl = (url: string) => url.trim().replace(/\/+$/, '');
function resolveV2Url(): string {
  if (import.meta.env.VITE_V2_DEMO !== 'auto') return BUILD_URL;
  try {
    const param = new URLSearchParams(window.location.search).get('api');
    if (param && /^https?:\/\//.test(param)) localStorage.setItem(URL_KEY, cleanUrl(param));
    return localStorage.getItem(URL_KEY) ?? BUILD_URL;
  } catch {
    return BUILD_URL;
  }
}
export const V2_URL = resolveV2Url();
export const setV2Url = (url: string | null) => {
  try {
    if (url) localStorage.setItem(URL_KEY, cleanUrl(url));
    else localStorage.removeItem(URL_KEY);
  } catch {
    /* storage is optional */
  }
};
// ngrok's free tier answers browsers with an HTML warning page unless this header is sent.
export const tunnelHeaders: Record<string, string> = V2_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': '1' } : {};

const KEY = 'veilance-v2-key';
export const getKey = (): string | null => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const setKey = (key: string | null) => {
  try {
    if (key) sessionStorage.setItem(KEY, key);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage is optional */
  }
};

export class V2Error extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function v2<T>(method: string, path: string, body?: unknown, key: string | null = getKey()): Promise<T> {
  if (SIM_ENABLED) {
    try {
      return await simRequest<T>(method, path, body, key);
    } catch (err) {
      if (err instanceof SimError) throw new V2Error(err.message, err.status, err.code);
      throw err;
    }
  }
  const res = await fetch(`${V2_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...tunnelHeaders, ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) throw new V2Error(json.error ?? `HTTP ${res.status}`, res.status, json.code);
  return json;
}

export type Health = { ready: boolean; step: string; contractAddress?: string; error?: string };

// Only the in-browser simulation fills these: the platform onboards a company with
// what it applies for, and the policy authority reviews that (Admin.tsx).
export type CompanyProfile = { country: string; kind: string };
export type Applied = { supplier: boolean; recycler: 'eu' | 'other' | null };

export type Profile = {
  id: string;
  name: string;
  role: 'admin' | 'company' | 'platform';
  profile?: CompanyProfile;
  partyId: string;
  certId: string;
  deployed: boolean;
  supplier: boolean;
  recycler: 'eu' | 'other' | null;
  receivingKey: boolean;
};

export type Job = {
  id: string;
  op: string;
  stage: 'queued' | 'proving' | 'confirmed' | 'rejected' | 'failed';
  createdAt: string;
  finishedAt?: string;
  elapsedMs?: number;
  txHash?: string;
  blockHeight?: number;
  result?: Record<string, unknown>;
  error?: string;
};

export type LotView = {
  id: string;
  commitment: string;
  status: 'ACTIVE' | 'CONSUMED';
  source: string;
  material: string;
  quantityKg: number;
  recycledEuKg: number;
  recycledOtherKg: number;
  carbonClass: number;
  custody: string;
  origins: { origin: string; issuer: string }[];
  memo?: string;
  createdAt: string;
  consumedAt?: string;
};

export type AccountView = {
  id: string;
  plant: string;
  period: number;
  material: string;
  status: 'OPEN' | 'DECLARED';
  totalKg: number;
  recycledEuKg: number;
  recycledOtherKg: number;
  maxDeclarableBps: number;
  declaredBps?: number;
};

export type DirectoryEntry = { name: string; partyId: string };
export type TenantCreated = { id: string; partyId: string; certId: string; apiKey: string; registerJob?: Job };
export type AuditorPackage = { owner: string; plant: string; period: number; material: string; totalKg: number; salt: string };
export type DeclarationCheck = { declared: boolean; shareBps?: number; totalCommit?: string; totalMatches?: boolean };
export type AttestationCheck = { attested: boolean; policyVersion?: string; currentPolicyVersion?: string; fresh?: boolean };

export const isDone = (j?: Job) => !!j && ['confirmed', 'rejected', 'failed'].includes(j.stage);

export const kg = (n: number) => (n >= 1000 && n % 100 === 0 ? `${(n / 1000).toLocaleString()} t` : `${n.toLocaleString()} kg`);
export const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;
export const short = (h: string) => (h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h);
