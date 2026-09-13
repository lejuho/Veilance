// Veilance Party Agent — GET /graph (v1.1 addendum): the supply-chain view.
//
// Edges are derived primarily from each issuer's persisted `issued[]` vault
// (see types.ts's `IssuedEntry`, written by handlers.ts's startIssueJob /
// startTransferJob). Credentials issued/transferred before that field
// existed have no `issued[]` entry, so this module falls back to
// reconstructing an equivalent event from confirmed job history — and, for
// the one field job history sometimes lacks (the transfer recipient, added
// to Job.result only recently — see agent/README.md), from decrypting the
// specific sealed inbox entry with each of the four known parties' X25519
// keys. That last step is not a guess: `recipientHasEncKey` guarantees the
// real recipient is always one of the four parties this single-process demo
// agent already holds `encSk` for, so exactly one key opens the entry
// (`openCredential` returns non-null only for the party it was sealed to —
// see contract/src/sealed-entry.ts's AEAD construction).

import { openCredential } from "../../contract/src/sealed-entry.js";
import { currentLedger } from "../../contract/e2e/lib/party.js";
import { pureCircuits } from "../../contract/src/managed/veilance/contract/index.js";
import { appState } from "./appState.js";
import { fromHex, toHex } from "./bytes.js";
import { registry } from "./registry.js";
import { PARTY_NAMES, type PartyName } from "./config.js";
import { getActiveJob, getQueuedJobs, listJobs } from "./jobs.js";
import type {
  EdgeStatus,
  Graph,
  GraphAttestation,
  GraphEdge,
  GraphNode,
  HeldCredential,
  Job,
  VerifierProfileName,
} from "./types.js";

const ROLE_LABELS: Record<PartyName | "verifier", string> = {
  admin: "Policy admin",
  mine: "Mine",
  refiner: "Refiner",
  batteryMfr: "Battery maker",
  verifier: "Verifier",
};

/** UX_V3.md §4.3: the verifier card is always displayed as "OEM". */
const VERIFIER_ORG = "OEM";

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

const buildPartyNode = async (name: PartyName): Promise<GraphNode> => {
  const appParty = appState.partyOrThrow(name);
  let certified = false;
  let encKeyRegistered = false;

  if (appState.contractAddress) {
    const ledger = await currentLedger(appParty.party.providers, appState.contractAddress);
    const partyId = pureCircuits.partyIdOf(fromHex(appParty.file.partySecret));
    encKeyRegistered = ledger.partyEncKeys.member(partyId);
    const certIdHex = registry.supplierCertId(name);
    if (certIdHex) {
      const certLeaf = pureCircuits.certLeafOf(partyId, fromHex(certIdHex));
      certified = ledger.certifiedSuppliers.findPathForLeaf(certLeaf) !== undefined;
    }
  }

  const held = appParty.file.heldCredentials.filter((c) => c.status === "ACTIVE").length;
  const consumed = appParty.file.heldCredentials.filter((c) => c.status === "CONSUMED").length;
  const partyJobs = listJobs(name); // newest first
  const attestations = partyJobs.filter((j) => j.stage === "confirmed" && j.circuit.startsWith("attest")).length;
  const lastActivityAt = partyJobs.find((j) => j.stage === "confirmed")?.finishedAt;

  return {
    id: name,
    org: registry.orgName(name),
    role: ROLE_LABELS[name],
    certified,
    encKeyRegistered,
    held,
    consumed,
    attestations,
    lastActivityAt,
  };
};

const buildVerifierNode = (): GraphNode => {
  const allJobs = listJobs(); // newest first
  const attestations = allJobs.filter((j) => j.stage === "confirmed" && j.circuit.startsWith("attest")).length;
  const lastAttestAt = allJobs.find((j) => j.stage === "confirmed" && j.circuit.startsWith("attest"))?.finishedAt;
  const lastChallengeAt = [...appState.challenges].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
    ?.createdAt;
  const lastActivityAt = [lastAttestAt, lastChallengeAt]
    .filter((d): d is string => d !== undefined)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return {
    id: "verifier",
    org: VERIFIER_ORG,
    role: ROLE_LABELS.verifier,
    certified: false,
    encKeyRegistered: false,
    held: 0,
    consumed: 0,
    attestations,
    lastActivityAt,
  };
};

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

