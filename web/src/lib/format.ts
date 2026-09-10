import { getLocale, t } from './i18n';
export function shortHex(v: string | undefined | null, head = 4, tail = 4): string {
  if (!v) return '—';
  const s = v.startsWith('0x') ? v.slice(2) : v;
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function fmtTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(getLocale() === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Contract assert messages arrive as `veilance: credential already consumed`. */
export function reason(error?: string): string {
  return t((error ?? 'assertion failed').replace(/^veilance:\s*/i, ''));
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
