// Veilance Party Agent — GET /explorer/* (v1.1 addendum): read-only chain
// reads proxied from the indexer GraphQL v4 API, for the UI's in-app
// explorer panel (no hosted block explorer exists for a local devnet).
//
// Queries below were verified against the live local indexer
// (http://localhost:8088/api/v4/graphql, indexer-standalone 4.2.1) with
// curl/introspection before being written here — see agent/README.md
// "Explorer & graph" for the exact transcripts. Two schema surprises that
// shaped these queries:
//   - `Block.parent` (not `parentHash`) — a nested `Block`, so `parent { hash }`.
//   - `transactionResult` / `identifiers` / `contractActions[].entryPoint`
//     live on the `RegularTransaction` variant of the `Transaction`
//     interface, not on the base interface — every tx query below uses an
//     inline `... on RegularTransaction { ... }` fragment for them.
// Also: contrary to the general indexer skill's "local devnet uses v3, not
// v4" guidance, THIS project's local indexer (see contract/e2e/lib/config.ts)
// answers v4 fine — already relied on by ledgerRead.ts's `fetchBlockHeight`
// and every `currentLedger` call before this change; reconfirmed here.

import { currentLedger } from "../../contract/e2e/lib/party.js";
import { appState } from "./appState.js";
import { INDEXER_HTTP_URL } from "./config.js";
import { toHex } from "./bytes.js";
import { listJobs } from "./jobs.js";
import type {
  ExplorerBlock,
  ExplorerContract,
  ExplorerContractAction,
  ExplorerContractActionKind,
  ExplorerTip,
  ExplorerTx,
} from "./types.js";