type RawEvent = {
  from: PartyName;
  to?: PartyName;
  commitment: string;
  circuit: "issueProvenance" | "transferProvenance";
  txHash?: string;
  blockHeight?: number;
  inboxIndex?: number;
  carbonClass?: number;
  materialLabel?: string;
  originLabel?: string;
  createdAt: string;
  jobId?: string;
};

const findHeldByCommitment = (commitment: string): { party: PartyName; cred: HeldCredential } | undefined => {
  for (const name of PARTY_NAMES) {
    const appParty = appState.parties.get(name);
    if (!appParty) continue;
    const cred = appParty.file.heldCredentials.find((c) => c.id === commitment);
    if (cred) return { party: name, cred };
  }
  return undefined;
};

/**
 * Legacy-data fallback: decrypts the specific inbox entry against every
 * known party's `encSk` to find who a pre-`recipient`-field transfer job
 * actually sealed its new commitment to. See this file's header comment for
 * why exactly one key is guaranteed to succeed.
 */
const resolveRecipientByDecryption = async (
  inboxIndex: number,
  expectedCommitmentHex: string,
): Promise<PartyName | undefined> => {
  if (!appState.contractAddress) return undefined;
  const anyProviders = appState.partyOrThrow("admin").party.providers;
  const ledgerNow = await currentLedger(anyProviders, appState.contractAddress);
  const index = BigInt(inboxIndex);
  if (!ledgerNow.credentialInbox.member(index)) return undefined;
  const entry = ledgerNow.credentialInbox.lookup(index);

  for (const name of PARTY_NAMES) {
    const encSkHex = appState.parties.get(name)?.file.encSk;
    if (!encSkHex) continue;
    const opened = openCredential(fromHex(encSkHex), entry);
    if (opened && toHex(opened.commitment) === expectedCommitmentHex) return name;
  }
  return undefined;
};

const buildRawEvents = (): RawEvent[] => {
  const events: RawEvent[] = [];
  const seen = new Set<string>();

  // 1. Authoritative going forward: each issuer's own persisted vault.
  for (const name of PARTY_NAMES) {
    const appParty = appState.parties.get(name);
    if (!appParty) continue;
    for (const entry of appParty.file.issued ?? []) {
      const commitment = entry.commitment.toLowerCase();
      if (seen.has(commitment)) continue;
      seen.add(commitment);
      events.push({
        from: name,
        to: entry.recipient,
        commitment,
        circuit: entry.circuit,
        txHash: entry.txHash,
        blockHeight: entry.blockHeight,
        inboxIndex: entry.inboxIndex,
        carbonClass: entry.carbonClass,
        materialLabel: entry.materialLabel,
        originLabel: entry.originLabel,
        createdAt: entry.createdAt,
        jobId: entry.jobId,
      });
    }
  }

  // 2. Fallback for anything predating `issued[]`: reconstruct from confirmed
  // job history. `to` is filled in later (held-credential lookup, then
  // inbox decryption) for jobs whose result predates the `recipient` field.
  for (const job of listJobs()) {
    if (job.stage !== "confirmed") continue;
    if (job.circuit !== "issueProvenance" && job.circuit !== "transferProvenance") continue;
    const commitmentRaw = job.result?.commitment ?? job.result?.newCommitment;
    if (typeof commitmentRaw !== "string" || commitmentRaw === "") continue;
    const commitment = commitmentRaw.toLowerCase();
    if (seen.has(commitment)) continue;
    seen.add(commitment);

    const recipientRaw = job.result?.recipient;
    const to =
      typeof recipientRaw === "string" && (PARTY_NAMES as readonly string[]).includes(recipientRaw)
        ? (recipientRaw as PartyName)
        : undefined;
    const inboxIndexRaw = job.result?.inboxIndex;
    const inboxIndex = inboxIndexRaw === undefined ? undefined : Number(inboxIndexRaw);

    events.push({
      from: job.party,
      to,
      commitment,
      circuit: job.circuit,
      txHash: job.txHash,
      blockHeight: job.blockHeight,
      inboxIndex,
      createdAt: job.finishedAt ?? job.startedAt,
      jobId: job.id,
    });
  }

  return events.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
};

