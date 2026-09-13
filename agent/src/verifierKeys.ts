// Veilance Party Agent — verifier key fingerprints (roadmap milestone 3,
// HANDOFF.md §4-3: "circuit name, verifier key, proving time" in the web
// UI's lot drawer Evidence section).
//
// The verifier key itself (`contract/src/managed/veilance/keys/<circuit>.verifier`)
// is a public build artifact — every party's agent has the identical bytes,
// since it comes from compiling the same open-source `src/veilance.compact`
// with the pinned `compact +0.31.1` toolchain (see contract/e2e/README.md
// §2.0). It is NOT a secret, and it is NOT specific to any one proof — the
// same verifier key checks every proof for that circuit, forever (until the
// contract is redeployed with a different circuit). So rather than expose
// the ~2KB key itself over the API, this module reduces it to a short
// fingerprint (sha256, first 16 hex chars — enough to eyeball-compare across
// two parties' agents without shipping the whole key) and caches it: read
// once per circuit per process, never re-read on every /graph request.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { ZK_CONFIG_DIR } from "../../contract/e2e/lib/config.js";

const cache = new Map<string, string>();

/**
 * Short sha256 fingerprint of `<circuit>.verifier`'s bytes, or `undefined`
 * if the ZK build is missing (mirrors zk.ts's `checkZkBuild` — this module
 * doesn't re-throw the "run compile:zk" message itself since callers like
 * graph.ts already surface that at boot).
 */
export const verifierKeyFingerprint = (circuit: string): string | undefined => {
  const cached = cache.get(circuit);
  if (cached) return cached;
  try {
    const bytes = readFileSync(path.join(ZK_CONFIG_DIR, "keys", `${circuit}.verifier`));
    const fingerprint = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    cache.set(circuit, fingerprint);
    return fingerprint;
  } catch {
    return undefined;
  }
};
