// Veilance — the independent verifier (roadmap milestone 2, HANDOFF.md §4-2).
//
// Every other /verify/* path in this repo — even the ones handlers.ts fixed
// to use resolvePartyId/anyPartyOrThrow instead of hardcoding a hosted
// party — still runs *inside* a long-lived Party Agent process. Using them
// means trusting that process is honest and online. This script exists to
// prove that trust was never actually necessary: an OEM or a regulator can
// get the exact same PASSED/PENDING/STALE verdict the web UI shows by
// touching only public, verifiable inputs —
//
//   - the indexer's public GraphQL endpoint. `indexerPublicDataProvider(...)`
//     (see contract/e2e/lib/providers.ts) is built from two URLs alone — no
//     wallet, no proof server, no party secret, and (this is the point) no
//     running Party Agent of any kind;
//   - registry.json's public `parties` directory, for the holder's partyId
//     (a one-way hash of their secret, printed by print-identity.ts — never
//     the secret itself);
//   - the compiled contract's public `pureCircuits`/`ledger` decoder: an
//     open build artifact anyone can reproduce byte-for-byte from the
//     open-source `src/veilance.compact` with `compact compile +0.31.1`,
//     not something only the demo agent has.
//
// Run this on a machine that has never run `agent/` at all — no
// `agent/.state/`, no wallet seeds, nothing but this repo checked out,
// `contract/`'s dependencies installed, and `compile:zk` run once to get
// the public build artifact — and it reports the same verdict.
//
// Usage:
//   npx tsx src/cli/verify-independent.ts <holder> <profile> <challengeHex> [contractAddress]
//
//   holder          mine|refiner|batteryMfr|admin — whose compliance is being checked.
//   profile         consumer|procurement|regulator.
//   challengeHex    a 32-byte hex challenge from POST /verify/challenges. Not
//                   secret — it's meant to travel with the shipment/manifest
//                   (e.g. as a QR code) for exactly this kind of check.
//   contractAddress optional; defaults to AGENT_CONTRACT_ADDRESS env, then
//                   agent/.state/<network>/deployment.json if present. Both
//                   are public facts (the contract's address), not secrets —
//                   a real verifier would get this from a public
//                   announcement, not from an agent's local disk.

import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { ledger as ledgerOf, pureCircuits } from "../../../contract/src/managed/veilance/contract/index.js";
import { INDEXER_HTTP_URL, INDEXER_WS_URL, CONTRACT_ADDRESS_OVERRIDE, NETWORK_ID } from "../config.js";
import { loadDeployment } from "../state.js";
import { registry } from "../registry.js";
import { fromHex } from "../bytes.js";
import { isPartyName, isVerifierProfileName, PROFILE_CODE, type PartyName, type VerifierProfileName } from "../types.js";
import { predicatesFor, emptyPredicates } from "../predicates.js";

const usage = (): never => {
  console.error(
    "Usage: npx tsx src/cli/verify-independent.ts <mine|refiner|batteryMfr|admin> <consumer|procurement|regulator> <challengeHex> [contractAddress]",
  );
  return process.exit(1);
};

const [, , holderArg, profileArg, challengeArg, addressArg] = process.argv;

if (!holderArg || !isPartyName(holderArg)) usage();
if (!profileArg || !isVerifierProfileName(profileArg)) usage();
if (!challengeArg || !/^[0-9a-f]{64}$/i.test(challengeArg)) {
  console.error("challengeHex must be exactly 32 bytes of hex (64 hex chars).");
  usage();
}

// Runtime-validated just above; cast rather than fight TS's narrowing of a
// re-bound `const` across intervening statements.
const holder = holderArg as PartyName;
const profile = profileArg as VerifierProfileName;

const holderPartyIdHex = registry.partyId(holder);
if (!holderPartyIdHex) {
  console.error(
    `No public partyId known for "${holder}" in registry.json's "parties" directory.\n` +
      `Ask that company to run \`npx tsx src/cli/print-identity.ts ${holder}\` on the agent that ` +
      `holds their secret, and paste the printed partyId (never the secret) into this registry.json.`,
  );
  process.exit(1);
}

const address = addressArg ?? CONTRACT_ADDRESS_OVERRIDE ?? loadDeployment()?.contractAddress;
if (!address) {
  console.error(
    "No contract address given: pass it as a 4th argument, set AGENT_CONTRACT_ADDRESS, or run this " +
      `where agent/.state/${NETWORK_ID === "undeployed" ? "" : NETWORK_ID + "/"}deployment.json exists.`,
  );
  process.exit(1);
}

console.log(`Reading the indexer directly at ${INDEXER_HTTP_URL} — no wallet, no proof server, no agent process.`);
console.log(`Contract: ${address}\n`);

const publicDataProvider = indexerPublicDataProvider(INDEXER_HTTP_URL, INDEXER_WS_URL);
const state = await publicDataProvider.queryContractState(address);
if (!state) {
  console.error(`contract ${address} not found on network "${NETWORK_ID}" — wrong address or wrong network?`);
  process.exit(1);
}
const ledgerNow = ledgerOf(state.data);

const holderPartyId = fromHex(holderPartyIdHex);
const attestationKey = pureCircuits.attestationKeyOf(fromHex(challengeArg), holderPartyId, PROFILE_CODE[profile]);
const currentPolicyVersion = ledgerNow.policyVersion.toString();

type Result =
  | { status: "PENDING"; currentPolicyVersion: string; predicates: ReturnType<typeof emptyPredicates> }
  | {
      status: "PASSED" | "STALE";
      attestation: { profile: VerifierProfileName; policyVersion: string };
      currentPolicyVersion: string;
      predicates: ReturnType<typeof predicatesFor>;
    };

let result: Result;
if (!ledgerNow.attestations.member(attestationKey)) {
  result = { status: "PENDING", currentPolicyVersion, predicates: emptyPredicates() };
} else {
  const recorded = ledgerNow.attestations.lookup(attestationKey);
  const fresh = recorded.policyVersion.toString() === currentPolicyVersion;
  result = {
    status: fresh ? "PASSED" : "STALE",
    attestation: { profile, policyVersion: recorded.policyVersion.toString() },
    currentPolicyVersion,
    predicates: predicatesFor(profile),
  };
}

console.log(JSON.stringify(result, null, 2));
