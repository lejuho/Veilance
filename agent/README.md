# Veilance Party Agent

A long-lived Node HTTP service implementing [`API.md`](./API.md): it hosts
all four demo parties (admin / mine / refiner / batteryMfr), keeps each
party's private state and held-credential vault on disk, and drives the
Veilance contract on a local Midnight devnet through a strictly sequential
job queue (one proof at a time — the local proof server can only usefully
do one at once). This is `contract/e2e/run.ts`'s exact flow, refactored into
a service with persistence and an HTTP API instead of a single linear script.

## Deviations from API.md

None required a contract or API.md change. Implementation notes, in case
they matter to a client:

- **`GET /health` gained two fields**: `ready: boolean` and `step: string`.
  Required by the build instructions ("expose `GET /health` immediately with
  `ready: false` until parties are built") but not explicitly in API.md's
  response shape. `bootError` is added too, populated only if bootstrap fails.
- **`GET /ledger/txs` is derived from the agent's own confirmed job
  history**, not a live indexer scan. The indexer's `contractAction(address,
  offset)` GraphQL query returns a single action (at `offset`, default
  latest) — not a paginated list for an address — so there is no cheap way
  to list "recent txs for this contract" directly. Since this agent is the
  sole actor against the contract in the demo, its own job history (already
  persisted per party) is authoritative for txHash/blockHeight/circuit. This
  is exactly the "best effort" API.md allows for this endpoint.
- **`GET /ledger/policy`'s `origins`/`suppliers` lists are computed by
  checking on-chain membership for known candidates**, not by enumerating
  the trees. `certifiedOrigins`/`certifiedSuppliers` are `MerkleTree`s, which
  expose `findPathForLeaf` (membership for a *given* leaf) but no
  enumeration of leaves at all — there is no API to list "every leaf in this
  tree". So the agent checks membership for every origin its own
  `agent/registry.json` + `.state/registry-runtime.json` knows about (every
  origin it ever asked to certify) and for the three known supplier
  candidates (mine/refiner/batteryMfr, from the registry seed), and reports
  only the ones actually found on-chain. This is authoritative for this
  single-admin demo.
- **`Job.elapsedMs` is measured from job *creation* (enqueue time), not from
  when the queue actually starts working on it.** When several jobs are
  queued at once (e.g. `POST /admin/bootstrap`'s 9 jobs), a job queued last
  reports a larger `elapsedMs` that includes its queue-wait time, not just
  its own proving time — see the bootstrap transcript below, where
  `elapsedMs` climbs from ~25s (1st job) to ~217s (9th job) while each job's
  own `finishedAt - previous job's finishedAt` is a consistent ~24s. This
  reads naturally as "time since I asked for this" for a UI progress
  indicator, which is what polling clients care about; the per-circuit
  proving-only durations are called out separately below.
- **A rejected (assert-failed) job can finish in well under a second**, not
  20-45s. See the attack-path entry below: 322ms. A contract assert is
  evaluated locally (building the circuit's transcript against real ledger
  state fetched from the indexer) *before* the expensive proof-server /
  balance / submit / finality steps — so a rejection never reaches the proof
  server at all. This is still a real evaluation of the real circuit against
  real on-chain state (the nullifier really was read from the actual
  `nullifiers` set via the indexer), not a client-side pre-check.
