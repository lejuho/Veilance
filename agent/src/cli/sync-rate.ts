// Logs wallet sync progress for ~3 minutes to estimate first-sync time on the
// configured network. Nothing is submitted.
import * as Rx from "rxjs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { buildWallet } from "../../../contract/e2e/lib/wallet.js";
import { NETWORK_ID, FUNDER_SEED } from "../config.js";

setNetworkId(NETWORK_ID);
const w = await buildWallet("probe", process.argv[2] ?? FUNDER_SEED);
const t0 = Date.now();
const fmt = (p: unknown) => {
  const d = p as { appliedIndex?: bigint; highestIndex?: bigint; highestRelevantIndex?: bigint; isConnected?: boolean } | undefined;
  return d ? `applied=${d.appliedIndex} highest=${d.highestIndex} relevant=${d.highestRelevantIndex} conn=${d.isConnected}` : "n/a";
};
const sub = w.facade.state().pipe(Rx.throttleTime(10_000)).subscribe((s) => {
  const sh = (s.shielded as unknown as { progress?: unknown }).progress;
  const un = (s.unshielded as unknown as { progress?: unknown }).progress;
  const du = (s.dust as unknown as { progress?: unknown }).progress;
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s synced=${s.isSynced} | shielded ${fmt(sh)} | unshielded ${fmt(un)} | dust ${fmt(du)}`);
});
setTimeout(async () => { sub.unsubscribe(); await w.facade.stop(); process.exit(0); }, 180_000);
