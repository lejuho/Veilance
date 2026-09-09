# Veilance devnet end-to-end script

Runs the full landing.md §10 demo (admin bootstrap → Mine issues → Refiner
transforms/transfers → Battery Manufacturer attests → double-claim attack)
against a **real Midnight devnet**, using the real contract, the real
witnesses (`src/witnesses.ts`), and the real sealed-inbox helpers
(`src/sealed-entry.ts`) — the same code `test/demo.test.ts` exercises against
the simulator, run here against actual providers, an actual proof server, and
actual wallets.

This project (contract, e2e script, and its dependency pins) targets the
**stable** Midnight generation on purpose: Compact compiler `0.31.1`,
`@midnight-ntwrk/compact-runtime 0.16.0`, `midnight-js-* 4.1.1`,
`wallet-sdk-facade 4.1.0` — the versions the official support matrix
documents and the ones this task's `devnet.yml` (`node:0.22.5`,
`indexer-standalone:4.2.1`, `proof-server:8.1.0`) actually runs. See
"Version compatibility" below for how that was decided and verified — this
project briefly targeted a next-generation prerelease SDK line instead;
that history and why it was reversed is recorded there too.

---

## 1. Prerequisites

1. **Enable Docker Desktop's WSL integration** (this machine does not have
   Docker available yet). In Docker Desktop → Settings → Resources → WSL
   Integration, enable it for this distro, then `docker info` should succeed
   from this shell.

2. **Install dependencies and compile the contract's full ZK build** (from
   `contract/`):

   ```bash
   npm install
   npm run compile:zk    # NOT `npm run compile` — that's --skip-zk and has no keys/
   ```

   `npm run compile:zk` runs `compact compile +0.31.1 ...` (pinned in
   `package.json`, regardless of whatever the `compact` CLI's default
   version is on a given machine) and took under a minute on this machine,
   emitting `src/managed/veilance/keys/{circuit}.{prover,verifier}` for all
   9 circuits (79 MB total — see §5 of `NOTES.md` for the full per-circuit
   breakdown). `e2e/run.ts` checks for this directory and exits with a
   clear message if it's missing or incomplete — it will not silently fall
   back to the `--skip-zk` build.

3. **Start the devnet.** This task's `devnet.yml` versions are, per §2
   below, the right generation for this contract as of this toolchain
   migration — no image changes should be needed:

   ```bash
   docker compose -f ~/.midnight-expert/devnet/devnet.yml up -d
   ```

4. **Wait for health**, then run:

   ```bash
   npm run e2e            # full run
   npm run e2e:dry-run    # everything except network calls — works right now
   ```

`npm run e2e` itself checks devnet health (node `/health`, indexer GraphQL,
proof server `/version`) before doing anything else, and exits with a clear
message if any service isn't responding — see `e2e/lib/health.ts`. It also
warns (does not block) if the proof server it finds does **not** report an
`8.x` version — that would mean the devnet is running the next-generation
images this project moved away from, which this contract's compiled output
can no longer talk to.

---

## 2. Version compatibility — READ THIS

### 2.0 Current state: the stable generation, end to end

This project now runs on one coherent, **stable** version stack, matching
both the official support matrix and this task's `devnet.yml`:

| layer | version |
|---|---|
| Compact compiler | `0.31.1` (language version `0.23`) |
| `@midnight-ntwrk/compact-runtime` | `0.16.0` |
| `@midnight-ntwrk/onchain-runtime-v3` | `3.0.0` (pulled in by the runtime above) |
| `@midnight-ntwrk/midnight-js-*` (contracts / types / utils / network-id / protocol / indexer-public-data-provider / http-client-proof-provider / node-zk-config-provider / level-private-state-provider) | `4.1.1` |
| `@midnight-ntwrk/compact-js` | `2.5.1` |
| `@midnight-ntwrk/ledger-v8` | `8.1.0` |
| `@midnight-ntwrk/wallet-sdk-facade` | `4.1.0` |
| `@midnight-ntwrk/wallet-sdk-shielded` | `3.0.2` |
| `@midnight-ntwrk/wallet-sdk-dust-wallet` | `4.2.0` |
| `@midnight-ntwrk/wallet-sdk-unshielded-wallet` | `3.1.0` |
| `@midnight-ntwrk/wallet-sdk-address-format` | `3.1.2` |
| `@midnight-ntwrk/wallet-sdk-abstractions` | `2.1.0` |
| `@midnight-ntwrk/wallet-sdk-capabilities` | `3.3.1` |
| `@midnight-ntwrk/wallet-sdk-indexer-client` | `1.2.3` |
| `@midnight-ntwrk/wallet-sdk-hd` | `3.0.2` |
| devnet (given, unchanged) | `midnight-node:0.22.5`, `indexer-standalone:4.2.1`, `proof-server:8.1.0` |

