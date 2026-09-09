// Veilance e2e — ZK build check.
//
// `npm run compile` (--skip-zk) only emits src/managed/veilance/{compiler,contract,zkir}.
// The full ZK build (`npm run compile:zk`) additionally emits keys/ with a
// prover + verifier key per circuit — that's what the proof server and the
// SDK's ZK config provider actually need to prove and verify real
// transactions. This check fails fast with an actionable message instead of
// letting a missing key surface as an opaque proof-provider error deep into
// the demo.

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { ZK_CONFIG_DIR } from "./config.js";

const EXPECTED_CIRCUITS = [
  "registerEncKey",
  "certifyOrigin",
  "certifySupplier",
  "setCarbonThreshold",
  "issueProvenance",
  "transferProvenance",
  "attestConsumer",
  "attestProcurement",
  "attestRegulator",
] as const;

export type ZkBuildCheck = {
  readonly ok: boolean;
  readonly keysDir: string;
  readonly missingCircuits: string[];
  readonly message: string;
};

export const checkZkBuild = (): ZkBuildCheck => {
  const keysDir = path.join(ZK_CONFIG_DIR, "keys");

  if (!existsSync(ZK_CONFIG_DIR)) {
    return {
      ok: false,
      keysDir,
      missingCircuits: [...EXPECTED_CIRCUITS],
      message:
        `${ZK_CONFIG_DIR} does not exist. Run "npm run compile" (or "npm run compile:zk") ` +
        "from the contract/ directory first.",
    };
  }

  if (!existsSync(keysDir)) {
    return {
      ok: false,
      keysDir,
      missingCircuits: [...EXPECTED_CIRCUITS],
      message:
        `${keysDir} is missing. The e2e script needs the FULL ZK build (prover + verifier ` +
        'keys per circuit), not the --skip-zk build. Run "npm run compile:zk" from the ' +
        "contract/ directory first (~76s on this machine per NOTES.md), then re-run the e2e script.",
    };
  }

  const present = new Set(readdirSync(keysDir));
  const missingCircuits = EXPECTED_CIRCUITS.filter(
    (c) => !present.has(`${c}.prover`) && !present.has(`${c}.verifier`),
  );

  if (missingCircuits.length > 0) {
    return {
      ok: false,
      keysDir,
      missingCircuits,
      message:
        `${keysDir} exists but is missing key files for: ${missingCircuits.join(", ")}. ` +
        'The ZK build may be stale or incomplete — re-run "npm run compile:zk".',
    };
  }

  return { ok: true, keysDir, missingCircuits: [], message: `Full ZK build found at ${keysDir}.` };
};
