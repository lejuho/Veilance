// Veilance Party Agent — per-party JSON sidecar persistence.
//
// Alongside each party's LevelDB private-state provider (the contract
// witness state: partySecret, certId, held/issueSpec, etc. — see
// contract/src/witnesses.ts), each party keeps a small JSON sidecar at
// agent/.state/<party>/agent.json holding everything the AGENT itself needs
// that is not part of `VeilancePrivateState`: the X25519 inbox keypair, the
// party's held-credential vault with labels, `lastSeenInboxIndex`, and this
// party's job history.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { AGENT_STATE_DIR, CHALLENGES_JSON_PATH, DEPLOYMENT_JSON_PATH } from "./config.js";
import type { Job, PartyAgentFile, PartyName, StoredChallenge } from "./types.js";
import { toHex } from "./bytes.js";

const partyDir = (party: PartyName): string => path.join(AGENT_STATE_DIR, party);
const partyFilePath = (party: PartyName): string => path.join(partyDir(party), "agent.json");

const readJson = <T>(filePath: string): T | null => {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
};

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, filePath);
};

/** Loads a party's agent.json, or creates a fresh one (new random partySecret) if missing. */
export const loadOrCreatePartyFile = (party: PartyName, certId: string): PartyAgentFile => {
  const existing = readJson<PartyAgentFile>(partyFilePath(party));
  if (existing) {
    // Backfill: vaults written before `issued[]` existed (agent/API.md v1.1
    // addendum) have no such field — graph.ts always reads it via `?? []`
    // too, but normalizing it here means every other reader/writer of this
    // file can assume the array is always present.
    if (!existing.issued) existing.issued = [];
    return existing;
  }
  const fresh: PartyAgentFile = {
    partySecret: toHex(randomBytes(32)),
    certId,
    heldCredentials: [],
    lastSeenInboxIndex: "0",
    jobs: [],
    issued: [],
  };
  writeJsonAtomic(partyFilePath(party), fresh);
  return fresh;
};

export const savePartyFile = (party: PartyName, file: PartyAgentFile): void => {
  writeJsonAtomic(partyFilePath(party), file);
};

// --- deployment.json --------------------------------------------------------

export type DeploymentFile = { contractAddress: string };

export const loadDeployment = (): DeploymentFile | null => readJson<DeploymentFile>(DEPLOYMENT_JSON_PATH);

export const saveDeployment = (file: DeploymentFile): void => writeJsonAtomic(DEPLOYMENT_JSON_PATH, file);

// --- challenges.json (global — verifiers have no party/wallet) -------------

export const loadChallenges = (): StoredChallenge[] => readJson<StoredChallenge[]>(CHALLENGES_JSON_PATH) ?? [];

export const saveChallenges = (challenges: StoredChallenge[]): void =>
  writeJsonAtomic(CHALLENGES_JSON_PATH, challenges);

// --- job history helpers -----------------------------------------------------

/** Upserts `job` into `file.jobs` (by id) and persists the whole file. */
export const upsertJob = (party: PartyName, file: PartyAgentFile, job: Job): void => {
  const idx = file.jobs.findIndex((j) => j.id === job.id);
  if (idx === -1) file.jobs.push(job);
  else file.jobs[idx] = job;
  savePartyFile(party, file);
};