Every version above was confirmed reachable on the public npm registry with
`npm view <pkg>@<version>`; no `.npmrc` or registry override exists anywhere
in this project. `npm ls` confirms the whole tree dedupes to a single
`compact-runtime@0.16.0` and a single `@midnight-ntwrk/ledger-v8@8.1.0` —
**no `overrides` block is needed**, because every dependency in this stack
independently resolves to the same versions (`midnight-js-protocol@4.1.1`
pins `ledger-v8` at exactly `8.1.0`; `wallet-sdk-facade@4.1.0` asks for
`^8.1.0`; both land on the same version without forcing).

The rest of this section is the history of *why* this is the target
generation — this project briefly pinned a next-generation prerelease SDK
line instead, and reversed that decision. If you just want the current
pins, §2.0 above and `package.json` are the whole answer.

### 2.1 How this project got here

The contract was originally compiled with **Compact compiler 0.34.0**,
targeting `@midnight-ntwrk/compact-runtime@0.19.0`. Checking, via `npm
view`, what that runtime version itself depends on showed it belongs to a
**next-generation** dependency line:

```
@midnight-ntwrk/compact-runtime@0.19.0  ->  @midnightntwrk/onchain-runtime-v4 ^4.0.0-rc.3
@midnight-ntwrk/compact-runtime@0.16.0  ->  @midnight-ntwrk/onchain-runtime-v3 ^3.0.0
```

(Two different npm scopes: `@midnightntwrk` with no hyphen is the
next-generation line; `@midnight-ntwrk` with a hyphen is the stable line —
both real, both reachable, not a typo.) Checking every published
`@midnight-ntwrk/midnight-js-contracts` version's dependency chain showed
the **stable line (`4.1.1`, npm `latest`) pins `compact-runtime@0.16.0`
exactly**, while only a prerelease line (`5.0.0-beta.7`, depending on the
release candidate `0.19.0-rc.0`) was anywhere near `0.19.0`. The official
support matrix (`docs.midnight.network/relnotes/support-matrix`, fetched
live) confirmed the stable line — compiler `0.31.1`, `compact-runtime
0.16.0`, proof server `8.1.0` — is what Preview/Preprod/Mainnet actually
run. And this task's own `devnet.yml` (`node:0.22.5`, `proof-server:8.1.0`)
is that same stable, `ledger-v8` generation — `midnight-node:0.22.5`'s
release notes describe it as a pre-1.0 build "to match Mainnet", and
`proof-server:8.1.0` matches the support matrix exactly.

So the *first* version of this e2e harness pinned the contract to compiler
`0.34.0` and the SDK to the `5.0.0-beta.7` prerelease line — the only
combination that was internally consistent with each other, but consistent
with **neither** the official support matrix **nor** this task's own
devnet images. That version's `package.json` needed an `npm overrides`
block to force a single `@midnightntwrk/ledger-v9` version, its wallet
layer needed protocol-version "handle" wrapping
(`WalletTransaction.adopt`/`unwrapWithin`) that doesn't exist in the stable
generation, and — despite type-checking cleanly and running its full
dry-run — it could never have deployed or called the contract against the
devnet this task actually describes, because no stable ledger-v9 proof
server or node image exists yet (Docker Hub: proof-server's next-gen line
tops out at `9.0.0-rc.7`, no stable `9.x` release).

