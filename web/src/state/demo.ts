import { useSyncExternalStore } from 'react';
import type { Role } from '@/api/types';

const KEY = 'veilance.demo.step';

export interface DemoStep {
  id: string;
  n: string;
  landing: string;
  title: string;
  role: Role;
  /** Static path, or 'challenge' to deep-link into the newest challenge. */
  path: string | { kind: 'holderLink' } | { kind: 'resultLink' };
  action: string;
  say: string;
}

/** landing.md §10 — the 3-minute demo, split into stops a presenter can step through with one button. */
export const DEMO_STEPS: DemoStep[] = [
  {
    id: 'bootstrap',
    n: '1',
    landing: 'Step 1 — Register the supply chain',
    title: 'Admin bootstraps the policy',
    role: 'admin',
    path: '/admin/policy',
    action: 'Click "Bootstrap demo policy". Nine proofs run back-to-back: one origin, three suppliers, carbon threshold 5, four encryption keys.',
    say: 'Only hashes land on chain — originId, partyId, certId. The names stay in each company’s agent.',
  },
  {
    id: 'issue',
    n: '1',
    landing: 'Step 1 — Register the supply chain',
    title: 'Mine issues a cobalt credential',
    role: 'mine',
    path: '/issue',
    action: 'Recipient EuroRefine GmbH, origin DRC Mine X, Cobalt, carbon class 3. Point at the disclosure preview. Click "Issue provenance".',
    say: 'One commitment and one sealed 192-byte entry. Mine, supplier, quantity: ████. Certification: verified.',
  },
  {
    id: 'transfer',
    n: '2',
    landing: 'Step 2 — Refiner',
    title: 'Refiner consumes it and issues downstream',
    role: 'refiner',
    path: '/credentials',
    action: '"Scan inbox" — the credential appears. "Transfer" → recipient VoltCell Battery, carbon class 4 → "Transfer".',
    say: 'What goes public: one nullifier, one new commitment. Upstream supplier: PRIVATE. Origin: PRIVATE. Policy verification: PASSED.',
  },
  {
    id: 'challenge',
    n: '3',
    landing: 'Step 3 — Battery OEM',
    title: 'OEM asks for a proof',
    role: 'verifier',
    path: '/verify',
    action: 'Profile "OEM Procurement", holder VoltCell Battery → "Generate challenge" → "Copy link".',
    say: 'The OEM has no wallet and never sees the supply chain. It only needs a 256-bit challenge and the public ledger.',
  },
  {
    id: 'attest',
    n: '3',
    landing: 'Step 3 — Battery OEM',
    title: 'Battery Manufacturer answers',
    role: 'batteryMfr',
    path: { kind: 'holderLink' },
    action: '"Scan inbox" → "Prove policy" on the ACTIVE credential (challenge is pre-filled) → "Submit attestation".',
    say: 'Carbon class ≤ 5 is proven without saying which class. Supplier certification is proven without saying who certified.',
  },
  {
    id: 'result',
    n: '3',
    landing: 'Step 3 — Battery OEM',
    title: 'OEM reads the result',
    role: 'verifier',
    path: { kind: 'resultLink' },
    action: 'The page flips from PENDING to PASSED on its own.',
    say: 'Responsible sourcing ✓, chain of custody ✓, certification ✓, carbon ✓ (value private), restricted source ✗. Four PRIVATE rows.',
  },
  {
    id: 'attack',
    n: '4',
    landing: 'Step 4 — The attack',
    title: 'Refiner tries to spend the same credential twice',
    role: 'refiner',
    path: '/credentials',
    action: 'On the CONSUMED card click "Transfer again (attack demo)" → "Transfer anyway".',
    say: 'The proof is built, the contract assertion fails: REJECTED. Ledger counters unchanged. This is why provenance needs shared state, not just selective disclosure.',
  },
];

type Listener = () => void;
const listeners = new Set<Listener>();
function read(): number | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === null) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n < DEMO_STEPS.length ? n : null;
  } catch {
    return null;
  }
}
let cached = read();
function emit() {
  cached = read();
  listeners.forEach((l) => l());
}
export function setDemoStep(n: number | null) {
  try {
    if (n === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(n));
  } catch {
    /* ignore */
  }
  emit();
}
export function useDemoStep(): number | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => e.key === KEY && emit();
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener('storage', onStorage);
      };
    },
    () => cached,
    () => null,
  );
}
