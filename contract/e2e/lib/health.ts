// Veilance e2e — devnet health checks.
//
// Mirrors the checks in the `midnight-tooling:devnet-health` skill
// (node /health, indexer /ready, proof-server /version), plus a version
// probe for the proof server. This contract is now compiled with Compact
// 0.31.1 / @midnight-ntwrk/compact-runtime 0.16.0 — the STABLE (ledger-v8 /
// onchain-runtime-v3) generation, matching the official support matrix and
// this task's devnet.yml (node 0.22.5, proof-server 8.1.0). So this check
// now warns if the proof server it finds is NOT 8.x — that would mean the
// devnet is running the next-generation (ledger-v9) images this project
// deliberately migrated away from (see README.md "Version compatibility"
// for that history), which this contract's compiled output can no longer
// talk to.

import { NODE_URL, INDEXER_HTTP_URL, PROOF_SERVER_URL } from "./config.js";

export type ServiceHealth = {
  readonly name: string;
  readonly healthy: boolean;
  readonly detail: string;
  readonly ms: number;
};

const probe = async (
  name: string,
  url: string,
  init?: RequestInit,
  timeoutMs = 5_000,
): Promise<ServiceHealth> => {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const ms = Date.now() - start;
    const text = await res.text().catch(() => "");
    return {
      name,
      healthy: res.ok,
      detail: res.ok ? text.slice(0, 200) : `HTTP ${res.status}: ${text.slice(0, 200)}`,
      ms,
    };
  } catch (err) {
    return {
      name,
      healthy: false,
      detail: err instanceof Error ? err.message : String(err),
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
};

/** Node health endpoint (see devnet-health skill: `/health`). */
const checkNode = () => probe("node", `${NODE_URL}/health`);

/**
 * Indexer readiness. The local "undeployed" indexer-standalone image exposes
 * `/ready`; we also probe the GraphQL endpoint itself since /ready is not
 * part of the v4 API surface this task's devnet.yml documents explicitly.
 */
const checkIndexer = () =>
  probe("indexer", INDEXER_HTTP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "{ __typename }" }),
  });

/** Proof server version endpoint (see devnet-health skill: `/version`). */
const checkProofServer = () => probe("proof-server", `${PROOF_SERVER_URL}/version`);

export type DevnetHealthReport = {
  readonly node: ServiceHealth;
  readonly indexer: ServiceHealth;
  readonly proofServer: ServiceHealth;
  readonly allHealthy: boolean;
  /** Non-fatal warnings about likely ledger-generation mismatches. */
  readonly warnings: string[];
};

export const checkDevnetHealth = async (): Promise<DevnetHealthReport> => {
  const [node, indexer, proofServer] = await Promise.all([
    checkNode(),
    checkIndexer(),
    checkProofServer(),
  ]);

  const warnings: string[] = [];
  if (proofServer.healthy && !/^8\./.test(proofServer.detail.trim())) {
    warnings.push(
      `proof-server reports version "${proofServer.detail.trim()}" — expected an 8.x ` +
        "(ledger-v8 / onchain-runtime-v3) proof server. This contract is compiled with " +
        "Compact 0.31.1 / @midnight-ntwrk/compact-runtime 0.16.0, which is the STABLE " +
        "generation and needs an 8.x proof server (this task's devnet.yml pins 8.1.0). " +
        "A next-generation (9.x) proof server will not be able to prove transactions " +
        "for this contract. See README.md 'Version compatibility'.",
    );
  }

  return {
    node,
    indexer,
    proofServer,
    allHealthy: node.healthy && indexer.healthy && proofServer.healthy,
    warnings,
  };
};

export const formatHealthReport = (report: DevnetHealthReport): string => {
  const line = (s: ServiceHealth) =>
    `  ${s.healthy ? "OK  " : "FAIL"}  ${s.name.padEnd(12)} ${s.ms}ms  ${s.detail}`;
  const lines = [
    "Devnet health:",
    line(report.node),
    line(report.indexer),
    line(report.proofServer),
  ];
  for (const w of report.warnings) {
    lines.push(`  WARN  ${w}`);
  }
  return lines.join("\n");
};
