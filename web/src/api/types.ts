// Mirrors agent/API.md (v1 + v1.1 addendum). bytes = lowercase hex without 0x; bigint = decimal string.

export type PartyName = 'admin' | 'mine' | 'refiner' | 'batteryMfr';
export type NodeId = PartyName | 'verifier';

export type Circuit =
  | 'deploy'
  | 'registerEncKey'
  | 'certifyOrigin'
  | 'certifySupplier'
  | 'setCarbonThreshold'
  | 'issueProvenance'
  | 'transferProvenance'
  | 'attestConsumer'
  | 'attestProcurement'
  | 'attestRegulator';

export type JobStage = 'queued' | 'preparing' | 'proving' | 'submitting' | 'confirmed' | 'rejected' | 'failed';

export interface Job {
  id: string;
  party: PartyName;
  circuit: Circuit;
  stage: JobStage;
  startedAt: string;
  finishedAt?: string;
  elapsedMs?: number;
  txHash?: string;
  blockHeight?: number;
  result?: Record<string, unknown>;
  error?: string;
}

export interface Health {
  ok: boolean;
  ready?: boolean;
  step?: string;
  bootError?: string;
  devnet: { node: boolean; indexer: boolean; proofServer: { ok: boolean; version?: string } };
  contractAddress?: string;
  deployed: boolean;
}

export interface Party {
  name: PartyName;
  partyId: string;
  encPk?: string;
  certified: boolean;
  encKeyRegistered: boolean;
  night: string;
  dust: string;
}

export interface Ledger {
  contractAddress: string;
  blockHeight: number;
  adminId: string;
  policyVersion: string;
  carbonThreshold: number;
  provenanceLeafCount: number;
  nullifierCount: number;
  attestationCount: number;
  inboxCount: number;
  encKeyCount: number;
  certifiedOriginCount: number;
  certifiedSupplierCount: number;
}

export interface PolicyOrigin {
  originId: string;
  label?: string;
}
export interface PolicySupplier {
  partyId: string;
  certId: string;
  label?: string;
  partyName?: PartyName;
  org?: string;
}
export interface Policy {
  policyVersion: string;
  carbonThreshold: number;
  origins: PolicyOrigin[];
  suppliers: PolicySupplier[];
}

export type CredentialStatus = 'ACTIVE' | 'CONSUMED';

export interface Credential {
  id: string;
  commitment: string;
  originId: string;
  originLabel?: string;
  materialType: string;
  materialLabel?: string;
  carbonClass: number;
  status: CredentialStatus;
  receivedAt: string;
  inboxIndex?: number | string;
  issuedBy?: PartyName;
}

export interface ScanResult {
  found: number;
  credentials: Credential[];
}

export type Profile = 'consumer' | 'procurement' | 'regulator';

export interface Challenge {
  challenge: string;
  attestationKey: string;
  profile: Profile;
  holder: PartyName;
  createdAt: string;
}

export type VerifyStatus = 'PENDING' | 'PASSED' | 'STALE';

export interface VerifyPredicate {
  key: string;
  label: string;
  passed: boolean | null;
}

export interface VerifyResult {
  status: VerifyStatus;
  attestation?: { profile: Profile; policyVersion: string };
  currentPolicyVersion: string;
  predicates: VerifyPredicate[];
  private: string[];
}

export interface IssueInput {
  recipient: PartyName;
  originId: string;
  materialType: string;
  carbonClass: number;
  note?: string;
}
export interface TransferInput {
  recipient: PartyName;
  carbonClass: number;
}
export interface AttestInput {
  profile: Profile;
  challenge: string;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = 'ERROR', status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/* ---------- v1.1 addendum: graph + explorer ---------- */

export type EdgeStatus = 'ISSUED' | 'DELIVERED' | 'CONSUMED';

export interface GraphNode {
  id: NodeId;
  org: string;
  role: string;
  certified: boolean;
  encKeyRegistered: boolean;
  held: number;
  consumed: number;
  attestations: number;
  lastActivityAt?: string;
}
export interface GraphEdge {
  id: string;
  from: PartyName;
  to: PartyName;
  credentialId: string;
  commitment: string;
  status: EdgeStatus;
  circuit: 'issueProvenance' | 'transferProvenance';
  txHash?: string;
  blockHeight?: number;
  inboxIndex?: number | string;
  carbonClass?: number;
  materialLabel?: string;
  originLabel?: string;
  createdAt: string;
  jobId?: string;
  lotNumber?: number;
  /** Optional extras (the mock fills them; a real agent may not). */
  nullifier?: string;
  consumedTxHash?: string;
  consumedBlockHeight?: number;
  deliveredAt?: string;
  /** Evidence panel (circuit name, verifier key, proving time) — mock and a real agent both may omit `provingMs` if job history has aged out. */
  provingMs?: number;
  verifierKeyFingerprint?: string;
}
export interface GraphAttestation {
  holder: PartyName;
  profile: Profile;
  attestationKey: string;
  policyVersion: string;
  txHash?: string;
  blockHeight?: number;
  challenge?: string;
  createdAt: string;
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  attestations: GraphAttestation[];
  activeJob?: Job;
  queue: Job[];
}

export interface ExplorerTip {
  blockHeight: number;
  blockHash?: string;
  timestamp?: string;
}
export interface ExplorerBlock {
  height: number;
  hash?: string;
  parentHash?: string;
  timestamp?: string;
  txCount: number;
  txHashes: string[];
}
export interface ExplorerContractAction {
  address?: string;
  kind: 'deploy' | 'call' | 'update';
  entryPoint?: string;
}
export interface ExplorerTx {
  hash: string;
  blockHeight: number;
  blockHash?: string;
  timestamp?: string;
  status?: 'applied' | 'failed';
  contractActions: ExplorerContractAction[];
  identifiers?: string[];
  party?: PartyName;
  circuit?: string;
}
export interface ExplorerContract {
  address: string;
  deployTxHash?: string;
  deployBlockHeight?: number;
  latestBlockHeight: number;
  actionCount: number;
  actions: {
    txHash: string;
    blockHeight: number;
    timestamp?: string;
    kind: 'deploy' | 'call' | 'update';
    entryPoint?: string;
    party?: PartyName;
    circuit?: string;
    jobId?: string;
  }[];
}
export type LedgerRaw = Record<string, unknown>;
