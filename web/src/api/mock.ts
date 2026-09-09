/**
 * In-browser mock of the party agent (agent/API.md). Simulates the real timing shape:
 * jobs go queued → preparing → proving → submitting → confirmed | rejected.
 * State is persisted in localStorage so a demo survives a reload.
 */
import type { VeilanceApi } from './client';
import { staticDisclosure } from './disclosure';
import { PARTIES, PROFILE_CODE } from '@/lib/registry';
import {
  ApiError,
  type Challenge,
  type Circuit,
  type Credential,
  type Job,
  type JobStage,
  type LedgerTx,
  type PartyName,
  type Profile,
  type VerifyPredicate,
  type VerifyResult,
} from './types';

const STORAGE_KEY = 'veilance.mock.v1';
const ALL_PARTIES: PartyName[] = ['admin', 'mine', 'refiner', 'batteryMfr'];
const MATERIAL_LABEL: Record<string, string> = {
  cobalt: 'Cobalt',
  lithium: 'Lithium',
  nickel: 'Nickel',
  graphite: 'Graphite',
  manganese: 'Manganese',
};

// ---------- deterministic-ish hex helpers (not cryptographic; this is a mock) ----------

function randomHex(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** FNV-1a expanded to 32 bytes. Stable for attestation keys / partyIds. */
function fakeHash(...parts: (string | number)[]): string {
  const s = parts.join('|');
  let out = '';
  for (let round = 0; round < 8; round++) {
    let h = 0x811c9dc5 ^ round;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return out;
}

const PARTY_ID: Record<PartyName, string> = {
  admin: fakeHash('veilance:id', 'admin'),
  mine: fakeHash('veilance:id', 'mine'),
  refiner: fakeHash('veilance:id', 'refiner'),
  batteryMfr: fakeHash('veilance:id', 'batteryMfr'),
};
const CERT_ID: Record<PartyName, string> = {
  admin: fakeHash('cert', 'admin'),
  mine: fakeHash('cert', 'mine'),
  refiner: fakeHash('cert', 'refiner'),
  batteryMfr: fakeHash('cert', 'batteryMfr'),
};

// ---------- persisted state ----------

interface InboxEntry {
  index: number;
  recipient: PartyName;
  issuedBy: PartyName;
  cred: Omit<Credential, 'id' | 'status' | 'receivedAt'>;
  delivered: boolean;
}

interface MockState {
  contractAddress: string;
  genesisAt: number;
  baseHeight: number;
  policyVersion: number;
  carbonThreshold: number;
  origins: { originId: string; label: string }[];
  suppliers: { partyId: string; certId: string; label: string; partyName: PartyName }[];
  encKeys: Partial<Record<PartyName, string>>;
  leaves: string[];
  nullifiers: string[];
  attestations: Record<string, { profile: Profile; policyVersion: string; nullifier?: string }>;
  inbox: InboxEntry[];
  creds: Record<PartyName, Credential[]>;
  lastSeen: Record<PartyName, number>;
  jobs: Job[];
  challenges: Challenge[];
  txs: LedgerTx[];
}

function fresh(): MockState {
  return {
    contractAddress: '0200' + randomHex(30),
    genesisAt: Date.now(),
    baseHeight: 1180 + Math.floor(Math.random() * 40),
    policyVersion: 0,
    carbonThreshold: 0,
    origins: [],
    suppliers: [],
    encKeys: {},
    leaves: [],
    nullifiers: [],
    attestations: {},
    inbox: [],
    creds: { admin: [], mine: [], refiner: [], batteryMfr: [] },
    lastSeen: { admin: 0, mine: 0, refiner: 0, batteryMfr: 0 },
    jobs: [],
    challenges: [],
    txs: [],
  };
}

function load(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as MockState;
      // Jobs interrupted by a reload: the simulated agent "restarted".
      for (const j of s.jobs) {
        if (!['confirmed', 'rejected', 'failed'].includes(j.stage)) {
          j.stage = 'failed';
          j.error = 'mock agent restarted before this job finished';
          j.finishedAt = new Date().toISOString();
        }
      }
      return s;
    }
  } catch {
    /* ignore */
  }
  return fresh();
}

