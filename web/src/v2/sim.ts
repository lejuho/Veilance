// Veilance v2 web — in-browser simulation of the v2 node (agent/API_V2.md)
// for a front-end-only demo (GitHub Pages). Same endpoints, same rules as
// the Compact contract and the node enforce; nothing reaches a chain.
//
// State lives in localStorage so a page refresh keeps the demo where it was;
// `resetSim()` starts over from the seeded "ready to present" state.

import type { AccountView, Job, LotView } from './api';

// VITE_V2_DEMO=1 always simulates; VITE_V2_DEMO=auto switches it on at boot when the
// visitor picks the simulation (mode.ts). Decided before the first render, never after.
export let SIM_ENABLED = import.meta.env.VITE_V2_DEMO === '1';
export const enableSim = () => {
  SIM_ENABLED = true;
};

const STORE = 'veilance-v2-sim';
const PROVE_MS = 2200;

type Slot = { origin: string; issuer: string };
type Lot = {
  id: string;
  owner: string;
  material: string;
  quantityKg: number;
  recycledEuKg: number;
  recycledOtherKg: number;
  carbonClass: number;
  custody: number; // 1 identity preserved, 2 segregated, 3 mass balance
  origins: Slot[];
  status: 'ACTIVE' | 'CONSUMED';
  source: string;
  memo?: string;
  createdAt: string;
  consumedAt?: string;
};
type Account = {
  id: string;
  owner: string;
  plant: string;
  period: number;
  material: string;
  totalKg: number;
  recycledEuKg: number;
  recycledOtherKg: number;
  status: 'OPEN' | 'DECLARED';
  declaredBps?: number;
  salt?: string;
};
type Tenant = {
  id: string;
  name: string;
  role: 'admin' | 'company';
  apiKey: string;
  partyId: string;
  certId: string;
  supplier: boolean;
  recycler: 'eu' | 'other' | null;
  receivingKey: boolean;
};
type State = {
  version: 1;
  block: number;
  contractAddress: string | null;
  policyVersion: number;
  carbonThreshold: number;
  origins: string[];
  rules: string[]; // "in>out>yield"
  nullifiers: number;
  lotLeaves: number;
  inbox: number;
  tenants: Tenant[];
  lots: Lot[];
  accounts: Account[];
  jobs: (Job & { tenant: string })[];
  attestations: Record<string, number>; // key -> policy version
  declarations: Record<string, { shareBps: number; totalCommit: string }>;
};

/* ---------------- helpers ---------------- */

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const rand = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
const now = () => new Date().toISOString();

class SimError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}
/** A contract rejection: the job ends "rejected" with the assert message. */
class Reject extends Error {}

const DEMO_TENANTS: [string, string, Partial<Tenant>][] = [
  ['admin', 'Policy admin', { role: 'admin', receivingKey: false }],
  ['recycler', 'HU Recycler', { supplier: true, recycler: 'eu' }],
  ['mine', 'Nickel Mine', { supplier: true }],
  ['refiner', 'Refiner', { supplier: true }],
  ['cell', 'Cell Maker', { supplier: true }],
  ['oem', 'OEM', {}],
];

/** The demo accounts the sign-in screen offers as one-click buttons. */
export const DEMO_ACCOUNTS = DEMO_TENANTS.map(([slug, name, extra]) => ({ key: `demo-${slug}`, name, role: extra.role ?? 'company' }));

const seed = (): State => ({
  version: 1,
  block: 18_240,
  contractAddress: rand(32),
  policyVersion: 9,
  carbonThreshold: 9,
  origins: ['recycler-hu', 'ni-mine'],
  rules: ['nickel>nickel>100', 'nickel>nickel-sulfate>20'],
  nullifiers: 0,
  lotLeaves: 0,
  inbox: 0,
  tenants: DEMO_TENANTS.map(([slug, name, extra]) => ({
    id: slug,
    name,
    role: 'company',
    apiKey: `demo-${slug}`,
    partyId: rand(32),
    certId: rand(32),
    supplier: false,
    recycler: null,
    receivingKey: true,
    ...extra,
  })),
  lots: [],
  accounts: [],
  jobs: [],
  attestations: {},
  declarations: {},
});