### 2.2 The decision: move to the stable generation instead

Recompiling the contract was, at that point, still framed as out of this
skill's scope. Revisiting that: **the contract compiles unchanged under
`compact +0.31.1`** with only its `pragma language_version` lowered from
`>= 0.26` to `>= 0.23` — confirmed by trial compilation (`--skip-zk`, exit
0) before touching anything else, and by a full 9-circuit ZK build
afterward (§5 below). Given that, carrying a prerelease SDK pin that
matches neither the support matrix nor the devnet images given for this
task stopped making sense — the contract itself was the only thing
anchoring this project to the next-generation line, and it didn't need to
be.

So the whole project moved to the stable generation in §2.0: the contract's
pragma, `package.json`'s pinned `compact compile +0.31.1` in every script,
every `@midnight-ntwrk/*` dependency, and a full rewrite of
`e2e/lib/wallet.ts` / `providers.ts` against `wallet-sdk-facade@4.1.0` +
`midnight-js-*@4.1.1`, following the `midnight-js` skill's §5–§8 wiring and
`example-counter`'s `counter-cli/src/api.ts` almost verbatim. See
`NOTES.md` §9 for the full list of what changed in the contract's test
harness (`test/network.ts` needed two real API fixes for the
`compact-runtime` version difference; `src/witnesses.ts` needed none) and
for the re-verification of D-1 ("`assert` is not a disclosure boundary")
against the `0.31.1` compiler.

**Net effect**: `devnet.yml` — as given, unmodified — should now be the
right generation for this contract. `e2e/lib/health.ts`'s proof-server
check reflects that: it now warns if the proof server it finds is **not**
`8.x` (the inverse of what it warned about before this migration).

### 2.3 What this doesn't (and can't) verify

Nothing here was run against a live devnet — this environment has no
Docker. Everything reported as "verified" in §3 below is verified up to
that boundary: `npm install`, `tsc`, `vitest` against the simulator, a real
full ZK build, and a real dry run of every non-network code path. Whether
this contract's compiled circuits actually satisfy `proof-server:8.1.0` end
to end — deploy, all 9 circuit calls, the attack — has not been, and could
not be, exercised here.

---

## 3. What was actually verified without a devnet

Everything below was run for real in this environment (no devnet, no
Docker), against the final stable-generation pins in §2.0:

- `npm install` — succeeds; `npm ls` confirms `@midnight-ntwrk/compact-runtime@0.16.0`
  and `@midnight-ntwrk/ledger-v8@8.1.0` dedupe to one instance each across
  the whole tree, with **no `overrides` block**.