// ---------- mock ----------

export function createMockApi(): VeilanceApi {
  let S = load();
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    } catch {
      /* ignore */
    }
  };

  const envProve = Number(import.meta.env.VITE_MOCK_PROVE_MS);
  const PROVE_MS = Number.isFinite(envProve) && envProve > 0 ? envProve : 3000;
  const ADMIN_PROVE_MS = Math.max(400, Math.round(PROVE_MS * 0.4));

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const blockHeight = () => S.baseHeight + Math.floor((Date.now() - S.genesisAt) / 6000);
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

  class Reject extends Error {}

  const isCertified = (p: PartyName) => S.suppliers.some((s) => s.partyId === PARTY_ID[p]);
  const originCertified = (originId: string) => S.origins.some((o) => o.originId === originId);
  const originLabel = (originId: string) => S.origins.find((o) => o.originId === originId)?.label;
  const attKey = (challenge: string, holder: PartyName, profile: Profile) =>
    fakeHash('veilance:att', challenge, PARTY_ID[holder], PROFILE_CODE[profile]);

  /** Circuit execution: mutate state or throw Reject (contract assert). Runs at "proving" time like a real circuit. */
  type Exec = () => Record<string, unknown> | void;

  let chain: Promise<void> = Promise.resolve();

  function createJob(party: PartyName, circuit: Circuit): Job {
    const job: Job = { id: 'job_' + randomHex(6), party, circuit, stage: 'queued', startedAt: new Date().toISOString() };
    S.jobs.unshift(job);
    save();
    return job;
  }

  function setStage(job: Job, stage: JobStage) {
    job.stage = stage;
    save();
  }

  /** Jobs run one at a time (the real agent serialises the proof server too). */
  function schedule(job: Job, exec: Exec, proveMs: number) {
    chain = chain.then(async () => {
      const started = Date.now();
      job.startedAt = new Date(started).toISOString();
      setStage(job, 'preparing');
      await sleep(250);
      setStage(job, 'proving');
      let result: Record<string, unknown> | void = undefined;
      let rejection: string | null = null;
      try {
        result = exec();
      } catch (e) {
        rejection = e instanceof Reject ? e.message : `internal: ${(e as Error).message}`;
        if (!(e instanceof Reject)) {
          job.stage = 'failed';
          job.error = rejection;
          job.finishedAt = new Date().toISOString();
          job.elapsedMs = Date.now() - started;
          save();
          return;
        }
      }
      await sleep(proveMs);
      if (rejection) {
        job.stage = 'rejected';
        job.error = rejection;
        job.finishedAt = new Date().toISOString();
        job.elapsedMs = Date.now() - started;
        save();
        return;
      }
      setStage(job, 'submitting');
      await sleep(700);
      job.txHash = randomHex(32);
      job.blockHeight = blockHeight() + 1;
      job.result = result ?? {};
      job.stage = 'confirmed';
      job.finishedAt = new Date().toISOString();
      job.elapsedMs = Date.now() - started;
      S.txs.unshift({ txHash: job.txHash, blockHeight: job.blockHeight, circuit: job.circuit, timestamp: job.finishedAt });
      if (S.txs.length > 50) S.txs.length = 50;
      commit(job);
      save();
    });
  }

  /** Pending mutations are applied only after "confirmation" so the ledger never moves on a rejected job. */
  const pending = new Map<string, () => void>();
  function commit(job: Job) {
    const fn = pending.get(job.id);
    if (fn) {
      fn();
      pending.delete(job.id);
    }
  }
  function run(party: PartyName, circuit: Circuit, check: () => { result?: Record<string, unknown>; apply: () => void }, proveMs: number): Job {
    const job = createJob(party, circuit);
    schedule(
      job,
      () => {
        const { result, apply } = check();
        pending.set(job.id, apply);
        return result;
      },
      proveMs,
    );
    return clone(job);
  }

  // ---------- circuits ----------

  function certifyOrigin(label: string, originId?: string): Job {
    const id = originId ?? randomHex(32);
    return run(
      'admin',
      'certifyOrigin',
      () => ({
        result: { originId: id, label },
        apply: () => {
          S.origins.push({ originId: id, label });
          S.policyVersion += 1;
        },
      }),
      ADMIN_PROVE_MS,
    );
  }
  function certifySupplier(partyName: PartyName, certId?: string, certLabel?: string): Job {
    const cid = certId ?? CERT_ID[partyName];
    return run(
      'admin',
      'certifySupplier',
      () => ({
        result: { partyId: PARTY_ID[partyName], certId: cid, partyName },
        apply: () => {
          S.suppliers.push({ partyId: PARTY_ID[partyName], certId: cid, label: certLabel ?? 'RMI conformant / ISO 14001', partyName });
          S.policyVersion += 1;
        },
      }),
      ADMIN_PROVE_MS,
    );
  }
  function setThreshold(threshold: number): Job {
    return run(
      'admin',
      'setCarbonThreshold',
      () => {
        if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) throw new Reject('veilance: threshold out of range');
        return {
          result: { carbonThreshold: threshold },
          apply: () => {
            S.carbonThreshold = threshold;
            S.policyVersion += 1;
          },
        };
      },
      ADMIN_PROVE_MS,
    );
  }
  function registerEncKey(party: PartyName): Job {
    return run(
      party,
      'registerEncKey',
      () => {
        const pk = S.encKeys[party] ?? fakeHash('x25519', party);
        return { result: { encPk: pk }, apply: () => void (S.encKeys[party] = pk) };
      },
      ADMIN_PROVE_MS,
    );
  }

  function deliver(recipient: PartyName, issuedBy: PartyName, cred: InboxEntry['cred']) {
    const index = S.inbox.length;
    S.inbox.push({ index, recipient, issuedBy, cred, delivered: false });
    return index;
  }

  function issue(party: PartyName, input: { recipient: PartyName; originId: string; materialType: string; carbonClass: number; note?: string }): Job {
    if (!S.encKeys[input.recipient]) throw new ApiError(`recipient ${input.recipient} has no registered encryption key`, 'NO_ENC_KEY', 400);
    if (!Number.isInteger(input.carbonClass) || input.carbonClass < 0 || input.carbonClass > 255)
      throw new ApiError('carbonClass must be 0..255', 'BAD_INPUT', 400);
    return run(
      party,
      'issueProvenance',
      () => {
        if (!isCertified(party)) throw new Reject('veilance: supplier not certified');
        if (!originCertified(input.originId)) throw new Reject('veilance: origin not certified');
        const commitment = randomHex(32);
        const material = input.materialType.toLowerCase();
        return {
          result: { commitment, inboxIndex: S.inbox.length, recipient: input.recipient },
          apply: () => {
            S.leaves.push(commitment);
            deliver(input.recipient, party, {
              commitment,
              originId: input.originId,
              originLabel: originLabel(input.originId),
              materialType: material,
              materialLabel: MATERIAL_LABEL[material] ?? input.materialType,
              carbonClass: input.carbonClass,
              issuedBy: party,
            });
          },
        };
      },
      PROVE_MS,
    );
  }

  function transfer(party: PartyName, credentialId: string, input: { recipient: PartyName; carbonClass: number }): Job {
    const cred = S.creds[party].find((c) => c.id === credentialId);
    if (!cred) throw new ApiError('credential not found', 'NOT_FOUND', 404);
    if (!S.encKeys[input.recipient]) throw new ApiError(`recipient ${input.recipient} has no registered encryption key`, 'NO_ENC_KEY', 400);
    return run(
      party,
      'transferProvenance',
      () => {
        const nullifier = fakeHash('veilance:nf', cred.commitment);
        if (cred.status === 'CONSUMED' || S.nullifiers.includes(nullifier)) throw new Reject('veilance: credential already consumed');
        if (!S.leaves.includes(cred.commitment)) throw new Reject('veilance: credential not in provenance tree');
        if (!isCertified(party)) throw new Reject('veilance: supplier not certified');
        if (!originCertified(cred.originId)) throw new Reject('veilance: origin not certified');
        if (input.carbonClass < cred.carbonClass) throw new Reject('veilance: carbon class must not decrease');
        const newCommitment = randomHex(32);
        return {
          result: { nullifier, newCommitment, inboxIndex: S.inbox.length },
          apply: () => {
            S.nullifiers.push(nullifier);
            S.leaves.push(newCommitment);
            cred.status = 'CONSUMED';
            deliver(input.recipient, party, {
              commitment: newCommitment,
              originId: cred.originId,
              originLabel: cred.originLabel,
              materialType: cred.materialType,
              materialLabel: cred.materialLabel,
              carbonClass: input.carbonClass,
              issuedBy: party,
            });
          },
        };
      },
      PROVE_MS,
    );
  }

  function attest(party: PartyName, credentialId: string, input: { profile: Profile; challenge: string }): Job {
    const cred = S.creds[party].find((c) => c.id === credentialId);
    if (!cred) throw new ApiError('credential not found', 'NOT_FOUND', 404);
    if (!/^[0-9a-f]{64}$/i.test(input.challenge)) throw new ApiError('challenge must be 32 bytes hex', 'BAD_INPUT', 400);
    const circuit: Circuit =
      input.profile === 'consumer' ? 'attestConsumer' : input.profile === 'procurement' ? 'attestProcurement' : 'attestRegulator';
    return run(
      party,
      circuit,
      () => {
        const key = attKey(input.challenge.toLowerCase(), party, input.profile);
        if (S.attestations[key]) throw new Reject('veilance: attestation already recorded for this challenge');
        if (!S.leaves.includes(cred.commitment)) throw new Reject('veilance: credential not in provenance tree');
        if (!originCertified(cred.originId)) throw new Reject('veilance: origin not certified');
        if (input.profile !== 'consumer') {
          if (!isCertified(party)) throw new Reject('veilance: supplier not certified');
          if (cred.carbonClass > S.carbonThreshold) throw new Reject('veilance: carbon class exceeds threshold');
        }
        const nullifier = fakeHash('veilance:nf', cred.commitment);
        if (input.profile === 'regulator' && (cred.status === 'CONSUMED' || S.nullifiers.includes(nullifier)))
          throw new Reject('veilance: credential already consumed');
        const policyVersion = String(S.policyVersion);
        return {
          result: { attestationKey: key, profile: input.profile, policyVersion },
          apply: () => {
            S.attestations[key] = { profile: input.profile, policyVersion, ...(input.profile === 'regulator' ? { nullifier } : {}) };
          },
        };
      },
      PROVE_MS,
    );
  }

  function scan(party: PartyName) {
    const found: Credential[] = [];
    for (const e of S.inbox) {
      if (e.index < S.lastSeen[party]) continue;
      if (e.recipient !== party || e.delivered) continue; // trial-decrypt fails for others
      e.delivered = true;
      const c: Credential = {
        id: 'cred_' + e.cred.commitment.slice(0, 12),
        ...e.cred,
        status: 'ACTIVE',
        receivedAt: new Date().toISOString(),
        inboxIndex: e.index,
      };
      S.creds[party].push(c);
      found.push(c);
    }
    S.lastSeen[party] = S.inbox.length;
    save();
    return { found: found.length, credentials: clone(found) };
  }

  function verify(challenge: string, holder: PartyName, profile: Profile): VerifyResult {
    const key = attKey(challenge.toLowerCase(), holder, profile);
    const att = S.attestations[key];
    const current = String(S.policyVersion);
    const checks: Record<string, boolean> = {
      responsibleSourcing: true,
      chainOfCustody: true,
      supplierCertification: profile !== 'consumer',
      carbonThreshold: profile !== 'consumer',
      restrictedSource: true,
      duplicateClaim: profile === 'regulator',
    };
    const labels: Record<string, string> = {
      responsibleSourcing: 'Responsible sourcing',
      chainOfCustody: 'Valid chain of custody',
      supplierCertification: 'Supplier certification',
      carbonThreshold: 'Carbon class ≤ threshold',
      restrictedSource: 'Restricted source',
      duplicateClaim: 'Duplicate claim',
    };
    const predicates: VerifyPredicate[] = Object.keys(labels).map((k) => ({
      key: k,
      label: labels[k],
      passed: att ? (checks[k] ? true : null) : null,
    }));
    return {
      status: !att ? 'PENDING' : att.policyVersion === current ? 'PASSED' : 'STALE',
      attestation: att ? { profile: att.profile, policyVersion: att.policyVersion } : undefined,
      currentPolicyVersion: current,
      predicates,
      private: ['Upstream supplier', 'Origin', 'Material amount', 'Commercial relationship'],
    };
  }

  const api: VeilanceApi = {
    mode: 'mock',
    async health() {
      return {
        ok: true,
        devnet: { node: true, indexer: true, proofServer: { ok: true, version: 'mock' } },
        contractAddress: S.contractAddress,
        deployed: true,
      };
    },
    async parties() {
      return ALL_PARTIES.map((name) => ({
        name,
        partyId: PARTY_ID[name],
        encPk: S.encKeys[name],
        certified: isCertified(name),
        encKeyRegistered: !!S.encKeys[name],
        night: '1000000000000',
        dust: '250000000',
      }));
    },
    async deploy() {
      return { contractAddress: S.contractAddress };
    },
    async ledger() {
      return {
        contractAddress: S.contractAddress,
        blockHeight: blockHeight(),
        adminId: PARTY_ID.admin,
        policyVersion: String(S.policyVersion),
        carbonThreshold: S.carbonThreshold,
        provenanceLeafCount: S.leaves.length,
        nullifierCount: S.nullifiers.length,
        attestationCount: Object.keys(S.attestations).length,
        inboxCount: S.inbox.length,
        encKeyCount: Object.keys(S.encKeys).length,
        certifiedOriginCount: S.origins.length,
        certifiedSupplierCount: S.suppliers.length,
      };
    },
    async policy() {
      return {
        policyVersion: String(S.policyVersion),
        carbonThreshold: S.carbonThreshold,
        origins: clone(S.origins),
        suppliers: S.suppliers.map((s) => ({ ...s, label: `${PARTIES[s.partyName].org} · ${s.label}` })),
      };
    },
    async txs() {
      return clone(S.txs);
    },
    async job(id) {
      const j = S.jobs.find((x) => x.id === id);
      if (!j) throw new ApiError('job not found', 'NOT_FOUND', 404);
      return clone(j);
    },
    async jobs(party) {
      return clone(party ? S.jobs.filter((j) => j.party === party) : S.jobs);
    },
    async addOrigin({ label, originId }) {
      if (originId && S.origins.some((o) => o.originId === originId)) throw new ApiError('originId already certified', 'DUPLICATE', 409);
      return certifyOrigin(label, originId);
    },
    async addSupplier({ partyName, certId, certLabel }) {
      return certifySupplier(partyName, certId, certLabel);
    },
    async setCarbonThreshold(threshold) {
      return setThreshold(threshold);
    },
    async bootstrap() {
      const jobs: Job[] = [];
      if (!S.origins.length) jobs.push(certifyOrigin('DRC Mine X'));
      for (const p of ['mine', 'refiner', 'batteryMfr'] as PartyName[]) if (!isCertified(p)) jobs.push(certifySupplier(p));
      jobs.push(setThreshold(5));
      for (const p of ALL_PARTIES) if (!S.encKeys[p]) jobs.push(registerEncKey(p));
      return { jobs };
    },
    async registerEncKey(party) {
      return registerEncKey(party);
    },
    async credentials(party) {
      return clone(S.creds[party]);
    },
    async scan(party) {
      await sleep(600);
      return scan(party);
    },
    async issue(party, input) {
      return issue(party, input);
    },
    async transfer(party, id, input) {
      return transfer(party, id, input);
    },
    async attest(party, id, input) {
      return attest(party, id, input);
    },
    async disclosurePreview(_party, op, profile) {
      return staticDisclosure(op, profile);
    },
    async createChallenge({ profile, holder }) {
      const challenge = randomHex(32);
      const c: Challenge = { challenge, attestationKey: attKey(challenge, holder, profile), profile, holder, createdAt: new Date().toISOString() };
      S.challenges.unshift(c);
      save();
      return clone(c);
    },
    async challenges() {
      return clone(S.challenges);
    },
    async verify(challenge, holder, profile) {
      return verify(challenge, holder, profile);
    },
    resetMock() {
      S = fresh();
      pending.clear();
      save();
    },
  };
  return api;
}