let state: State | null = null;
const load = (): State => {
  if (state) return state;
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) state = JSON.parse(raw) as State;
  } catch {
    /* storage is optional */
  }
  if (!state || state.version !== 1) state = seed();
  return state;
};
const save = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    /* storage is optional */
  }
};

/** Back to the seeded demo state (companies certified, no lots yet). */
export const resetSim = () => {
  state = seed();
  save();
};

/* ---------------- views (same shapes as the node) ---------------- */

const custodyName = (c: number) => ['', 'identity-preserved', 'segregated', 'mass-balance'][c] ?? String(c);
const lotView = (l: Lot): LotView => ({
  id: l.id,
  commitment: l.id,
  status: l.status,
  source: l.source,
  material: l.material,
  quantityKg: l.quantityKg,
  recycledEuKg: l.recycledEuKg,
  recycledOtherKg: l.recycledOtherKg,
  carbonClass: l.carbonClass,
  custody: custodyName(l.custody),
  origins: l.origins,
  memo: l.memo,
  createdAt: l.createdAt,
  consumedAt: l.consumedAt,
});
const maxBps = (a: Pick<Account, 'totalKg' | 'recycledEuKg' | 'recycledOtherKg'>) =>
  a.totalKg === 0 ? 0 : Math.min(10_000, Math.floor(((a.recycledOtherKg * 10 + a.recycledEuKg * 13) * 10_000) / (a.totalKg * 10)));
const accountView = (a: Account): AccountView => ({
  id: a.id,
  plant: a.plant,
  period: a.period,
  material: a.material,
  status: a.status,
  totalKg: a.totalKg,
  recycledEuKg: a.recycledEuKg,
  recycledOtherKg: a.recycledOtherKg,
  maxDeclarableBps: maxBps(a),
  declaredBps: a.declaredBps,
});
const tenantView = (t: Tenant) => ({ id: t.id, name: t.name, role: t.role, partyId: t.partyId, certId: t.certId, supplier: t.supplier, recycler: t.recycler, receivingKey: t.receivingKey });
const publicJob = (j: Job & { tenant: string }): Job => {
  const { tenant: _t, ...rest } = j;
  return rest;
};

/* ---------------- jobs ---------------- */

const queue: { job: Job & { tenant: string }; run: () => Promise<Record<string, unknown> | void> }[] = [];
let draining = false;

const enqueue = (t: Tenant, op: string, run: () => Promise<Record<string, unknown> | void>): Job => {
  const s = load();
  const job = { id: rand(8), tenant: t.id, op, stage: 'queued' as Job['stage'], createdAt: now() };
  s.jobs.push(job);
  save();
  queue.push({ job, run });
  void drain();
  return publicJob(job);
};

const drain = async () => {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const { job, run } = queue.shift()!;
    const started = Date.now();
    job.stage = 'proving';
    save();
    await new Promise((r) => setTimeout(r, PROVE_MS));
    try {
      const result = await run();
      const s = load();
      s.block += 1 + Math.floor(Math.random() * 3);
      Object.assign(job, { stage: 'confirmed', blockHeight: s.block, txHash: rand(32), result: result ?? undefined });
    } catch (err) {
      Object.assign(job, { stage: err instanceof Reject ? 'rejected' : 'failed', error: err instanceof Error ? err.message : String(err) });
    }
    Object.assign(job, { finishedAt: now(), elapsedMs: Date.now() - started });
    save();
  }
  draining = false;
};

/* ---------------- rules (mirroring veilance_v2.compact) ---------------- */

