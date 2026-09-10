# Veilance web UI

Operator screen for the Veilance party agent (`agent/API.md`). One screen: a supply-chain map with four organisation cards and lot pills on the edges, a status bar, a right drawer (organisation / lot / verifier / policy) and an explorer modal. Layout and copy follow `UX_V3.md`.

Stack: Vite 6 · React 18 · TypeScript · Tailwind CSS 3 · React Router 6 · TanStack Query 5.

## Run

```bash
cd web
npm install
npm run dev          # http://localhost:5173  (mock mode unless VITE_API_URL is set)
npm run typecheck
npm run build        # dist/
```

## Environment

| Variable | Effect |
|---|---|
| `VITE_API_URL` | Base URL of the party agent, e.g. `http://localhost:4000`. Unset → mock adapter. |
| `VITE_MOCK=1` | Force the mock adapter even when `VITE_API_URL` is set. |
| `VITE_MOCK_PROVE_MS` | Mock only. Simulated proving time in ms (default `3000`). |
| `VITE_EXPLORER_TX_URL` / `VITE_EXPLORER_BLOCK_URL` / `VITE_EXPLORER_CONTRACT_URL` | Optional per-kind external explorer links (`{hash}`, `{height}`, `{address}`). Preprod: `https://preprod.midnightexplorer.com/transactions/0x{hash}`, `/blocks/{height}`, `/contracts/{address}`. `VITE_EXPLORER_URL_TEMPLATE` is a single-template fallback. |

## Routes

| Route | View |
|---|---|
| `/` | Map. Drawer state in the query: `?org=mine\|refiner\|batteryMfr\|verifier`, `?lot=<edge id>`, `?policy=1`, `?org=verifier&req=<challenge>` |
| `/explorer/tx/:hash` | Transaction modal over the map |
| `/explorer/block/:height` | Block modal |
| `/explorer/contract` | Contract / ledger modal |

## Polling

`GET /graph` every 5 s (1 s while a job runs), `GET /jobs/:id` every 1 s until terminal, `GET /explorer/tip` every 10 s, `/health` every 10 s.

## Mock mode

`src/api/mock.ts` implements the same `VeilanceApi` as the HTTP adapter (`src/api/http.ts`): jobs with the real stage sequence (~3 s), `/graph`, `/explorer/*`, open requests, contract asserts (`credential already consumed`, carbon class, certification). State persists in `localStorage` (`veilance.mock.v3`) and starts at policy v5.

## Layout

```
src/
  Screen.tsx                 top bar + map + drawer + status bar + explorer modal
  api/    client.ts http.ts mock.ts types.ts
  hooks/  queries.ts useAction.ts
  lib/    bus.ts format.ts lots.ts progress.ts registry.ts
  components/
    TopBar.tsx Map.tsx StatusBar.tsx Drawer.tsx JobRing.tsx ExplorerModal.tsx ui.tsx
    drawers/ OrgDrawer.tsx LotDrawer.tsx VerifierDrawer.tsx PolicyDrawer.tsx
```

### Company workspaces

The default screen is VoltCell's inventory and tasks. The demo workspace selector
switches between company views, the OEM verification workspace, and the full
operations graph. Companies see their own received/sent records and a separate
direct-transaction view; OEM sees requests and verification results without lots.
The selector is saved in session storage. Supplier actions on outgoing records are
read-only unless the selected workspace is that record's recipient.

`GET /graph?viewer=mine|refiner|batteryMfr|verifier|admin` projects graph responses on
the agent, with the same projection used by the mock adapter. The default scope is
`batteryMfr`. Query caches are separated by workspace. Tests:

```sh
node --import ./agent/node_modules/tsx/dist/loader.mjs shared/graphScope.test.ts
```

Run that command from the repository root. This is **demo presentation scope, not
access control**: the existing agent holds every demo company's keys, the selector
is not a login, and the other agent endpoints remain unauthenticated. Deployment
for separate companies requires authenticated sessions, server-derived company
scope and authorization for all reads/writes (including jobs, credentials,
explorer, policy and administrative routes), and isolated company key storage.

### Language

The header's 한글 / EN control switches product copy between Korean and English.
The preference is stored in `localStorage` under `veilance-language` (Korean by
default) and updates the document language. Switching keeps the current workspace,
open drawer and form values. Company names, free-form data and technical evidence
remain unchanged; translated option labels retain their original API values.
Translations live in `src/lib/i18n/messages.ts`; components subscribe with
`useI18n()` and render text through `t(source, values)` for interpolated messages.
