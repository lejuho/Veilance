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
| `VITE_EXPLORER_URL_TEMPLATE` | Optional, e.g. `https://explorer/tx/{hash}`. Adds an external link to the explorer modal. |

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
