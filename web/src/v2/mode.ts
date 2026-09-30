// Which backend the v2 UI talks to, fixed once at boot.
//   VITE_V2_DEMO unset  → the live node at V2_URL
//   VITE_V2_DEMO=1      → the in-browser simulation only (sim.ts)
//   VITE_V2_DEMO=auto   → the live node when it answers; otherwise the visitor can fall
//                         back to the simulation (ModeGate). `?api=<url>` points it at a
//                         node, `?mode=demo` skips the probe.

import { setKey, tunnelHeaders, V2_URL } from './api';
import { enableSim } from './sim';

export const AUTO = import.meta.env.VITE_V2_DEMO === 'auto';
/** Static hosting (GitHub Pages) cannot serve deep links: these builds route by hash. */
export const STATIC_BUILD = import.meta.env.VITE_V2_DEMO === '1' || AUTO;

const MODE_KEY = 'veilance-v2-mode';

async function nodeAnswers(): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3500);
  try {
    const res = await fetch(`${V2_URL}/v2/health`, { headers: tunnelHeaders, signal: ctl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveV2Mode(): Promise<'live' | 'demo' | 'unreachable'> {
  if (import.meta.env.VITE_V2_DEMO === '1') return 'demo';
  if (!AUTO) return 'live';
  let chosen: string | null = null;
  try {
    const param = new URLSearchParams(window.location.search).get('mode');
    if (param === 'demo' || param === 'live') sessionStorage.setItem(MODE_KEY, param);
    chosen = sessionStorage.getItem(MODE_KEY);
  } catch {
    /* storage is optional */
  }
  if (chosen === 'demo') {
    enableSim();
    return 'demo';
  }
  return (await nodeAnswers()) ? 'live' : 'unreachable';
}

/** Reloads into the other mode. API keys differ between the two, so the tab signs out. */
export function switchMode(mode: 'live' | 'demo') {
  try {
    sessionStorage.setItem(MODE_KEY, mode);
  } catch {
    /* storage is optional */
  }
  setKey(null);
  const url = new URL(window.location.href);
  url.searchParams.delete('mode');
  window.history.replaceState(null, '', url);
  window.location.reload();
}
