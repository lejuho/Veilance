// Veilance Party Agent — configuration.
//
// Network/devnet endpoints, wallet seeds, and the ZK config directory are
// all reused verbatim from contract/e2e/lib/config.ts (same devnet, same
// four demo parties, same funded wallets) — never forked. This file adds
// only what is specific to the agent process itself: the HTTP port, the CORS
// origin, and this agent's OWN state directory (kept separate from the e2e
// script's `contract/e2e/.state` so the two never contend for the same
// LevelDB private-state files).

import path from "node:path";
import { fileURLToPath } from "node:url";

export {
  NETWORK_ID,
  NODE_URL,
  NODE_WS_URL,
  INDEXER_HTTP_URL,
  INDEXER_WS_URL,
  PROOF_SERVER_URL,
  PARTY_NAMES,
  WALLET_SEEDS,
  GENESIS_WALLET_SEED,
  FUNDER_SEED,
  IS_LOCAL_DEVNET,
  SHARED_FEE_WALLET,
  FUNDING_AMOUNT,
  ZK_CONFIG_DIR,
  PRIVATE_STATE_PASSWORD,
  type PartyName,
} from "../../contract/e2e/lib/config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const AGENT_DIR = path.resolve(here, "..");
import { NETWORK_ID as _NET } from "../../contract/e2e/lib/config.js";
// Local devnet keeps the historical `.state`; every other network gets its own
// directory so a testnet deployment never mixes with devnet vaults.
export const AGENT_STATE_DIR = _NET === "undeployed" ? path.join(AGENT_DIR, ".state") : path.join(AGENT_DIR, ".state", _NET);
export const DEPLOYMENT_JSON_PATH = path.join(AGENT_STATE_DIR, "deployment.json");
export const CHALLENGES_JSON_PATH = path.join(AGENT_STATE_DIR, "challenges.json");
export const REGISTRY_SEED_PATH = path.join(AGENT_DIR, "registry.json");
export const REGISTRY_RUNTIME_JSON_PATH = path.join(AGENT_STATE_DIR, "registry-runtime.json");

export const PORT = Number(process.env.PORT ?? 4000);
// Comma-separated list. Both spellings of the dev origin are allowed by default so a
// browser opened on 127.0.0.1 is not rejected.
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173";
export const CORS_ORIGINS = CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