const reject = (msg: string): never => {
  throw new Reject(`veilance: ${msg}`);
};
const tenantByParty = (partyId: string) => load().tenants.find((t) => t.partyId === partyId);
const activeLot = (t: Tenant, id: string) => {
  const l = load().lots.find((x) => x.id === id && x.owner === t.id);
  if (!l) throw new SimError(`lot ${id} not found in this tenant's vault`, 404, 'not_found');
  if (l.status !== 'ACTIVE') throw new SimError(`lot ${id} is ${l.status}`, 409, 'lot_consumed');
  return l;
};
const kgOk = (n: unknown, what = 'quantityKg') => {
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0 || n > 0xffffffff) throw new SimError(`${what} must be a positive integer (kg)`, 400, 'bad_request');
  return n;
};
const spend = (l: Lot) => {
  const s = load();
  l.status = 'CONSUMED';
  l.consumedAt = now();
  s.nullifiers += 1;
};
const mint = (l: Omit<Lot, 'id' | 'createdAt' | 'status'>): Lot => {
  const s = load();
  const lot: Lot = { ...l, id: rand(32), status: 'ACTIVE', createdAt: now() };
  s.lots.push(lot);
  s.lotLeaves += 1;
  return lot;
};

/* ---------------- request router ---------------- */

type Body = Record<string, unknown>;

