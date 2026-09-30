import { t, useI18n } from '@/lib/i18n';
import { useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { setV2Url, V2_URL } from './api';
import { switchMode } from './mode';

/** Shown by the `auto` build when the live node does not answer (mode.ts). */
export function ModeGate() {
  const { locale, setLocale } = useI18n();
  const [url, setUrl] = useState(V2_URL);
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-5">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-ink-600 bg-ink-850 p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink-100">
            Veilance <span className="align-top text-xs font-medium text-accent">v2</span>
          </h1>
          <div role="group" aria-label="Language / 언어" className="flex shrink-0 rounded-lg border border-ink-600 p-0.5 text-xs">
            <button type="button" aria-pressed={locale === 'ko'} onClick={() => setLocale('ko')} className={`rounded-md px-2 py-1 ${locale === 'ko' ? 'bg-ink-700 text-ink-100' : 'text-ink-400'}`}>한글</button>
            <button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')} className={`rounded-md px-2 py-1 ${locale === 'en' ? 'bg-ink-700 text-ink-100' : 'text-ink-400'}`}>EN</button>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-red" />
            {t('라이브 노드에 연결할 수 없습니다')}
          </h2>
          <p className="text-xs text-ink-400">{t('발표자 PC의 Preprod 노드가 꺼져 있거나 터널 주소가 바뀌었을 수 있습니다. 프론트 데모는 같은 화면과 규칙을 브라우저 안에서 시뮬레이션합니다.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => switchMode('demo')}>{t('프론트 데모로 보기')}</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            {t('다시 연결')}
          </Button>
        </div>
        <form
          className="space-y-2 border-t border-ink-700 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^https?:\/\//.test(url.trim())) return;
            setV2Url(url);
            switchMode('live');
          }}
        >
          <Field label={t('노드 주소')}>
            <Input mono value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://….ngrok-free.app" />
          </Field>
          <Button type="submit" variant="secondary" size="sm" disabled={!/^https?:\/\//.test(url.trim())}>
            {t('이 주소로 연결')}
          </Button>
        </form>
      </div>
    </div>
  );
}