const edgeStatusOf = (held: HeldCredential | undefined): EdgeStatus => {
  if (!held) return "ISSUED";
  return held.status === "CONSUMED" ? "CONSUMED" : "DELIVERED";
};

const buildEdges = async (): Promise<GraphEdge[]> => {
  const events = buildRawEvents(); // oldest first — creation order for lotNumber

  const edges: GraphEdge[] = [];
  let lotNumber = 0;

  for (const ev of events) {
    const held = findHeldByCommitment(ev.commitment);
    let to = ev.to ?? held?.party;
    if (!to && ev.inboxIndex !== undefined) {
      to = await resolveRecipientByDecryption(ev.inboxIndex, ev.commitment);
    }
    if (!to) {
      // Genuinely unresolvable (e.g. the recipient never registered an enc
      // key and the entry cannot be opened by any known party) — omit
      // rather than fabricate a recipient. Not expected in this closed
      // four-party demo; see agent/README.md "Explorer & graph".
      continue;
    }

    lotNumber += 1;
    edges.push({
      id: ev.jobId ?? `${ev.from}-${to}-${ev.commitment.slice(0, 12)}`,
      from: ev.from,
      to,
      credentialId: ev.commitment,
      commitment: ev.commitment,
      status: edgeStatusOf(held?.cred),
      circuit: ev.circuit,
      txHash: ev.txHash,
      blockHeight: ev.blockHeight,
      inboxIndex: ev.inboxIndex,
      carbonClass: held?.cred.carbonClass ?? ev.carbonClass,
      materialLabel: held?.cred.materialLabel ?? ev.materialLabel,
      originLabel: held?.cred.originLabel ?? ev.originLabel,
      createdAt: ev.createdAt,
      jobId: ev.jobId,
      lotNumber,
      nullifier: held?.cred.consumedNullifier,
      consumedTxHash: held?.cred.consumedTxHash,
      consumedBlockHeight: held?.cred.consumedBlockHeight,
      deliveredAt: held?.cred.receivedAt,
    });
  }

  return edges;
};

// ---------------------------------------------------------------------------
// Attestations
// ---------------------------------------------------------------------------

const buildAttestations = (): GraphAttestation[] => {
  const attestJobs = listJobs().filter((j) => j.stage === "confirmed" && j.circuit.startsWith("attest"));
  return attestJobs.map((j) => {
    const attestationKey = typeof j.result?.attestationKey === "string" ? j.result.attestationKey : "";
    const matchingChallenge = appState.challenges.find((c) => c.attestationKey === attestationKey);
    return {
      holder: j.party,
      profile: (typeof j.result?.profile === "string" ? j.result.profile : "consumer") as VerifierProfileName,
      attestationKey,
      policyVersion: typeof j.result?.policyVersion === "string" ? j.result.policyVersion : "",
      txHash: j.txHash,
      blockHeight: j.blockHeight,
      challenge: matchingChallenge?.challenge,
      createdAt: j.finishedAt ?? j.startedAt,
    };
  });
};

// ---------------------------------------------------------------------------
// Top level
// ---------------------------------------------------------------------------

export const buildGraph = async (): Promise<Graph> => {
  const partyNodes = await Promise.all(PARTY_NAMES.map((name) => buildPartyNode(name)));
  const nodes: GraphNode[] = [...partyNodes, buildVerifierNode()];

  const edges = await buildEdges();
  const attestations = buildAttestations();

  const activeJob: Job | undefined = getActiveJob();
  const queue = getQueuedJobs();

  return { nodes, edges, attestations, activeJob, queue };
};
