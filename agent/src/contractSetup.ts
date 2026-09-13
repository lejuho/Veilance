// Veilance Party Agent — the compiled contract handle, and deploy/find
// wrappers. Identical construction to contract/e2e/run.ts (same compiled
// contract, same witnesses, same ZK assets) — reused via import, not forked.

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";

import { Contract } from "../../contract/src/managed/veilance/contract/index.js";
import { witnesses, type VeilancePrivateState } from "../../contract/src/witnesses.js";
import { VEILANCE_PRIVATE_STATE_ID } from "../../contract/e2e/lib/providers.js";
import type { Party } from "../../contract/e2e/lib/party.js";
import { ZK_CONFIG_DIR } from "./config.js";

export const compiledContract = CompiledContract.make("veilance", Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(ZK_CONFIG_DIR),
);

export type VeilanceContract = FoundContract<Contract<VeilancePrivateState>>;

/** Deploys a fresh contract instance, acting as `party` (must be admin). */
export const deployVeilance = (party: Party): Promise<DeployedContract<Contract<VeilancePrivateState>>> =>
  deployContract(party.providers, {
    compiledContract,
    privateStateId: VEILANCE_PRIVATE_STATE_ID,
    initialPrivateState: party.privateState,
  });

/** Reconnects `party` to an already-deployed contract at `contractAddress`. */
export const findVeilance = (party: Party, contractAddress: string): Promise<VeilanceContract> =>
  findDeployedContract(party.providers, {
    contractAddress,
    compiledContract,
    privateStateId: VEILANCE_PRIVATE_STATE_ID,
    initialPrivateState: party.privateState,
  });
