// Prints the unshielded (NIGHT) address of the funder wallet and the four party
// wallets for the configured network, WITHOUT syncing anything — so the
// addresses can be pasted into a faucet before the agent is ever started.
//
//   cd agent && set -a && . ./.env.preprod && set +a && npx tsx src/cli/addresses.ts
import { createKeystore } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import { deriveKeys } from "../../../contract/e2e/lib/wallet.js";
import { NETWORK_ID, PARTY_NAMES, WALLET_SEEDS, FUNDER_SEED } from "../config.js";

const hexToBytes = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));
const addressOf = (seedHex: string): string => {
  const keys = deriveKeys(hexToBytes(seedHex));
  const keystore = createKeystore(keys[Roles.NightExternal], NETWORK_ID);
  // keystore.getAddress() is the 32-byte hex UserAddress; wrap it for bech32m encoding.
  const raw = new UnshieldedAddress(Buffer.from(String(keystore.getAddress()).replace(/^0x/, ""), "hex"));
  return UnshieldedAddress.codec.encode(NETWORK_ID as never, raw).asString();
};

console.log(`network: ${NETWORK_ID}`);
console.log(`funder     ${FUNDER_SEED ? addressOf(FUNDER_SEED) : "(no VEILANCE_FUNDER_SEED set)"}`);
for (const p of PARTY_NAMES) console.log(`${p.padEnd(10)} ${addressOf(WALLET_SEEDS[p])}`);
