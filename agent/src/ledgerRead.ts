// Veilance Party Agent — public ledger reads (GET /ledger, /ledger/policy,
// /ledger/txs), via the indexer public data provider + the contract's own
// `ledger()` decoder — exactly how contract/e2e/run.ts's final verification
// step reads state (see `currentLedger` in contract/e2e/lib/party.ts, reused
// here, not forked).

import { pureCircuits } from "../../contract/src/managed/veilance/contract/index.js";
import { currentLedger } from "../../contract/e2e/lib/party.js";
import { appState } from "./appState.js";
import { INDEXER_HTTP_URL, PARTY_NAMES } from "./config.js";
import { fromHex, toHex } from "./bytes.js";
import { registry } from "./registry.js";
import { listJobs } from "./jobs.js";

/** Latest chain tip height, via a raw GraphQL `{ block { height } }` query (no offset = latest). */
export const fetchBlockHeight = async (): Promise<number> => {
  const res = await fetch(INDEXER_HTTP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "query { block { height } }" }),
  });
  const body = (await res.json()) as { data?: { block?: { height: number } | null }; errors?: unknown };
  const height = body.data?.block?.height;
  if (typeof height !== "number") throw new Error(`could not read block height from indexer: ${JSON.stringify(body)}`);
  return height;
};

export const getLedgerSummary = async (contractAddress: string) => {
  const anyProviders = appState.anyPartyOrThrow().party.providers;
  const [ledger, blockHeight] = await Promise.all([
    currentLedger(anyProviders, contractAddress),
    fetchBlockHeight(),
  ]);
  return {
    contractAddress,
    blockHeight,
    adminId: toHex(ledger.adminId),
    policyVersion: ledger.policyVersion.toString(),
    carbonThreshold: Number(ledger.carbonThreshold),
    provenanceLeafCount: Number(ledger.provenanceTree.firstFree()),
    nullifierCount: Number(ledger.nullifiers.size()),
    attestationCount: Number(ledger.attestations.size()),
    inboxCount: Number(ledger.credentialInboxCount),
    encKeyCount: Number(ledger.partyEncKeys.size()),
    certifiedOriginCount: Number(ledger.certifiedOrigins.firstFree()),
    certifiedSupplierCount: Number(ledger.certifiedSuppliers.firstFree()),
  };
};

/**
 * `certifiedOrigins` / `certifiedSuppliers` are `MerkleTree`s, which expose
 * membership-for-a-known-leaf (`findPathForLeaf`) but no enumeration of
 * leaves — there is no way to list "every certified origin" from the tree
 * alone. So this checks membership for each candidate the agent's own
 * registry knows about (every origin it ever asked to certify, and each of
 * the three known supplier candidates), which is authoritative for this
 * single-admin demo: only origins/suppliers this agent actually certified
 * end up in the registry to begin with.
 */
export const getPolicySummary = async (contractAddress: string) => {
  const anyProviders = appState.anyPartyOrThrow().party.providers;
  const ledger = await currentLedger(anyProviders, contractAddress);

  const origins = registry
    .allOrigins()
    .filter(({ originId }) => ledger.certifiedOrigins.findPathForLeaf(fromHex(originId)) !== undefined)
    .map(({ originId, label }) => ({ originId, label }));

  const suppliers: Array<{ partyId: string; certId: string; label?: string; partyName?: string; org?: string }> = [];
  for (const name of PARTY_NAMES) {
    if (name === "admin") continue;
    const certIdHex = registry.supplierCertId(name);
    if (!certIdHex) continue;
    const appParty = appState.parties.get(name);
    if (!appParty) continue;
    const partyId = pureCircuits.partyIdOf(fromHex(appParty.file.partySecret));
    const certLeaf = pureCircuits.certLeafOf(partyId, fromHex(certIdHex));
    if (ledger.certifiedSuppliers.findPathForLeaf(certLeaf) === undefined) continue;
    suppliers.push({
      partyId: toHex(partyId),
      certId: certIdHex,
      label: registry.supplierCertLabel(name),
      partyName: name,
      org: registry.orgName(name),
    });
  }

  return {
    policyVersion: ledger.policyVersion.toString(),
    carbonThreshold: Number(ledger.carbonThreshold),
    origins,
    suppliers,
  };
};

/**
 * Best-effort recent contract tx list. The indexer's `contractAction(address,
 * offset)` query returns a single action (at `offset`, default latest), not
 * a paginated list for an address — so rather than walking block-by-block
 * from genesis (slow, and still address-filtered client-side), this derives
 * the list from the agent's own confirmed job history, which is authoritative
 * for txHash/blockHeight/circuit since this agent is the sole actor against
 * this contract in the demo. Documented as a deviation in README.md.
 */
export const getRecentTxs = (): Array<{ txHash: string; blockHeight: number; circuit?: string; timestamp?: string }> =>
  listJobs()
    .filter((j) => j.stage === "confirmed" && j.txHash !== undefined)
    .map((j) => ({ txHash: j.txHash as string, blockHeight: j.blockHeight ?? 0, circuit: j.circuit, timestamp: j.finishedAt }))
    .sort((a, b) => b.blockHeight - a.blockHeight);
