// Veilance Party Agent — the single in-memory mutable state blob.
//
// One process hosts all four parties (see agent/API.md's opening paragraph),
// so this is deliberately a plain module-level singleton rather than a class
// threaded through every function — there is exactly one of these per
// process, same as there is exactly one job queue and one HTTP server.

import type { Party } from "../../contract/e2e/lib/party.js";
import type { VeilanceContract } from "./contractSetup.js";
import type { Job, PartyAgentFile, PartyName, StoredChallenge } from "./types.js";

export type AppParty = {
  readonly name: PartyName;
  readonly party: Party;
  /** The persisted JSON sidecar — mutated in place, then saved via state.ts. */
  file: PartyAgentFile;
  /** Set once the contract is deployed/found (see bootstrap.ts / POST /deploy). */
  contract?: VeilanceContract;
};

export type BootStatus = {
  ready: boolean;
  error?: string;
  /** Human-readable progress line, surfaced on GET /health while booting. */
  step: string;
};

class AppState {
  boot: BootStatus = { ready: false, step: "starting" };
  contractAddress: string | undefined;
  readonly parties = new Map<PartyName, AppParty>();
  /** All jobs, across all parties, keyed by id — for GET /jobs/:id. */
  readonly jobsById = new Map<string, Job>();
  challenges: StoredChallenge[] = [];

  partyOrThrow(name: PartyName): AppParty {
    const p = this.parties.get(name);
    if (!p) throw new Error(`unknown or not-yet-built party: ${name}`);
    return p;
  }

  contractOrThrow(name: PartyName): VeilanceContract {
    const c = this.partyOrThrow(name).contract;
    if (!c) throw new Error("contract not deployed yet — POST /deploy first");
    return c;
  }

  contractAddressOrThrow(): string {
    if (!this.contractAddress) throw new Error("contract not deployed yet — POST /deploy first");
    return this.contractAddress;
  }

  registerJob(job: Job): void {
    this.jobsById.set(job.id, job);
  }
}

export const appState = new AppState();
