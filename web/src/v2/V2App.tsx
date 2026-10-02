import { t, useI18n } from '@/lib/i18n';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, ErrorLine, Field, Input } from '@/components/ui';
import { cx } from '@/lib/format';
import { getKey, setKey, short, V2Error } from './api';
import { DEMO_ACCOUNTS, SIM_ENABLED, resetSim } from './sim';
import { useHealth, useMe } from './hooks';
import { AUTO, switchMode } from './mode';
import { CompanyHome } from './Company';
import { AdminHome, PlatformHome } from './Admin';
import { VerifyHome } from './Verify';

const ROLE_LABEL: Record<string, string> = { platform: '운영', admin: '운영', company: '참여 회사' };

function SignIn({ onKey, error }: { onKey: (k: string) => void; error?: unknown }) {
  useI18n();
  const [k, setK] = useState('');
  const keyForm = (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (k.trim()) onKey(k.trim());
      }}
    >
      <Field label={t('API 키')}>
        <Input mono type="password" autoComplete="off" value={k} onChange={(e) => setK(e.target.value)} placeholder="vk_…" />
      </Field>
      <Button type="submit" disabled={!k.trim()}>
        {t('들어가기')}
      </Button>
    </form>
  );
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border border-ink-600 bg-ink-850 p-6">
      <h2 className="text-lg font-semibold">{t('회사 계정으로 들어가기')}</h2>
      {SIM_ENABLED ? (
        <>
          {(['admin', 'company'] as const).map((group) => (
            <div key={group}>
              <p className="mb-1.5 text-[11px] text-ink-400">{t(ROLE_LABEL[group])}</p>
              <div className="divide-y divide-ink-700 overflow-hidden rounded-lg border border-ink-600">
                {DEMO_ACCOUNTS.filter((a) => (group === 'admin' ? a.role !== 'company' : a.role === 'company')).map((a) => (
                  <button key={a.key} type="button" onClick={() => onKey(a.key)} className="flex w-full items-center justify-between gap-3 bg-ink-900 px-3 py-2 text-left hover:bg-ink-800">
                    <span className="text-sm text-ink-100">{a.name}</span>
                    <span className="text-[11px] text-ink-400">
                      {t(a.kind)}
                      {a.country && a.country !== '—' ? ` · ${t(a.country)}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <details className="border-t border-ink-700 pt-3">
            <summary className="cursor-pointer text-xs text-ink-400">{t('API 키로 들어가기')}</summary>
            <div className="mt-3">{keyForm}</div>
          </details>
        </>
      ) : (
        <>
          <p className="text-xs text-ink-400">{t('관리자에게 받은 API 키를 입력하세요. 키는 이 탭에만 보관되고, 탭을 닫으면 지워집니다.')}</p>
          {keyForm}
        </>
      )}
      <ErrorLine error={error} />
      <p className="border-t border-ink-700 pt-3 text-xs text-ink-400">
        {t('인증기관이나 구매사라면 계정 없이')} <Link className="text-accent underline" to="/v2/verify">{t('검증 화면')}</Link>{t('을 쓰면 됩니다.')}
      </p>
    </div>
  );
}

/** Veilance v2 — the platform layer UI (docs/PLATFORM_LAYER.md). v1 stays at `/`. */
export function V2App() {
  const { locale, setLocale } = useI18n();
  const loc = useLocation();
  const qc = useQueryClient();
  const health = useHealth();
  const [key, setKeyState] = useState<string | null>(getKey());
  const me = useMe(key);
  const verify = loc.pathname.startsWith('/v2/verify');
  const signIn = (k: string | null) => {
    setKey(k);
    setKeyState(k);
    qc.removeQueries({ queryKey: ['v2'] });
  };
  const badKey = me.error instanceof V2Error && me.error.status === 401;
  const ready = health.data?.ready;
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="flex min-h-12 flex-wrap items-center gap-3 border-b border-ink-700 bg-ink-850 px-4 py-2">
        <Link to="/v2" className="text-2xl font-bold tracking-tight text-ink-100">
          Veilance <span className="align-top text-xs font-medium text-accent">v2</span>
        </Link>
        <span className="flex items-center gap-2 text-xs text-ink-300">
          <span className={cx('inline-block h-2 w-2 rounded-full', health.isError ? 'bg-red' : ready ? 'bg-accent' : 'bg-amber')} />
          {health.isError ? t('노드에 연결할 수 없음') : ready ? t('노드 준비됨') : health.data?.step ?? '…'}
        </span>
        {AUTO && !SIM_ENABLED && (
          <button className="rounded border border-ink-600 px-2 py-0.5 text-xs text-ink-400 hover:text-ink-200" onClick={() => switchMode('demo')}>
            {t('프론트 데모로 전환')}
          </button>
        )}
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link to="/v2" className={cx('rounded-md px-3 py-1.5', !verify ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200')}>
            {t('회사')}
          </Link>
          <Link to="/v2/verify" className={cx('rounded-md px-3 py-1.5', verify ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200')}>
            {t('검증')}
          </Link>
        </nav>
        {me.data && !verify && (
          <span className="flex items-center gap-2 text-xs text-ink-300">
            <span className="font-medium text-ink-100">{me.data.name}</span>
            <span className="font-mono text-ink-400">{short(me.data.partyId)}</span>
            <button className="text-ink-400 hover:text-red" onClick={() => signIn(null)}>
              {t('나가기')}
            </button>
          </span>
        )}
        <div role="group" aria-label="Language / 언어" className="flex shrink-0 rounded-lg border border-ink-600 p-0.5 text-xs">
          <button type="button" aria-pressed={locale === 'ko'} onClick={() => setLocale('ko')} className={`rounded-md px-2 py-1 ${locale === 'ko' ? 'bg-ink-700 text-ink-100' : 'text-ink-400'}`}>한글</button>
          <button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')} className={`rounded-md px-2 py-1 ${locale === 'en' ? 'bg-ink-700 text-ink-100' : 'text-ink-400'}`}>EN</button>
        </div>
      </header>
      {SIM_ENABLED && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-amber/20 bg-amber-faint px-4 py-1 text-[11px] text-amber">
          <span>{t('데모 환경 · 컨트랙트 규칙을 브라우저에서 실행하며 체인에는 기록되지 않습니다')}</span>
          <button
            className="rounded border border-amber/40 px-1.5 hover:bg-amber/10"
            onClick={() => {
              resetSim();
              signIn(null);
            }}
          >
            {t('처음부터 다시')}
          </button>
          {AUTO && (
            <button className="rounded border border-amber/40 px-1.5 hover:bg-amber/10" onClick={() => switchMode('live')}>
              {t('라이브 노드 연결')}
            </button>
          )}
        </div>
      )}
      <main className="mx-auto w-full max-w-5xl flex-1 p-5 sm:p-8">
        {verify ? (
          <VerifyHome />
        ) : !key || badKey ? (
          <SignIn onKey={signIn} error={badKey ? new Error(t('알 수 없는 API 키입니다.')) : undefined} />
        ) : me.isPending ? (
          <p className="py-10 text-center text-sm text-ink-400">{t('불러오는 중…')}</p>
        ) : me.error ? (
          <ErrorLine error={me.error} />
        ) : me.data?.role === 'platform' ? (
          <PlatformHome />
        ) : me.data?.role === 'admin' ? (
          <AdminHome me={me.data} />
        ) : me.data ? (
          <CompanyHome me={me.data} />
        ) : null}
      </main>
    </div>
  );
}
