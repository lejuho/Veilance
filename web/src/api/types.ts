// Mirrors agent/API.md (v1). bytes = lowercase hex without 0x; bigint = decimal string.

export type PartyName = 'admin' | 'mine' | 'refiner' | 'batteryMfr';
export type Role = PartyName | 'verifier';

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
  /** Agent deviation: false while wallets/providers are still being built. */
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
}
export interface Policy {
  policyVersion: string;
  carbonThreshold: number;
  origins: PolicyOrigin[];
  suppliers: PolicySupplier[];
}

export interface LedgerTx {
  txHash: string;
  blockHeight: number;
  circuit?: Circuit;
  timestamp?: string;
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
  /** API.md says number; the agent sends a decimal string (bigint). */
  inboxIndex?: number | string;
  issuedBy?: PartyName;
}

export interface ScanResult {
  found: number;
  credentials: Credential[];
}

export type Profile = 'consumer' | 'procurement' | 'regulator';
export type DisclosureOp = 'issue' | 'transfer' | 'attest';

export interface DisclosurePreview {
  public: string[];
  private: string[];
}

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