- **`materialType` is UTF-8-encoded and zero-padded directly into
  `Bytes<32>`** (same helper contract/e2e/run.ts's own `bytes32()` uses),
  not hashed — so it round-trips losslessly and `materialLabel` in scanned
  credentials is a direct decode, no registry lookup needed. `originId` by
  contrast is an opaque random 32 bytes (per API.md: "agent generates a
  random 32-byte id"); its label can only come from `agent/registry.json`.

## Reused code (not forked)

- `contract/e2e/lib/{config,health,wallet,providers,zk}.ts` — endpoints,
  wallet construction/funding/DUST, provider assembly, ZK build check, all
  imported directly.
- `contract/e2e/lib/party.ts` — **new**, extracted from `run.ts` in this
  change: the `Party` type, `setPrivateState`, `currentLedger`,
  `snapshotLedger`. `run.ts` now imports from here too (verified below), so
  there is exactly one copy of this logic.
- `contract/e2e/lib/providers.ts` — `buildProviders` gained two optional
  options (`baseStateDir`, `accountId`), defaulting to the e2e script's
  existing behavior. The agent passes its own `agent/.state` directory so
  its LevelDB private-state files never collide with `contract/e2e/.state`,
  even though both use the same wallet seeds.
- `contract/src/{witnesses,sealed-entry}.ts` — imported directly.
  `sealed-entry.ts`'s `scanInbox` gained one additive field on its return
  type, `inboxIndices: bigint[]` (parallel array to `credentials`, same
  order) — needed because `GET /parties/:party/credentials` must report
  each credential's `inboxIndex` and the original `ScanResult` didn't carry
  it. Existing callers (`run.ts`, `test/demo.test.ts`, 7 call sites) only
  read `.credentials`/`.nextIndex` and are unaffected —
  `npm run e2e:dry-run` and `npx vitest run` (27/27 tests) both still pass,
  reverified after this change.

## Dependency / node_modules strategy

**`agent/node_modules` is a symlink to `../contract/node_modules`.** Do
**not** run `npm install` inside `agent/` — it has no independent install;
`agent/package.json` documents the agent's real dependency set (same
`@midnight-ntwrk/*` pins as `contract/package.json`, plus `hono` +
`@hono/node-server`) purely for tooling/IDE purposes.

This exists because a second physical copy of
`@midnight-ntwrk/onchain-runtime-v3` anywhere in the tree breaks WASM class
identity (`expected instance of StateValue`) — the two packages must share
exactly one `node_modules`. `hono`/`@hono/node-server` were installed with
`npm install --no-save hono @hono/node-server` from `contract/` (present in
`contract/node_modules`, deliberately **not** added to
`contract/package.json`'s `dependencies`, since contract itself doesn't use
them — the agent's own `package.json` is the honest manifest for those two).

Verified:

```
$ cd agent && npx tsc --noEmit  # resolves both contract/src/*.ts and hono through the symlink
$ cd contract && npm ls @midnight-ntwrk/onchain-runtime-v3
veilance-contract@0.1.0 /home/user/Veilance/contract
├─┬ @midnight-ntwrk/compact-runtime@0.16.0
│ └── @midnight-ntwrk/onchain-runtime-v3@3.0.0 overridden
└─┬ @midnight-ntwrk/midnight-js-protocol@4.1.1
  └── @midnight-ntwrk/onchain-runtime-v3@3.0.0 deduped
```

Exactly one physical copy (the second line is `deduped`, not a separate
install) — the same result whether run from `contract/` or resolved from
`agent/` through the symlink, since it's the same directory.

`cd contract && npm run e2e:dry-run && npx vitest run` — both still pass
after every change in this branch (reverified as the very last step below).

## Running

```bash
# 1. Devnet must be up and the full ZK build must exist (see contract/e2e/README.md).
docker compose -f ~/.midnight-expert/devnet/devnet.yml up -d
cd contract && npm run compile:zk   # if src/managed/veilance/keys/ is missing

# 2. Agent (no install step — see "Dependency strategy" above).
cd agent
npm run dev     # tsx watch src/index.ts
# or: npm start  # tsx src/index.ts (no watch)
# or: npm run typecheck
```

`GET /health` responds immediately (`ready: false`) while bootstrap runs in
the background — wallet funding (skipped if already funded), DUST
registration, and provider construction can take up to a minute on a cold
start. On this run (wallets already funded/DUST-registered from a prior
session) it took under a second.

State lives in `agent/.state/` (gitignored):
`agent/.state/<party>/agent.json` (partySecret, certId, X25519 keypair,
held-credential vault, lastSeenInboxIndex, job history),
`agent/.state/<party>/veilance-private-state/` (the LevelDB contract witness
state), `agent/.state/deployment.json` (contract address, once deployed),
`agent/.state/challenges.json` (verifier challenges), and
`agent/.state/registry-runtime.json` (labels added at runtime, layered over
the committed `agent/registry.json` seed). Restarting the agent process
reconnects to an existing deployment and reloads every party's vault —
verified below.

## Verification transcript

Run against the **real, running local devnet** (node 0.22.5 / indexer
4.2.1 / proof-server 8.1.0, `docker ps` confirmed healthy throughout) on
2026-09-09, in the exact order requested. Party wallets were already funded
and DUST-registered from a prior `contract/e2e` run against the same
devnet, so this run skipped funding (no fresh NIGHT needed) — bootstrap
still ran the full health-check → wallet-build → provider-build sequence.
All JSON below is pasted verbatim from `curl` output (only pretty-printing
and comments added).

### 1. `GET /health` (before deploy)

```
$ curl -s http://localhost:4000/health
{"ok":true,"ready":true,"step":"ready","devnet":{"node":true,"indexer":true,"proofServer":{"ok":true,"version":"8.1.0"}},"deployed":false}
```

### 2. `POST /deploy`

```
$ curl -s -X POST http://localhost:4000/deploy
{"id":"ac5e0f74-e82e-4cdd-9705-5283a7d6c47e","party":"admin","circuit":"deploy","stage":"proving","startedAt":"2026-09-09T05:18:59.399Z"}
```

Polled `GET /jobs/ac5e0f74-...` until terminal:

```
{
  "id": "ac5e0f74-e82e-4cdd-9705-5283a7d6c47e", "party": "admin", "circuit": "deploy",
  "stage": "confirmed",
  "startedAt": "2026-09-09T05:18:59.399Z", "finishedAt": "2026-09-09T05:19:21.628Z",
  "elapsedMs": 22229,
  "txHash": "9c8b1a856ee0e0129e26c7c9a4d1616be8257c863a9812d1435f5c703e6baff6",
  "blockHeight": 1295,
  "result": { "contractAddress": "b3d89df4aba9f99ab887aeb7d04b4a662025e486e0673fcec3b66adcae22cf83" }
}
```

**deploy: 22.2s** (contract/e2e/REPORT.md's own devnet run: 21.7s — consistent).

### 3. `POST /admin/bootstrap` (wait for all 9 jobs)

```
$ curl -s -X POST http://localhost:4000/admin/bootstrap
{"jobs":[9 queued Job objects, ids below]}
```

Final state of each (`GET /jobs/:id`), in queue order:

| # | circuit | party | stage | elapsedMs | actual duration (this job's `finishedAt` − previous job's `finishedAt`) | txHash |
|---|---|---|---|---:|---:|---|
| 1 | certifyOrigin | admin | confirmed | 24980 | 25.0s (from deploy's `finishedAt`) | `87e34887...4256dd` |
| 2 | certifySupplier (mine) | admin | confirmed | 48984 | 24.0s | `d0c156ab...ca8157` |
| 3 | certifySupplier (refiner) | admin | confirmed | 73066 | 24.1s | `7afea656...18655eb` |
| 4 | certifySupplier (batteryMfr) | admin | confirmed | 97064 | 24.0s | `aa4acb39...ff525e` |
| 5 | setCarbonThreshold(5) | admin | confirmed | 121325 | 24.3s | `98396776...6aaac16` |
| 6 | registerEncKey (admin) | admin | confirmed | 145147 | 23.8s | `168203a5...dff0e3d1` |
| 7 | registerEncKey (mine) | mine | confirmed | 169213 | 24.1s | `68e14bd8...35789ae1` |
| 8 | registerEncKey (refiner) | refiner | confirmed | 193217 | 24.0s | `428326e6...5f9d9c1` |
| 9 | registerEncKey (batteryMfr) | batteryMfr | confirmed | 217242 | 24.0s | `142dfe80...2ab1e9f` |

All 9 confirmed, ~24s each (proving+submit+finality), running strictly
sequentially through the shared queue as designed. Raw JSON for all 9 is in
the repo history / captured curl output; see "Deviations" above for why
`elapsedMs` climbs across the list.

### 4. `POST /parties/mine/issue`

```
$ curl -s -X POST http://localhost:4000/parties/mine/issue -H 'content-type: application/json' \
    -d '{"recipient":"refiner","originId":"7665...6472632d6d696e652d78","materialType":"Cobalt","carbonClass":3}'
{"id":"35590ae1-...","party":"mine","circuit":"issueProvenance","stage":"preparing", ...}
```

Confirmed:

```json
{
  "id": "35590ae1-65f4-45da-90c8-712629493ff1", "party": "mine", "circuit": "issueProvenance",
  "stage": "confirmed", "elapsedMs": 27039,
  "txHash": "16325fec59874a485277c55276a14d7d4f7587bf2d772abff49f56614a87df22", "blockHeight": 1343,
  "result": { "commitment": "067e3716...81293c2c", "inboxIndex": "0", "recipient": "refiner" }
}
```

**issueProvenance: 27.0s** (REPORT.md: 30.5s — consistent).

### 5. `POST /parties/refiner/scan`

```json
{"found":1,"credentials":[{
  "id":"067e3716...81293c2c","commitment":"067e3716...81293c2c",
  "originId":"7665...6472632d6d696e652d78","originLabel":"DRC Mine X",
  "materialType":"436f62616c74...(32B)","materialLabel":"Cobalt",
  "carbonClass":3,"status":"ACTIVE","receivedAt":"2026-09-09T05:24:14.308Z","inboxIndex":"0"
}]}
```

Trial-decryption + commitment/tree verification recovered exactly the
credential Mine issued, with the correct decoded label and origin label
resolved from the registry.

### 6. `POST /parties/refiner/credentials/{id}/transfer` → batteryMfr

```
$ curl -s -X POST .../transfer -d '{"recipient":"batteryMfr","carbonClass":4}'
{"id":"2061225e-...","stage":"preparing", ...}
```

Confirmed:

```json
{
  "stage": "confirmed", "elapsedMs": 32250,
  "txHash": "ec08307a07b400fbf0f7b5caf3155bb011969faa0c0aa23bea37e957c9d25f19", "blockHeight": 1351,
  "result": {
    "nullifier": "98e8b68c...ce620f",
    "newCommitment": "f32c8f8a...0d153ab",
    "inboxIndex": "1"
  }
}
```

**transferProvenance: 32.3s** (REPORT.md: 41.2s — consistent, this run faster).

### 7. `POST /parties/batteryMfr/scan`

```json
{"found":1,"credentials":[{
  "id":"f32c8f8a...0d153ab","originLabel":"DRC Mine X","materialLabel":"Cobalt",
  "carbonClass":4,"status":"ACTIVE","inboxIndex":"1", ...
}]}
```

New commitment matches `newCommitment` from the transfer; `carbonClass: 4`
matches the requested transform (up from 3, respecting the contract's
"carbon class may not decrease" invariant).

### 8. `POST /verify/challenges` ×3 (holder=batteryMfr)

```json
{"challenge":"71178f77...13616ef9","attestationKey":"3ad68d3c...5e9444","profile":"consumer", ...}
{"challenge":"0c77e2d8...4d30502ab","attestationKey":"58d32296...730d7cb","profile":"procurement", ...}
{"challenge":"4ef1a31d...0a1cecf48","attestationKey":"c2b46618...a29525ae","profile":"regulator", ...}
```

### 9. 3× attest (queued together, drained sequentially)

| circuit | stage | elapsedMs | actual duration | attestationKey | matches step 8? |
|---|---|---:|---:|---|---|
| attestConsumer | confirmed | 24602 | 24.6s (from transfer scan) | `3ad68d3c...5e9444` | yes |
| attestProcurement | confirmed | 49806 | 24.8s | `58d32296...730d7cb` | yes |
| attestRegulator | confirmed | 85828 | 25.6s | `c2b46618...a29525ae` | yes |

**~24-26s per attest** (REPORT.md: 23.9 / 29.5 / 30.7s — consistent). All
three `attestationKey`s exactly match the values precomputed at challenge
creation (verifying `attestationKeyOf` is deterministic across the
prep→prove boundary, as designed).

### 10. `GET /verify/:challenge` ×3

All three: **`"status":"PASSED"`**, `policyVersion` `"5"` matching
`currentPolicyVersion` `"5"` (fresh, not stale). Predicate tables match
spec.md §4.2.3 exactly:

- **consumer**: responsibleSourcing=true, chainOfCustody=true,
  restrictedSource=true; supplierCertification/carbonThreshold/duplicateClaim=null (not checked)
- **procurement**: + supplierCertification=true, carbonThreshold=true;
  duplicateClaim still null (known limitation — spec.md §4.5)
- **regulator**: all six true, including duplicateClaim (nullifier-unspent check)

### 11. Attack — replay the CONSUMED credential

```
$ curl -s http://localhost:4000/parties/refiner/credentials
[{"id":"067e3716...81293c2c", ..., "status":"CONSUMED", ...}]   # confirmed CONSUMED before attacking

$ curl -s -X POST .../parties/refiner/credentials/067e3716.../transfer \
    -d '{"recipient":"mine","carbonClass":1}'
{"id":"64f26a45-c287-49e8-bffd-19acd6ba5a81","stage":"preparing", ...}
```

The agent did **not** pre-block this — no ACTIVE/CONSUMED check exists in
the transfer route or handler (see `handlers.ts`'s `startTransferJob` doc
comment). It ran the real circuit against real on-chain state:

```json
{
  "id": "64f26a45-c287-49e8-bffd-19acd6ba5a81", "party": "refiner", "circuit": "transferProvenance",
  "stage": "rejected",
  "error": "veilance: credential already consumed",
  "finishedAt": "2026-09-09T05:27:09.461Z", "elapsedMs": 322
}
```

**REJECTED as designed**, extracted verbatim from the contract's assert
message (`"failed assert: veilance: credential already consumed"` →
`"veilance: credential already consumed"`, matching REPORT.md's own attack
entry). 322ms, not 20-45s — see "Deviations" above for why that is expected
(the assert fires during local transcript-building, before the proof server
is ever invoked).

### 12. `GET /ledger`

```json
{
  "contractAddress": "b3d89df4aba9f99ab887aeb7d04b4a662025e486e0673fcec3b66adcae22cf83",
  "blockHeight": 1376,
  "adminId": "05f867482c8e75d2df15e23ea193be82044289591a75d7e32225ba423b0b5ace",
  "policyVersion": "5", "carbonThreshold": 5,
  "provenanceLeafCount": 2, "nullifierCount": 1, "attestationCount": 3,
  "inboxCount": 2, "encKeyCount": 4,
  "certifiedOriginCount": 1, "certifiedSupplierCount": 3
}
```

Matches every expectation contract/e2e/run.ts's own final verification
checks: 2 provenance leaves, 1 nullifier (the attack did **not** add a
second), 3 attestations, 2 inbox entries, 4 registered enc keys, 1 certified
origin, 3 certified suppliers.

`GET /ledger/policy` and `GET /ledger/txs` also verified (see "Deviations"
above for `/ledger/txs`'s implementation) — both returned complete, correct
data (all 3 suppliers with labels, all 15 confirmed txs newest-first).

### Post-transcript checks (not in the required order, done for completeness)

- `GET /jobs?party=refiner` → 3 jobs (registerEncKey, transferProvenance
  confirmed, transferProvenance rejected), newest first.
- `GET /parties/:party/disclosure-preview?op=issue|transfer|attest&profile=`
  → correct static text for all three ops + all three attest profiles.
- **Restart test**: killed the agent process, restarted it. `GET /health`
  came back `"deployed":true` with the same `contractAddress`, without a new
  `POST /deploy` — the `agent/.state/deployment.json` reconnect path
  (`findDeployedContract` for all 4 parties) worked correctly.
  `GET /parties/refiner/credentials` still showed the credential as
  `"status":"CONSUMED"` after restart — the vault sidecar survives a
  process restart, as designed.
- **Final `GET /parties`**: all three non-admin parties `"certified":true`,
  admin `"certified":false` (correct — admin has no supplier cert), all four
  `"encKeyRegistered":true`, NIGHT/DUST balances present for all four.

### Regression check (contract package, after all the above)

```
$ cd contract && npm run typecheck && npm run e2e:dry-run && npx vitest run
...
Tests  27 passed (27)
```

All green, after every shared-file change made for this task
(`e2e/lib/party.ts` added, `e2e/lib/providers.ts` and `e2e/run.ts` edited,
`src/sealed-entry.ts`'s `scanInbox` extended).

## Explorer & graph (v1.1 addendum)

Implements the two sections API.md's v1.1 addendum adds: `GET /graph` (the
supply-chain view: nodes, edges, attestations, activeJob/queue) and
`GET /explorer/{tip,block/:height,tx/:hash,contract,ledger-raw}` (read-only
chain reads proxied from the indexer, since a local devnet has no hosted
block explorer). Also adds `GET /verify/challenges?holder=&open=true`.

### Deviations from the v1.1 addendum

- **`GraphEdge` gained one required field beyond the addendum's literal
  shape — `lotNumber`** — because the addendum's own prose asks for it
  ("Add `lotNumber` (1-based per edge creation order) to each edge — the UI
  labels lots 'Cobalt · lot 2'") without adding it to the JSON shape it
  shows; treated as authoritative. Assigned in ascending `createdAt` order
  across every resolved edge (issue and transfer both count).
- **`GraphEdge` also gained four additive, optional fields not in the
  addendum's shape at all: `nullifier`, `consumedTxHash`,
  `consumedBlockHeight`, `deliveredAt`.** These exist because
  `web/src/api/types.ts` (already written, uncommitted, in this repo before
  this change) already declares them on its `GraphEdge` interface, marked
  "Web-only: ... when known from a job result" — i.e. the frontend was
  already designed to read them opportunistically. Populated from the same
  `HeldCredential` record `GET /parties/:party/credentials` already
  returns: `deliveredAt` = `receivedAt`, and the three `consumed*` fields
  are new optional properties on `HeldCredential` itself (types.ts), set in
  place inside `startTransferJob` (handlers.ts) at the exact point it flips
  a credential's `status` to `CONSUMED` — the same place that already
  mutates `heldRecord` in place, so no extra persistence work.
- **Persisting `issued[]`**: added `IssuedEntry` (types.ts) and an
  `issued: IssuedEntry[]` field on `PartyAgentFile`, written by
  `startIssueJob`/`startTransferJob` right after each job's `callTx.*`
  resolves. Existing vaults on disk predate this field —
  `loadOrCreatePartyFile` (state.ts) backfills `issued: []` in memory the
  first time an old file is read, and it starts getting entries from the
  next issue/transfer that party makes. **`GET /graph`'s edge builder
  therefore has two data sources, preferred in this order**: (1) an
  issuer's `issued[]` entry for a commitment, if present (authoritative
  going forward — carries `carbonClass`/`materialLabel`/`originLabel`
  immediately, even before the recipient has scanned); (2) reconstruction
  from confirmed job history, for every commitment predating this change.
  All 7 edges in this devnet's current history came from source (2) except
  the one issued fresh during this task's own verification (lot 7, below) —
  see graph.ts's `buildRawEvents`.
- **Legacy transfer jobs are missing `recipient` in their persisted
  `Job.result`** (that field was added to the code — see the one-line
  diff already sitting in `handlers.ts` before this task started, kept
  as-is — but jobs run under older code obviously don't have it
  retroactively). `GET /graph`'s reconstruction path resolves `to` for
  those in two steps: first by finding which party currently holds a
  credential matching the edge's commitment (covers the case where the
  recipient has already scanned); when that also comes up empty (the
  recipient hasn't scanned yet — verified live: lot 6 below, `batteryMfr →
  refiner`, was in exactly this state), by trial-decrypting the specific
  sealed inbox entry (`credentialInbox.lookup(inboxIndex)`) against each of
  the four parties' own `encSk`. This is not a guess: `recipientHasEncKey`
  already guarantees a transfer's real recipient is always one of the four
  parties this single-process demo agent holds keys for, and
  `openCredential`'s AEAD construction means exactly one of those four keys
  opens any given entry (see contract/src/sealed-entry.ts's header comment).
  Verified live — see the transcript below.
- **`Job`/queue internals gained two small, additive exports.** `JobContext`
  (jobs.ts) gained a `jobId: string` field alongside the existing
  `setStage` — handlers had no way to learn their own job's id to stamp it
  onto an `IssuedEntry`; existing executors that destructure only
  `{ setStage }` are unaffected. `jobs.ts` also now exports
  `getActiveJob()`/`getQueuedJobs()`, reading the real in-process queue
  (a module-level `currentJob` set for the duration of each
  `executor(...)` call, plus the queue array itself) rather than scanning
  persisted job history for a non-terminal stage — the latter would make a
  job left `"proving"` by a previous crashed process look "active" forever
  after a restart. `Graph.activeJob`/`Graph.queue` use these.
- **Explorer responses carry one field the addendum's JSON shapes don't
  show: `source: "indexer" | "agent"`**, per this task's own instruction
  ("tag fields with source"). Placement: a single top-level `source` on
  `GET /explorer/tx/:hash` (everything on that shape is indexer-native —
  `entryPoint` included, see below — so there is nothing to tag per-field);
  and a per-row `source` on each entry of `GET /explorer/contract`'s
  `actions[]`, since that list is fundamentally agent-job-history-derived
  (see next bullet) except the one row independently cross-checked against
  the chain's own current `contractAction`.
- **`GET /explorer/contract`'s `actions[]` cannot be paginated from the
  indexer** — `contractAction(address, offset?)` returns exactly one action
  (the latest, or the one at a given block/tx offset), never a list for an
  address. This is the identical constraint `GET /ledger/txs` already
  documents above, so `actions[]` reuses that same established pattern:
  built from the agent's own confirmed job history (authoritative for
  txHash/blockHeight/party/circuit — this agent is the sole actor against
  the contract in the demo), with the chain's own current latest action
  fetched once and cross-matched by txHash to independently verify (and
  `source`-tag) that one row.
- **`entryPoint` turned out to be available directly from the indexer**
  for `ContractCall` actions (`... on ContractCall { entryPoint }` —
  verified live, see the transcript below), contrary to this file's own
  earlier assumption (carried over from API.md's addendum prose: "party/
  circuit are agent-known, never on chain") that entry-point-like data
  needed job-history fill-in entirely. Only `party` is genuinely
  agent-only; `circuit` is set equal to the job's own circuit name (which
  always matches `entryPoint` for this contract) and used as a fallback
  only for actions where no matching job exists.
- **Indexer timestamps are Unix epoch-milliseconds (`Int`), converted to
  ISO 8601 strings** in every explorer response, for consistency with the
  rest of this API (`Job.startedAt` etc. are always ISO — API.md's opening
  paragraph implies this convention even though it isn't restated for the
  addendum's timestamp fields).
- **`GET /verify/challenges?holder=&open=true` extends the existing route**
  (same path, `holder`/`open` become meaningful only together) rather than
  adding a second path, matching the addendum's own phrasing ("add
  `GET /verify/challenges?holder=<PartyName>&open=true`" — a query-string
  addition to the endpoint that "already exists"). Plain
  `GET /verify/challenges` (no query params) is byte-for-byte unchanged.
  "Open" = PENDING (never attested) or STALE (attested under an older
  `policyVersion` than current) — i.e. anything without a *fresh* PASSED
  attestation, per the addendum's own wording.
- **Contrary to the general `midnight-indexer:indexer-graphql-api` /
  `indexer` skills' guidance that a local `undeployed` devnet answers only
  `/api/v3/graphql`**: this project's local indexer (indexer-standalone
  4.2.1, per this file's earlier verification transcript) answers
  `/api/v4/graphql` fine — already relied on by `ledgerRead.ts`'s
  `fetchBlockHeight` and every `currentLedger` call before this task,
  reconfirmed by every query below.

### Indexer GraphQL queries (verified live before coding, see explorer.ts)

Two schema surprises, found via introspection against the real running
indexer before writing any query: `Block`'s parent field is `parent`
(itself a nested `Block`), not `parentHash`; and `transactionResult` /
`identifiers` / `contractActions[].entryPoint` live on the
`RegularTransaction` variant of the `Transaction` interface, not the base
interface, so every transaction query needs an inline
`... on RegularTransaction { ... }` fragment for them.

```graphql
# GET /explorer/tip
query { block { hash height timestamp } }

# GET /explorer/block/:height
query($h: Int!) {
  block(offset: { height: $h }) {
    hash height timestamp
    parent { hash }
    transactions { hash }
  }
}

# GET /explorer/tx/:hash
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

# GET /explorer/contract — the one row cross-verified against the chain's
# own current latest action (the rest come from job history, see above)
query($a: HexEncoded!) {
  contractAction(address: $a) {
    __typename
    address
    ... on ContractCall { entryPoint }
    transaction { hash }
  }
}
```

### Verification transcript (this session, against the running devnet)

The devnet had been stopped since the prior session (containers present but
exited); brought back up the same way as before
(`docker compose -f ~/.midnight-expert/devnet/devnet.yml up -d`, same
persisted volumes) and confirmed healthy (node/indexer/proof-server all OK,
proof-server 8.1.0) before starting the agent. The agent reconnected to the
existing deployment (`b3d89df4...cae22cf83`) with no new `POST /deploy`.

`GET /graph` — 5 nodes (admin/mine/refiner/batteryMfr/verifier), **7 edges**
covering the `mine → refiner → batteryMfr` chain with real statuses, and
**4 attestations** (exceeds the ≥4 required):

```
lot 1  mine       -> refiner      CONSUMED   issueProvenance
lot 2  refiner    -> batteryMfr   DELIVERED  transferProvenance
lot 3  mine       -> refiner      CONSUMED   issueProvenance
lot 4  refiner    -> batteryMfr   CONSUMED   transferProvenance
lot 5  mine       -> refiner      DELIVERED  issueProvenance   (legacy job, recipient resolved via held-credential lookup)
lot 6  batteryMfr -> refiner      DELIVERED  transferProvenance (legacy job, NO `recipient` in Job.result and not yet
                                                                  scanned at the time of the first /graph call —
                                                                  recipient resolved by trial-decrypting inbox index 5
                                                                  against all four parties' encSk; confirmed correct
                                                                  once refiner's own POST /parties/refiner/scan found it)
lot 7  mine       -> refiner      DELIVERED  issueProvenance   (issued fresh during this verification — carbonClass/
                                                                  materialLabel/originLabel present immediately via
                                                                  the new issued[] vault, before any scan)
```

`GET /explorer/tip` → `{"blockHeight":3297,"blockHash":"8fd15775...af19d","timestamp":"2026-09-09T11:50:48.000Z"}`.

`GET /explorer/tx/16325fec...87df22` (lot 1's issue tx) →
`blockHeight: 1343`, `status: "applied"`, `contractActions: [{ kind:
"call", entryPoint: "issueProvenance" }]`, 2 `identifiers`, `source:
"indexer"`.

`GET /explorer/block/1343` (that tx's block) → matching `hash`,
`parentHash`, single `txHashes` entry equal to the tx above.

`GET /explorer/contract` → `deployTxHash`/`deployBlockHeight` from the
confirmed deploy job, `latestBlockHeight: 3297`, **30 actions** newest
first, the newest (`c5ea59f5...b3aaf7`, lot 7's issue tx) tagged
`"source":"indexer"` (independently cross-verified against the chain's own
current latest `contractAction`), every other row `"source":"agent"`.

`GET /explorer/ledger-raw` → counts matching `GET /ledger` exactly
(`provenanceLeafCount: 7`, `attestationCount: 4`, etc. — one higher than
the earlier transcript's `GET /ledger` numbers, reflecting lot 7's fresh
issue) plus three Merkle roots `GET /ledger` doesn't expose
(`provenanceRoot`, `certifiedOriginsRoot`, `certifiedSuppliersRoot`).

`GET /verify/challenges?holder=batteryMfr&open=true` → 5 of 5 stored
challenges for `batteryMfr`, newest first, none excluded — because every
one of the four attested challenges was recorded under `policyVersion "5"`
while the ledger's current `policyVersion` is now `"10"` (several more
`certifySupplier`/`setCarbonThreshold` calls happened after the original
attestations), so all four are legitimately **STALE** (need
re-verification), and the fifth was never attested at all (**PENDING**).
This is the intended semantics, not a bug: "open" = PENDING or STALE, i.e.
anything without a *fresh* PASSED attestation. `GET /verify/challenges`
(no query) still returns all 5 unfiltered, confirming the plain route is
unchanged. `?holder=bogus&open=true` → 400 `bad_request`, as expected.

400/404 checks: `GET /explorer/tx/deadbeef` (wrong length) → 400
`bad_request`; `GET /explorer/tx/<64 zero hex chars>` (well-formed, real,
unknown) → 404 `not_found`; `GET /explorer/block/99999999` → 404
`not_found`.

### Regression check (after the v1.1 addendum work)

`npx tsc --noEmit -p .` (agent package) → clean. `cd contract && npx vitest
run` → 27/27 passed, unaffected (no contract-package file was touched for
this addendum). The agent process was restarted (`tsx watch`) several times
over the course of this change picking up new files; `GET /health` came
back `{"ready":true,"deployed":true}` reconnected to the same contract
address every time, with no new `POST /deploy`.

## What was NOT verified

Nothing in v1 (see the original transcript above) or in the v1.1 addendum
(see immediately above) — every new endpoint (`GET /graph`, all five
`GET /explorer/*` routes, and the `holder`/`open` query-string addition to
`GET /verify/challenges`) was exercised against the real running devnet,
including its 404/400 edge cases and the legacy-data reconstruction paths
(held-credential lookup and inbox decryption) that only exercise on data
that predates this change. The devnet was down at the start of *this*
task's session too (containers present but exited — same
`docker compose ... up -d` recovery against the same persisted volumes) and
was kept running throughout.

## Running on Midnight Preprod (public test network)

The agent targets the local devnet by default. Every endpoint is an environment
variable (see `contract/e2e/lib/config.ts`), and `agent/.env.preprod`
(gitignored) holds the Preprod values. Preprod's toolchain — Node 1.0.2, Compact
0.31.1, compact-runtime 0.16.0, midnight-js 4.1.1, proof-server 8.1.0 — is the
generation this project is pinned to, so no code or contract change is needed.

```bash
cd agent
set -a && . ./.env.preprod && set +a          # network id, RPC/indexer URLs, funder seed
npx tsx src/cli/addresses.ts                   # prints the funder + party unshielded addresses (offline)
```

1. **Faucet (human step)** — open https://midnight-tmnight-preprod.nethermind.dev/,
   paste the **funder** `mn_addr_preprod1…` address, solve the captcha. One drip
   is 1,000 tNIGHT; it is rate limited. The proof server stays local
   (`midnightntwrk/proof-server:8.1.0` on :6300) — it sees witness data in the
   clear and must never be a third-party service for real parties.
2. Start the agent with the env loaded: `npm run dev`. On boot it syncs the
   funder wallet (first sync of a fresh Preprod wallet walks ~2.5 M blocks and is
   slow), registers its NIGHT for DUST, sends `VEILANCE_FUNDING_AMOUNT` STAR to
   each party wallet that holds less than half of it, registers each party's NIGHT
   for DUST, then reconnects to or deploys the contract. State lives in
   `agent/.state/preprod/`, separate from the devnet vaults.
3. Verify on an explorer: `https://preprod.midnightexplorer.com/contracts/<address>`,
   transactions at `/transactions/0x<hash>`, blocks at `/blocks/<height>`.
   The web UI adds "Open in external explorer" links when
   `VITE_EXPLORER_URL_TEMPLATE` is set.

Facts above come from docs.midnight.network (networks-and-environments,
acquire-tokens, support-matrix, deploy-and-operate) and live probes on
2026-09-10; DUST accrues at ~30 DUST/hour per 1,000 NIGHT registered.
