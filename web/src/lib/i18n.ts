import { useSyncExternalStore } from 'react';
import { messages } from './i18n/messages';
export type Locale = 'en' | 'ko';
const storageKey = 'veilance-language';
let locale: Locale = 'ko';
try { const saved = localStorage.getItem(storageKey); if (saved === 'en' || saved === 'ko') locale = saved; } catch { /* Optional storage. */ }
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getLocale = () => locale;
export function setLocale(next: Locale) {
  locale = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(storageKey, next); } catch { /* Language still works without storage. */ }
  listeners.forEach(listener => listener());
}
export function useI18n() {
  const language = useSyncExternalStore(subscribe, getLocale, () => 'ko' as Locale);
  return { locale: language, t, setLocale };
}
export function t(source: string, values: Record<string, string | number> = {}): string {
  const translated = messages[source];
  const koreanSource = /[가-힣]/.test(source);
  const template = translated === undefined ? source : (locale === 'ko') === koreanSource ? source : translated;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
if (typeof document !== 'undefined') document.documentElement.lang = locale;
