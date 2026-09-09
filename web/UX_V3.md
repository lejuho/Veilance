# Veilance UI v3 — operator's screen

One screen. No role switcher, no demo mode, no presenter overlay, no explanatory
prose. Everything an operator does happens by clicking an organisation or a lot on
the supply-chain map and acting inside the drawer that opens. The cryptography is
evidence you can open, never the headline.

## 0. Vocabulary (use these words in the UI, nothing else)

| UI word | Protocol word (never shown on the default surface) |
|---|---|
| Lot | credential / commitment |
| Delivered | scanned from inbox |
| Transferred | transferProvenance |
| Consumed | nullifier published |
| Compliance proof | attestation |
| Request proof | challenge |
| Evidence | commitment, nullifier, inbox #, attestation key, tx hash |

## 1. Layout (1440×900 reference, works down to 1024)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Veilance          ● chain #1484        contract 8ba7…e131        Policy v5 │  top bar, 48px
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   [Congo Mine Co.] ──lot──▶ [EuroRefine GmbH] ──lot──▶ [VoltCell Battery] ──proof──▶ [OEM]   │
│      Mine · ✓            Refiner · ✓              Battery maker · ✓          Verifier      │
│                                                                            │
│                                                            ┌─────────────┐ │
│                                                            │   drawer    │ │
│                                                            │  (on click) │ │
├────────────────────────────────────────────────────────────┴─────────────┴─┤
│ Idle                                                   (status bar, 40px)  │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Top bar**: wordmark; chain dot (green when node+indexer+proof server ok) + tip
  height; contract short-hash (click → explorer); "Policy v5" chip (click → policy
  drawer). Nothing else.
- **Map**: four organisation cards in a row, fixed positions, no dragging. Edges
  between consecutive cards carry **lot pills**. Nothing else on the canvas.
- **Status bar**: one line. `Idle` · or `Proving · transfer EuroRefine → VoltCell · 23 s`
  with a thin progress line that fills over the expected 40 s and keeps pulsing if
  it runs longer · or `Confirmed · block 1484` for 5 s · or `Rejected · already consumed`.
  Queue length appears only when > 0 (`+2 queued`).
- **Drawer**: right side, 420px, one at a time, closes with Esc / ✕. Never more
  than one primary action visible.

## 2. Organisation card

```
┌──────────────────────┐
│ EuroRefine GmbH      │   org name (16px)
│ Refiner              │   role (12px, muted)
│ ✓ Certified   2 lots │   badges row
└──────────────────────┘
```
- `✓ Certified` green / `Not certified` muted. Key registration is NOT shown on the
  card (it is in the drawer).
- The card pulses softly while a job for this org is running.
- Verifier card (OEM): name "OEM", role "Verifier", badge shows `3 proofs`.

## 3. Lot pill (on an edge)

```
  ● Cobalt · lot 2 · Delivered
```
- Dot colour: grey = Issued (not yet picked up), green = Delivered, dark/struck =
  Consumed. Red flash for 2 s on rejection.
- Multiple lots on one edge stack vertically, newest on top, max 3 then `+n`.
- Click → lot drawer.

## 4. Drawers

### 4.1 Organisation drawer (Mine / Refiner / Battery maker)
```
EuroRefine GmbH                                   ✕
Refiner · id 5d30…919a ⧉

Certified        ✓ since block 812   ↗
Receiving key    ✓ registered        ↗

Lots
  ● Cobalt · lot 2 · Delivered · 3 kg-class   ›
  ○ Cobalt · lot 1 · Consumed                 ›

[ Check inbox ]                       (Refiner / Battery maker)
[ Issue lot ]                         (Mine only)
```
- `↗` = explorer link to the tx that certified / registered.
- If not certified or key missing: the row shows `—` and the action button is
  disabled with a one-line reason under it (`Ask the policy admin to certify this
  organisation`). No other text.
- **Issue lot** (Mine) opens an inline form INSIDE the drawer:
  `To: [EuroRefine GmbH ▾]  Material: [Cobalt ▾]  Origin: [DRC Mine X ▾]  Carbon class: [3]`
  then `[ Issue ]`. Defaults prefilled: next org in chain, the first certified
  origin, Cobalt, 3. Under the button a single collapsed line `What goes on chain ▸`
  which expands to two bullets: "one 32-byte commitment" / "one sealed 192-byte
  delivery". That is the entire disclosure UI.
