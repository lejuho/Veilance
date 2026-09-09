# Veilance web UI

Browser front-end for the Veilance party agent (`agent/API.md`). It holds no wallet, keys or private state — every action is an HTTP call to the agent, and every circuit call is shown as a polled job (queued → preparing → proving → submitting → confirmed / rejected).

Stack: Vite 6 · React 18 · TypeScript · Tailwind CSS 3 · React Router 6 · TanStack Query 5. No UI kit; the handful of primitives live in `src/components/ui/index.tsx`.

## Run

```bash
cd web
npm install
npm run dev          # http://localhost:5173  (mock mode unless VITE_API_URL is set)
npm run typecheck
npm run build        # dist/
npm run preview      # serve dist/ on http://localhost:4173
```

Node ≥ 20 (developed on 24). No `.npmrc` needed.

## Environment

| Variable | Effect |
|---|---|
| `VITE_API_URL` | Base URL of the party agent, e.g. `http://localhost:4000`. Unset → mock adapter. |
| `VITE_MOCK=1` | Force the mock adapter even when `VITE_API_URL` is set. |
| `VITE_MOCK_PROVE_MS` | Mock only. Simulated proving time for issue / transfer / attest (default `3000`). Admin circuits use 40 % of it. |

Copy `.env.example` to `.env` and edit. Vite reads the env at build time, so rebuild after changing it.

## Mock mode

With no agent running the UI is fully demoable. `src/api/mock.ts` implements the same `VeilanceApi` interface as the HTTP adapter and simulates:

- Jobs with the real stage sequence and elapsed time; one job at a time (like the shared proof server). Admin jobs are faster than holder jobs.
- A fresh, empty policy (v0). **Bootstrap demo policy** on `/admin/policy` runs the nine sequential jobs the real agent runs (origin, three suppliers, threshold 5, four encryption keys).
- Issue → sealed inbox entry → the recipient sees it only after **Scan inbox**.
- Transfer → nullifier + new commitment; upstream card becomes CONSUMED.
- The attack: transferring a CONSUMED credential produces a `rejected` job with `veilance: credential already consumed`, and the ledger counters do not move.
- Attestation keys and verify results: `PENDING` → `PASSED`, and `STALE` once the policy version changes (e.g. set a new carbon threshold after attesting).
- Contract asserts for the other negative paths (uncertified supplier / origin, carbon class below upstream, carbon class above threshold for Procurement, duplicate attestation).

Mock state persists in `localStorage` (`veilance.mock.v1`) so a reload keeps the chain. **reset mock** in the header wipes it.

## Routes

| Route | Party | Page |
|---|---|---|
| `/` | all | Role-aware dashboard: identity, held / consumed / attestation counts, public ledger counters, recent jobs, quick actions |
| `/admin/policy` | Admin (read-only for others) | Policy version & threshold, certified origins / suppliers, add-origin / add-supplier modals, set-threshold form, **Bootstrap demo policy** |
| `/issue` | Mine | Issue provenance form with disclosure preview, job progress, completion card |
| `/credentials` | Mine / Refiner / Battery Manufacturer | Scan inbox, credential cards, Transfer / Prove policy; CONSUMED cards keep **Transfer again (attack demo)**. Accepts `?challenge=&profile=` from a verifier share link |
| `/credentials/:id/transfer` | holder | Recipient, new carbon class (min = current), 4-item pre-check, disclosure preview, job, completion or the big REJECTED screen |
| `/credentials/:id/attest` | holder | Challenge input (auto-filled from `?challenge=&profile=`), profile selector with predicate checklist, Regulator linkability warning, disclosure preview, job, attestation key |
| `/verify` | Verifier (no wallet) | Profile selector with predicate table, holder dropdown, Generate challenge → challenge + share link, list of my challenges with live status |
| `/verify/:challenge?holder=&profile=` | anyone | Result view: predicate ✓ / ✗ table, PRIVATE table, PENDING state, STALE banner |
| `/demo` | all | Guided 7-stop walkthrough of the landing.md §10 script; enables a sticky presenter bar whose **Next** switches the party and deep-links to the right page |

The active party (role switcher in the header) is stored in `localStorage` under `veilance.role`.

## Layout

```
src/
  api/        types.ts (API.md contract) · client.ts (VeilanceApi + adapter selection) · http.ts · mock.ts · disclosure.ts
  components/ Layout (header, role switcher, health, policy chips) · JobProgress · DisclosurePreview · RoleGate · ui/
  hooks/      queries.ts — TanStack Query hooks (jobs poll 1 s while active, ledger 5 s, verify 2 s)
  pages/      one file per route
  state/      role.tsx (active party) · demo.ts (guided demo step)
  lib/        registry.ts (org names, profiles, predicate table — L3 display data) · format.ts
```
