// Prints a party's PUBLIC identity — partyId (= H("veilance:id", partySecret))
// and certId — for pasting into registry.json's "parties" directory on every
// OTHER agent that needs to certify this party (roadmap milestone 1,
// HANDOFF.md §4: per-company agent separation; see registry.ts and
// handlers.ts's resolvePartyId()).
//
// Run this on the agent that actually holds the party's secret — the one
// whose agent/.state/<party>/agent.json exists. It reads only that local
// file; nothing is sent anywhere. The partySecret itself is never printed.
//
// Needs the compiled contract (npm run compile:zk in contract/ first), since
// partyIdOf is the contract's own hash, not something this script can fake.
//
//   cd agent && npx tsx src/cli/print-identity.ts mine

import { pureCircuits } from "../../../contract/src/managed/veilance/contract/index.js";
import { AGENT_STATE_DIR } from "../config.js";
import { isPartyName } from "../types.js";
import { loadOrCreatePartyFile } from "../state.js";
import { fromHex, toHex } from "../bytes.js";
import { registry } from "../registry.js";

const partyArg = process.argv[2];
if (!partyArg || !isPartyName(partyArg)) {
  console.error(`Usage: npx tsx src/cli/print-identity.ts <mine|refiner|batteryMfr|admin>`);
  console.error(`(reads the existing agent/.state/<party>/agent.json under ${AGENT_STATE_DIR} — it must already exist, i.e. this agent has booted at least once as that party.)`);
  process.exit(1);
}

// Does not create a fresh identity: printing a partyId for a party this
// agent has never actually run as would be meaningless (a new random secret
// every invocation). loadOrCreatePartyFile's certId fallback is unused here
// (existing files always have one) — passed only to satisfy the signature.
const file = loadOrCreatePartyFile(partyArg, registry.supplierCertId(partyArg) ?? "0".repeat(64));
const partyId = toHex(pureCircuits.partyIdOf(fromHex(file.partySecret)));

console.log(`Public identity for "${partyArg}" — safe to share, paste into every other agent's registry.json:\n`);
console.log(JSON.stringify({ parties: { [partyArg]: { partyId } } }, null, 2));
console.log(`\ncertId (unchanged, already public in registry.json's "suppliers" section): ${file.certId}`);