- **Check inbox** runs the scan and shows `1 new lot` or `Nothing new` inline.

### 4.2 Lot drawer
```
Cobalt · lot 2                                    ✕
held by EuroRefine GmbH

Origin        DRC Mine X          🔒
Carbon class  3                   🔒

Timeline
  Issued       block 1472 · Congo Mine Co.   ↗
  Delivered    scanned by EuroRefine GmbH
  Transferred  —

[ Transfer ]   [ Prove compliance ]

Evidence ▸      (collapsed)
  Commitment   067e…3c2c ⧉
  Nullifier    —
  Inbox #      2
```
- 🔒 = stays private (tooltip on hover: "never on chain"). No other markers.
- **Transfer** inline form: `To: [VoltCell Battery ▾]  Carbon class: [4]` (min =
  current) → `[ Transfer ]`. On a Consumed lot the button is still clickable but
  styled muted; the contract's rejection is the feedback: red line
  `Rejected by contract — credential already consumed` and the pill flashes. No
  "attack demo" wording anywhere.
- **Prove compliance** inline: `For: [OEM ▾]  Level: (•) Consumer ( ) Procurement ( ) Regulator`
  + a paste field `Request code` that is prefilled automatically if the OEM has an
  open request for this org, then `[ Prove ]`. Regulator shows one muted line
  `Publishes this lot's nullifier`.
- Progress for any action renders in place of the button: a ring timer with the
  seconds inside, one word beside it (Preparing / Proving / Submitting), then
  `Confirmed · block 1484 ↗` or the red rejection line.

### 4.3 Verifier (OEM) drawer
```
OEM                                               ✕
Verifier

[ Request proof ]   →  From: [VoltCell Battery ▾]  Level: [Procurement ▾]  [ Create ]

Requests
  Procurement · VoltCell · ✓ Passed · v5      ›
  Consumer · VoltCell · … waiting             ›
  Regulator · VoltCell · ⚠ Re-verify (v5→v6)  ›
```
- Creating a request stores it; the holder's "Prove compliance" form auto-fills
  the request code, so the operator never copies anything in the demo.
- Clicking a request shows the result table (6 rows, ✓/✗/—) and under it a 4-row
  `Private` list (Upstream supplier / Origin / Quantity / Commercial terms) each
  rendered as a 🔒 block. No sentences.

### 4.4 Policy drawer (from the top-bar chip)
```
Policy v5                                         ✕
Carbon threshold   [5]  [ Set ]
Certified origins      DRC Mine X            ↗
Certified organisations
  Congo Mine Co.      ✓ ↗
  EuroRefine GmbH     ✓ ↗
  VoltCell Battery    ✓ ↗
[ + Origin ]  [ + Organisation ]
```
- No bootstrap button. If nothing is certified yet, each row shows `[ Certify ]`.

### 4.5 Explorer modal (from any ↗ or the contract hash)
```
Transaction                                       ✕
Hash      4ba54835…  ⧉        Block  1479  ·  12:04:31
Contract  8ba7…e131 · call
Raw ▸
```
- Tabs only when opened from the contract hash: Contract (address, deployed at
  block, N actions list: block · circuit · org) / Ledger (8 counters).
- `Open in external explorer` link only when `VITE_EXPLORER_URL_TEMPLATE` is set.

## 5. Rules

- Max 1 sentence of helper text per drawer, and only when an action is disabled.
- No tooltips longer than 6 words. No "i" icons.
- Hashes always short (`4ba5…8815`) with copy on click. Full hash only in Explorer.
- Colours: one accent. Green = done, amber = running, red = rejected. No others.
- Every job stage change updates BOTH the drawer (if open) and the status bar.
- Nothing polls faster than 1 s; ledger/graph every 5 s; explorer tip every 10 s.
- Delete: /demo, role switcher, RoleGate, Issue/Transfer/Attest/Verify/VerifyResult/Credentials/AdminPolicy pages, DisclosurePreview component, `state/demo.ts`, all "attack demo" strings, all paragraphs.