const gql = async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
  const res = await fetch(INDEXER_HTTP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors && body.errors.length > 0) {
    throw new Error(`indexer error: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  return body.data as T;
};

const isoFromEpochMs = (ms: number): string => new Date(ms).toISOString();

const KIND_OF: Record<string, ExplorerContractActionKind> = {
  ContractDeploy: "deploy",
  ContractCall: "call",
  ContractUpdate: "update",
};

// ---------------------------------------------------------------------------
// GET /explorer/tip
// ---------------------------------------------------------------------------

/** Verified: `curl -d '{"query":"query { block { hash height timestamp } }"}'`. */
const TIP_QUERY = `query { block { hash height timestamp } }`;

export const getExplorerTip = async (): Promise<ExplorerTip> => {
  const data = await gql<{ block: { hash: string; height: number; timestamp: number } | null }>(TIP_QUERY);
  if (!data.block) throw new Error("indexer reports no chain tip");
  return {
    blockHeight: data.block.height,
    blockHash: data.block.hash,
    timestamp: isoFromEpochMs(data.block.timestamp),
  };
};

// ---------------------------------------------------------------------------
// GET /explorer/block/:height
// ---------------------------------------------------------------------------

/** Verified against block 1295 (this deployment's deploy block). */
const BLOCK_QUERY = `
  query($h: Int!) {
    block(offset: { height: $h }) {
      hash
      height
      timestamp
      parent { hash }
      transactions { hash }
    }
  }
`;

export const getExplorerBlock = async (height: number): Promise<ExplorerBlock | null> => {
  const data = await gql<{
    block: {
      hash: string;
      height: number;
      timestamp: number;
      parent: { hash: string } | null;
      transactions: Array<{ hash: string }>;
    } | null;
  }>(BLOCK_QUERY, { h: height });
  if (!data.block) return null;
  return {
    height: data.block.height,
    hash: data.block.hash,
    parentHash: data.block.parent?.hash,
    timestamp: isoFromEpochMs(data.block.timestamp),
    txCount: data.block.transactions.length,
    txHashes: data.block.transactions.map((t) => t.hash),
  };
};

// ---------------------------------------------------------------------------
// GET /explorer/tx/:hash
// ---------------------------------------------------------------------------

/**
 * Verified against this deployment's deploy tx
 * (9c8b1a856ee0e0129e26c7c9a4d1616be8257c863a9812d1435f5c703e6baff6) and a
 * transferProvenance tx — see agent/README.md.
 */
const TX_QUERY = `
  query($h: HexEncoded!) {
    transactions(offset: { hash: $h }) {
      hash
      block { height hash timestamp }
      ... on RegularTransaction {
        transactionResult { status }
        identifiers
        contractActions {
          __typename
          address
          ... on ContractCall { entryPoint }
        }
      }
    }
  }
`;

type RawTx = {
  hash: string;
  block: { height: number; hash: string; timestamp: number };
  transactionResult?: { status: string };
  identifiers?: string[];
  contractActions?: Array<{ __typename: string; address: string; entryPoint?: string }>;
};

export const getExplorerTx = async (hash: string): Promise<ExplorerTx | null> => {
  const data = await gql<{ transactions: RawTx[] }>(TX_QUERY, { h: hash });
  const tx = data.transactions[0];
  if (!tx) return null;

  const status = tx.transactionResult
    ? tx.transactionResult.status === "FAILURE"
      ? "failed"
      : ("applied" as const) // SUCCESS or PARTIAL_SUCCESS both count as "applied" for this coarse UI status
    : undefined;

  return {
    hash: tx.hash,
    blockHeight: tx.block.height,
    blockHash: tx.block.hash,
    timestamp: isoFromEpochMs(tx.block.timestamp),
    status,
    contractActions: (tx.contractActions ?? []).map((a) => ({
      address: a.address,
      kind: KIND_OF[a.__typename] ?? "call",
      entryPoint: a.entryPoint,
    })),
    identifiers: tx.identifiers,
    source: "indexer",
  };
};

// ---------------------------------------------------------------------------
// GET /explorer/contract
// ---------------------------------------------------------------------------

/**
 * The indexer's `contractAction(address, offset?)` returns ONE action (the
 * latest, or the one at a given block/tx offset) — never a paginated list
 * for an address (same constraint documented for `GET /ledger/txs` in
 * agent/README.md). So the actions list here is built the same
 * already-established way: from the agent's own confirmed job history
 * (authoritative for txHash/blockHeight/party/circuit — this agent is the
 * sole actor against this contract in the demo). The one row that
 * independently round-trips through the indexer is the chain's own current
 * latest action, fetched once here and cross-matched by txHash — that row
 * is tagged `source: "indexer"`; every other row is `source: "agent"`.
 */
const LATEST_ACTION_QUERY = `
  query($a: HexEncoded!) {
    contractAction(address: $a) {
      __typename
      address
      ... on ContractCall { entryPoint }
      transaction { hash }
    }
  }
`;

export const getExplorerContract = async (): Promise<ExplorerContract> => {
  const address = appState.contractAddressOrThrow();
  const tip = await getExplorerTip();

  let latest: { txHash: string; kind: ExplorerContractActionKind; entryPoint?: string } | undefined;
  try {
    const data = await gql<{
      contractAction: { __typename: string; address: string; entryPoint?: string; transaction: { hash: string } } | null;
    }>(LATEST_ACTION_QUERY, { a: address });
    if (data.contractAction) {
      latest = {
        txHash: data.contractAction.transaction.hash,
        kind: KIND_OF[data.contractAction.__typename] ?? "call",
        entryPoint: data.contractAction.entryPoint,
      };
    }
  } catch {
    latest = undefined; // best effort — the job-history-derived actions[] below still stands on its own
  }

  const confirmedJobs = listJobs().filter((j) => j.stage === "confirmed" && j.txHash !== undefined);
  const deployJob = confirmedJobs.find((j) => j.circuit === "deploy");

  const actions: ExplorerContractAction[] = confirmedJobs
    .map((j): ExplorerContractAction => {
      const isLatest = latest?.txHash === j.txHash;
      const kind: ExplorerContractActionKind = j.circuit === "deploy" ? "deploy" : isLatest ? latest!.kind : "call";
      const entryPoint = j.circuit === "deploy" ? undefined : (isLatest ? latest!.entryPoint : undefined) ?? j.circuit;
      return {
        txHash: j.txHash as string,
        blockHeight: j.blockHeight ?? 0,
        timestamp: j.finishedAt,
        kind,
        entryPoint,
        party: j.party,
        circuit: j.circuit,
        jobId: j.id,
        source: isLatest ? "indexer" : "agent",
      };
    })
    .sort((a, b) => b.blockHeight - a.blockHeight);

  return {
    address,
    deployTxHash: deployJob?.txHash,
    deployBlockHeight: deployJob?.blockHeight,
    latestBlockHeight: tip.blockHeight,
    actionCount: actions.length,
    actions,
  };
};

// ---------------------------------------------------------------------------
// GET /explorer/ledger-raw
// ---------------------------------------------------------------------------

/**
 * The decoded ledger object — counts (same as `GET /ledger`) plus the
 * Merkle roots `GET /ledger` omits, for a "what the chain actually holds"
 * panel. Roots are `MerkleTreeDigest` (`{ field: bigint }` — see
 * @midnight-ntwrk/compact-runtime's compact-types.d.ts), rendered as decimal
 * strings like every other bigint in this API.
 */
export const getExplorerLedgerRaw = async (): Promise<Record<string, unknown>> => {
  const address = appState.contractAddressOrThrow();
  const anyProviders = appState.partyOrThrow("admin").party.providers;
  const ledger = await currentLedger(anyProviders, address);

  return {
    contractAddress: address,
    adminId: toHex(ledger.adminId),
    policyVersion: ledger.policyVersion.toString(),
    carbonThreshold: Number(ledger.carbonThreshold),
    provenanceLeafCount: Number(ledger.provenanceTree.firstFree()),
    provenanceRoot: ledger.provenanceTree.root().field.toString(),
    nullifierCount: Number(ledger.nullifiers.size()),
    attestationCount: Number(ledger.attestations.size()),
    inboxCount: Number(ledger.credentialInboxCount),
    encKeyCount: Number(ledger.partyEncKeys.size()),
    certifiedOriginCount: Number(ledger.certifiedOrigins.firstFree()),
    certifiedOriginsRoot: ledger.certifiedOrigins.root().field.toString(),
    certifiedSupplierCount: Number(ledger.certifiedSuppliers.firstFree()),
    certifiedSuppliersRoot: ledger.certifiedSuppliers.root().field.toString(),
  };
};
