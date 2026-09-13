// Measures how long a fresh wallet takes to sync on the configured network and
// prints its unshielded balance. Nothing is submitted.
//   set -a && . ./.env.preprod && set +a && npx tsx src/cli/sync-probe.ts [seedHex]
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { buildWallet, waitForSync } from "../../../contract/e2e/lib/wallet.js";
import { NETWORK_ID, FUNDER_SEED } from "../config.js";

setNetworkId(NETWORK_ID);
const seed = process.argv[2] ?? FUNDER_SEED;
const t0 = Date.now();
console.log(`network ${NETWORK_ID}: building wallet…`);
const w = await buildWallet("probe", seed);
console.log(`wallet built in ${((Date.now() - t0) / 1000).toFixed(1)} s, syncing…`);
const s = await waitForSync(w);
const night = s.unshielded.balances[ledger.unshieldedToken().raw] ?? 0n;
console.log(`synced in ${((Date.now() - t0) / 1000).toFixed(1)} s · NIGHT ${night} · DUST ${s.dust.balance(new Date())}`);
await w.facade.stop();
process.exit(0);