- `npx tsc --noEmit` — clean, including `e2e/**/*.ts` and `test/network.ts`.
- `npm test` (the existing 27 `vitest` tests via the `compact-runtime`
  simulator) — still pass, against `compact-runtime@0.16.0`. Getting there
  required two real fixes to `test/network.ts` for API differences between
  runtime `0.19.0` (what the tests originally ran against) and `0.16.0`
  (`createCircuitContext`'s dropped `circuitId` parameter, and
  `CircuitResults.context`'s flattened shape) — see `NOTES.md` §9 for
  exactly what changed and how it was found (reading the installed
  `.d.ts`, not guessing). `src/witnesses.ts` needed no changes.
- `npm run compile:zk` — full ZK build with `compact +0.31.1` succeeds in
  well under a minute, producing `src/managed/veilance/keys/*.{prover,verifier}`
  for all 9 circuits, **79 MB total**, with per-circuit sizes identical to
  the `0.34.0` build recorded in `CONTRACT_DESIGN.md` §9.4 (2.7 MB for the
  three simplest admin circuits, 5.0 MB for `certifySupplier`, 9.6 MB for
  `issueProvenance`/`attestConsumer`/`attestProcurement`, 19 MB for
  `transferProvenance`/`attestRegulator`) — the toolchain downgrade changed
  no circuit's cost.
- The D-1 finding ("`assert` is not a disclosure boundary") was
  re-confirmed against `0.31.1` specifically, in both directions — see
  `NOTES.md` §9 for the full experiment and its (successful) result.
- `npm run e2e:dry-run` — runs for real, with **zero network calls**:
  per-party key/id derivation, a real `sealCredential`/`openCredential`
  round-trip from `src/sealed-entry.ts` (including the negative case: a
  non-recipient key cannot open the entry), construction of
  `NodeZkConfigProvider` / `levelPrivateStateProvider` (with a real LevelDB
  read/write round-trip under `e2e/.state/dry-run/`), a real
  `getVerifierKey("certifyOrigin")` call against the actual compiled
  output, and `CompiledContract.make(...).pipe(...)` wrapping the real
  generated `Contract` class.
- `npm run e2e` with no devnet running — correctly detects all three
  services are unreachable and exits `1` with a clear message, rather than
  hanging or crashing.

What was **not**, and could not be, verified: anything from
`checkDevnetHealth()` onward in `e2e/run.ts` once a devnet actually
responds — wallet sync, genesis funding, DUST registration, deploy, every
circuit call, and the attack. There is no devnet in this environment to run
them against. Unlike the prerelease-line version of this project, there is
now no known *structural* reason this should fail against the devnet.yml
given for this task — but "should not fail" is not the same as "verified."

---

## 4. Memory — will this machine's 7 GB RAM / 4 cores be enough?

The `midnight-tooling:proof-server` / `:devnet` skills' own guidance is:

> The proof server is memory-intensive. Ensure Docker has **at least 4 GB
> RAM** allocated. Recommended CPU: **at least 2 cores.**

That's the floor for the whole 3-service stack (node + indexer + proof
server), not the proof server alone, and it is **not** specific to this
contract's circuit sizes. Neither that skill nor the proof server's own
`/health` / `/ready` / `/version` API documents a proof-server-specific
memory-limiting environment variable — `devnet.yml`'s only proof-server env
var is `RUST_BACKTRACE=full` (for diagnostics, not memory).

For *this* contract specifically: per `CONTRACT_DESIGN.md` §9.4, the two
heaviest circuits are `transferProvenance` and `attestRegulator`, each with
a 19 MB **prover key**. Prover-key size is a rough proxy for proving cost,
not a memory bound — PLONK-style proving typically needs a working set
several times the key size for the witness/FFT machinery — so treat 4 GB as
a floor, not a comfortable number, particularly for those two circuits.

On this machine (7 GB RAM, 4 cores, WSL2):

- Allocating the recommended 4 GB to Docker leaves ~3 GB for WSL2 itself,
  the host Windows OS, and this script's own Node process. That is thin but
  workable if nothing else heavy is running.
- The one real lever here is **WSL2's own memory cap**, via `.wslconfig`
  (typically `%UserProfile%\.wslconfig` on the Windows side):

  ```ini
  [wsl2]
  memory=6GB
  processors=4
  ```

  then `wsl --shutdown` and restart. This raises the ceiling WSL2 (and thus
  Docker Desktop's WSL integration) can use, rather than lowering the proof
  server's own footprint — there is no documented proof-server flag for the
  latter.
- If a proving call OOMs in practice: close other applications, confirm
  Docker Desktop's Resources → Advanced memory allocation is not
  artificially capped below the WSL2 limit, and consider running the two
  heaviest circuits (`transferProvenance`, `attestRegulator`) in isolation
  rather than back-to-back with everything else — `e2e/run.ts` already runs
  every circuit call sequentially, one at a time, never in parallel, which
  is the memory-friendliest shape available without changing the proof
  server itself.

---

## 5. Output

A successful full run writes:

- `e2e/report.json` — machine-readable: per-circuit timing (`totalMs`, and
  `provingMs` where the SDK exposes it separately), tx hashes, block
  heights, the attack result, the final ledger snapshot, and a pass/fail map
  against the expected end state (tree leaf count 2, nullifiers 1,
  attestations 3, inbox 2, encKeys 4).
- `e2e/REPORT.md` — the same, as a human-readable table.

Neither file exists yet in this environment — they are written only by a
run that reaches the end, and no run has reached the network in this
environment.