export async function simRequest<T>(method: string, path: string, body: unknown, key: string | null): Promise<T> {
  const s = load();
  const b = (body ?? {}) as Body;
  const url = new URL(path, 'http://sim');
  const p = url.pathname;

  // --- public ---
  if (p === '/v2/health') return { ready: true, step: 'ready', contractAddress: s.contractAddress ?? undefined } as T;
  if (p === '/v2/public/ledger')
    return {
      contractAddress: s.contractAddress,
      policyVersion: String(s.policyVersion),
      carbonThreshold: String(s.carbonThreshold),
      lotLeaves: String(s.lotLeaves),
      nullifiers: String(s.nullifiers),
      attestations: String(Object.keys(s.attestations).length),
      declarations: String(Object.keys(s.declarations).length),
      inbox: String(s.inbox),
    } as T;
  if (p === '/v2/public/declaration') {
    if (!b.owner || !b.plant || !Number.isInteger(b.period) || !b.material) throw new SimError('owner, plant, period, material are required', 400, 'bad_request');
    const d = s.declarations[await sha(`decl|${b.owner}|${b.plant}|${b.period}|${b.material}`)];
    if (!d) return { declared: false } as T;
    const out: Body = { declared: true, shareBps: d.shareBps, totalCommit: d.totalCommit };
    if (b.totalKg !== undefined && b.salt) out.totalMatches = (await sha(`tot|${b.totalKg}|${b.salt}`)) === d.totalCommit;
    return out as T;
  }
  if (p === '/v2/public/attestation') {
    const v = s.attestations[await sha(`att|${String(b.challenge).toLowerCase()}|${b.owner}|${b.minQuantityKg}`)];
    if (v === undefined) return { attested: false } as T;
    return { attested: true, policyVersion: String(v), currentPolicyVersion: String(s.policyVersion), fresh: v === s.policyVersion } as T;
  }

  // --- authenticated ---
  const t = s.tenants.find((x) => x.apiKey === key);
  if (!t) throw new SimError('unknown or missing API key', 401, 'unauthorized');
  const admin = () => {
    if (t.role !== 'admin') throw new SimError('admin only', 403, 'forbidden');
  };
  const company = () => {
    if (t.role !== 'company') throw new SimError('company tenants only', 403, 'forbidden');
  };

  if (p === '/v2/me') return { ...tenantView(t), deployed: !!s.contractAddress } as T;
  if (p === '/v2/jobs' && method === 'GET') return s.jobs.filter((j) => j.tenant === t.id).reverse().slice(0, 50).map(publicJob) as T;
  if (p.startsWith('/v2/jobs/')) {
    const j = s.jobs.find((x) => x.id === p.slice('/v2/jobs/'.length) && x.tenant === t.id);
    if (!j) throw new SimError('job not found', 404, 'not_found');
    return publicJob(j) as T;
  }
  if (p === '/v2/directory') return s.tenants.filter((x) => x.role === 'company').map((x) => ({ name: x.name, partyId: x.partyId })) as T;
  if (p === '/v2/lots') {
    const status = url.searchParams.get('status');
    return s.lots.filter((l) => l.owner === t.id && (!status || l.status === status)).reverse().map(lotView) as T;
  }
  if (p === '/v2/inbox/scan') return [] as T; // deliveries land directly in the recipient's vault

  // admin
  if (p === '/v2/admin/tenants' && method === 'GET') {
    admin();
    return s.tenants.map(tenantView) as T;
  }
  if (p === '/v2/admin/tenants') {
    admin();
    if (!b.name) throw new SimError('name is required', 400, 'bad_request');
    const nt: Tenant = { id: rand(4), name: String(b.name), role: 'company', apiKey: `vk_${rand(24)}`, partyId: rand(32), certId: rand(32), supplier: false, recycler: null, receivingKey: false };
    s.tenants.push(nt);
    save();
    const registerJob = enqueue(nt, 'registerEncKey', async () => {
      nt.receivingKey = true;
    });
    return { id: nt.id, partyId: nt.partyId, certId: nt.certId, apiKey: nt.apiKey, registerJob } as T;
  }
  if (p === '/v2/admin/deploy') {
    admin();
    if (s.contractAddress) throw new SimError(`already deployed at ${s.contractAddress}`, 409, 'already_deployed');
    return enqueue(t, 'deploy', async () => {
      s.contractAddress = rand(32);
      return { contractAddress: s.contractAddress, verifierKeysInserted: 7 };
    }) as T;
  }
  const byParty = (partyId: unknown) => {
    const x = tenantByParty(String(partyId));
    if (!x) throw new SimError('unknown party', 404, 'not_found');
    return x;
  };
  if (p === '/v2/admin/origins') {
    admin();
    return enqueue(t, 'certifyOrigin', async () => {
      if (!s.origins.includes(String(b.label))) s.origins.push(String(b.label));
      s.policyVersion += 1;
    }) as T;
  }
  if (p === '/v2/admin/suppliers') {
    admin();
    const x = byParty(b.partyId);
    return enqueue(t, 'certifySupplier', async () => {
      x.supplier = true;
      s.policyVersion += 1;
    }) as T;
  }
  if (p === '/v2/admin/recyclers') {
    admin();
    const x = byParty(b.partyId);
    return enqueue(t, 'certifyRecycler', async () => {
      x.recycler = b.isEu ? 'eu' : 'other';
      s.policyVersion += 1;
    }) as T;
  }
  if (p === '/v2/admin/rules') {
    admin();
    return enqueue(t, 'addProcessingRule', async () => {
      const y = Number(b.yieldPct);
      if (!(y >= 1 && y <= 100)) reject('yield must be 1..100 percent');
      s.rules.push(`${b.inMaterial}>${b.outMaterial}>${y}`);
      s.policyVersion += 1;
    }) as T;
  }
  if (p === '/v2/admin/threshold') {
    admin();
    return enqueue(t, 'setCarbonThreshold', async () => {
      s.carbonThreshold = Number(b.value);
      s.policyVersion += 1;
    }) as T;
  }

  // company
  if (p === '/v2/lots/issue') {
    company();
    const q = kgOk(b.quantityKg);
    const recycled = !!b.recycled;
    return enqueue(t, recycled ? 'issueRecycledLot' : 'issueLot', async () => {
      const to = tenantByParty(String(b.recipient));
      if (!to?.receivingKey) throw new SimError(`recipient has no registered receiving key`, 409, 'no_enc_key');
      if (!t.supplier) reject('supplier is not certified');
      if (recycled && !t.recycler) reject('issuer is not a certified recycler');
      if (!s.origins.includes(String(b.origin))) reject('origin is not certified');
      const eu = recycled && t.recycler === 'eu';
      mint({
        owner: to.id,
        material: String(b.material),
        quantityKg: q,
        recycledEuKg: recycled && eu ? q : 0,
        recycledOtherKg: recycled && !eu ? q : 0,
        carbonClass: Number(b.carbonClass ?? 0),
        custody: Number(b.custody ?? (recycled ? 3 : 1)),
        origins: [{ origin: String(b.origin), issuer: t.partyId }],
        source: 'inbox',
        memo: b.memo ? String(b.memo) : undefined,
      });
      s.inbox += 1;
    }) as T;
  }
  const transferMatch = p.match(/^\/v2\/lots\/([^/]+)\/transfer$/);
  if (transferMatch) {
    company();
    const q = kgOk(b.quantityKg);
    const lot = activeLot(t, transferMatch[1]);
    return enqueue(t, 'transferLot', async () => {
      if (lot.status !== 'ACTIVE') reject('lot already consumed');
      const to = tenantByParty(String(b.recipient));
      if (!to?.receivingKey) throw new SimError('recipient has no registered receiving key', 409, 'no_enc_key');
      if (!t.supplier) reject('supplier is not certified');
      if (q > lot.quantityKg) reject('transfer exceeds the lot quantity');
      const eu = b.recycledEuKg !== undefined ? Number(b.recycledEuKg) : Math.floor((lot.recycledEuKg * q) / lot.quantityKg);
      const other = b.recycledOtherKg !== undefined ? Number(b.recycledOtherKg) : Math.floor((lot.recycledOtherKg * q) / lot.quantityKg);
      if (eu > lot.recycledEuKg || other > lot.recycledOtherKg) reject('transfer allocates more recycled material than the lot holds');
      if (eu + other > q || lot.recycledEuKg - eu + lot.recycledOtherKg - other > lot.quantityKg - q) reject('recycled share exceeds the lot quantity');
      const carbon = Number(b.carbonClass ?? lot.carbonClass);
      if (carbon < lot.carbonClass) reject('carbon class may not decrease across a transfer');
      spend(lot);
      mint({ ...lot, owner: to.id, quantityKg: q, recycledEuKg: eu, recycledOtherKg: other, carbonClass: carbon, source: 'inbox', memo: b.memo ? String(b.memo) : undefined });
      s.inbox += 1;
      let changeLotId: string | null = null;
      s.lotLeaves += 1; // the change lot is always minted on chain, even when empty
      if (lot.quantityKg - q > 0) {
        s.lotLeaves -= 1;
        changeLotId = mint({ ...lot, quantityKg: lot.quantityKg - q, recycledEuKg: lot.recycledEuKg - eu, recycledOtherKg: lot.recycledOtherKg - other, source: 'change', memo: undefined }).id;
      }
      return { changeLotId };
    }) as T;
  }
  if (p === '/v2/lots/process') {
    company();
    const ids = b.lotIds as string[];
    if (!Array.isArray(ids) || ids.length !== 2) throw new SimError('lotIds must list exactly two lots', 400, 'bad_request');
    const q = kgOk(b.quantityKg);
    const [a, c] = ids.map((id) => activeLot(t, id));
    return enqueue(t, 'processLots', async () => {
      if (!t.supplier) reject('supplier is not certified');
      if (a.material !== c.material) reject('inputs must be the same material');
      const y = Number(b.yieldPct);
      if (!s.rules.includes(`${a.material}>${b.outMaterial}>${y}`)) reject('no processing rule for these materials');
      const total = a.quantityKg + c.quantityKg;
      if (q * 100 > total * y) reject('output exceeds the processing yield');
      const seen = new Map<string, Slot>();
      for (const o of [...a.origins, ...c.origins]) seen.set(`${o.origin}|${o.issuer}`, o);
      if (seen.size > 2) reject('more than 2 distinct origins (needs a larger K)');
      spend(a);
      spend(c);
      const lot = mint({
        owner: t.id,
        material: String(b.outMaterial),
        quantityKg: q,
        recycledEuKg: Math.floor(((a.recycledEuKg + c.recycledEuKg) * q) / total),
        recycledOtherKg: Math.floor(((a.recycledOtherKg + c.recycledOtherKg) * q) / total),
        carbonClass: Math.max(a.carbonClass, c.carbonClass),
        custody: Math.max(2, a.custody, c.custody),
        origins: [...seen.values()],
        source: 'process',
      });
      return { lotId: lot.id };
    }) as T;
  }
  const attestMatch = p.match(/^\/v2\/lots\/([^/]+)\/attest-order$/);
  if (attestMatch) {
    company();
    if (!/^[0-9a-f]{64}$/i.test(String(b.challenge ?? ''))) throw new SimError('challenge must be 64 hex characters', 400, 'bad_request');
    const min = kgOk(b.minQuantityKg, 'minQuantityKg');
    const lot = activeLot(t, attestMatch[1]);
    return enqueue(t, 'attestOrder', async () => {
      if (!t.supplier) reject('supplier is not certified');
      if (lot.carbonClass > s.carbonThreshold) reject('carbon class exceeds the policy threshold');
      if (lot.quantityKg < min) reject('lot does not cover the ordered quantity');
      const k = await sha(`att|${String(b.challenge).toLowerCase()}|${t.partyId}|${min}`);
      if (s.attestations[k] !== undefined) reject('challenge already used by this holder for this quantity');
      s.nullifiers += 1; // rotate-on-attest: spend and re-mint
      s.lotLeaves += 1;
      s.attestations[k] = s.policyVersion;
      return { attestationKey: k };
    }) as T;
  }
  if (p === '/v2/periods' && method === 'GET') return s.accounts.filter((a) => a.owner === t.id).map(accountView) as T;
  if (p === '/v2/periods') {
    company();
    if (!b.plant || !b.material || !Number.isInteger(b.period)) throw new SimError('plant, period and material are required', 400, 'bad_request');
    return enqueue(t, 'openPeriod', async () => {
      if (!t.supplier) reject('supplier is not certified');
      const id = await sha(`open|${t.partyId}|${b.plant}|${b.period}|${b.material}`);
      if (s.accounts.some((a) => a.id === id)) reject('this plant/period account is already open');
      s.accounts.push({ id, owner: t.id, plant: String(b.plant), period: Number(b.period), material: String(b.material), totalKg: 0, recycledEuKg: 0, recycledOtherKg: 0, status: 'OPEN' });
      s.lotLeaves += 1;
      return { accountId: id };
    }) as T;
  }
  const account = (id: string) => {
    const a = s.accounts.find((x) => x.id === id && x.owner === t.id);
    if (!a) throw new SimError(`account ${id} not found`, 404, 'not_found');
    return a;
  };
  const consumeMatch = p.match(/^\/v2\/periods\/([^/]+)\/consume$/);
  if (consumeMatch) {
    company();
    const a = account(consumeMatch[1]);
    if (a.status !== 'OPEN') throw new SimError('account already declared', 409, 'declared');
    const lot = activeLot(t, String(b.lotId));
    return enqueue(t, 'consumeIntoPeriod', async () => {
      if (lot.material !== a.material) reject('lot material does not match the account');
      spend(lot);
      s.nullifiers += 1; // the old account note
      s.lotLeaves += 1;
      a.totalKg += lot.quantityKg;
      a.recycledEuKg += lot.recycledEuKg;
      a.recycledOtherKg += lot.recycledOtherKg;
      return { maxDeclarableBps: maxBps(a) };
    }) as T;
  }
  const declareMatch = p.match(/^\/v2\/periods\/([^/]+)\/declare$/);
  if (declareMatch) {
    company();
    const a = account(declareMatch[1]);
    if (a.status !== 'OPEN') throw new SimError('account already declared', 409, 'declared');
    return enqueue(t, 'declareShare', async () => {
      const bps = b.shareBps !== undefined ? Number(b.shareBps) : maxBps(a);
      if (a.totalKg === 0) reject('nothing was consumed in this period');
      if (bps > 10_000) reject('share above 100 percent');
      if (bps > maxBps(a)) reject('declared share exceeds the recorded recycled content');
      const salt = rand(32);
      s.declarations[await sha(`decl|${t.partyId}|${a.plant}|${a.period}|${a.material}`)] = { shareBps: bps, totalCommit: await sha(`tot|${a.totalKg}|${salt}`) };
      s.nullifiers += 1;
      Object.assign(a, { status: 'DECLARED', declaredBps: bps, salt });
      return { shareBps: bps };
    }) as T;
  }
  const pkgMatch = p.match(/^\/v2\/periods\/([^/]+)\/auditor-package$/);
  if (pkgMatch) {
    const a = account(pkgMatch[1]);
    if (a.status !== 'DECLARED' || !a.salt) throw new SimError('account not declared yet', 409, 'not_declared');
    return { owner: t.partyId, plant: a.plant, period: a.period, material: a.material, totalKg: a.totalKg, salt: a.salt } as T;
  }
  throw new SimError(`not found: ${method} ${p}`, 404, 'not_found');
}

export { SimError };
