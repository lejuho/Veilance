import { t, useI18n } from '@/lib/i18n';
import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ErrorLine, Field, Heading, Input, Select } from '@/components/ui';
import { v2, type Applied, type CompanyProfile, type Profile, type TenantCreated } from './api';
import { JobLine, q2, useRun } from './hooks';

type Tenant = {
  id: string;
  name: string;
  role: string;
  partyId: string;
  certId: string;
  supplier: boolean;
  recycler: 'eu' | 'other' | null;
  receivingKey: boolean;
  profile?: CompanyProfile;
  applied?: Applied;
  declined?: boolean;
};

/** Applied for something the ledger does not grant yet, and not declined. */
const isPending = (tn: Tenant) => !!tn.applied && !tn.declined && ((tn.applied.supplier && !tn.supplier) || (!!tn.applied.recycler && !tn.recycler));
const recyclerLabel = (r: 'eu' | 'other') => (r === 'eu' ? t('재활용 원료 발행 가능 · EU (1.3배 가산)') : t('재활용 원료 발행 가능 · EU 외'));

function Deploy() {
  useI18n();
  const r = useRun<Record<string, never>>('POST', '/v2/admin/deploy');
  return (
    <section className="rounded-xl border border-amber/40 bg-amber-faint p-5">
      <h3 className="text-base font-semibold">{t('v2 컨트랙트가 아직 배포되지 않았습니다')}</h3>
      <p className="mt-1 text-xs text-ink-300">{t('배포는 7개 회로로 먼저 올린 뒤 나머지 7개 검증 키를 유지보수 거래로 추가합니다. 로컬 데브넷에서 약 3분 걸립니다.')}</p>
      <Button className="mt-3" onClick={() => r.run({})} disabled={r.pending}>
        {t('배포')}
      </Button>
      <JobLine job={r.job} className="mt-2" />
      <ErrorLine error={r.error} />
    </section>
  );
}

function CreateTenant() {
  useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const m = useMutation({
    mutationFn: () => v2<TenantCreated>('POST', '/v2/admin/tenants', { name: name.trim() }),
    onSuccess: () => {
      setName('');
      qc.invalidateQueries({ queryKey: q2.tenants });
    },
  });
  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !m.isPending) m.mutate();
        }}
      >
        <Field label={t('회사 이름')} className="w-64">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" disabled={!name.trim() || m.isPending}>
          {t('회사 계정 만들기')}
        </Button>
      </form>
      <ErrorLine error={m.error} />
      {m.data && (
        <div className="rounded-lg border border-accent/40 bg-ink-900 p-4 text-xs">
          <p className="text-sm text-accent">{t('API 키는 지금 한 번만 표시됩니다. 회사에 안전하게 전달하세요.')}</p>
          <pre className="mt-2 overflow-x-auto text-ink-200">{JSON.stringify({ apiKey: m.data.apiKey, partyId: m.data.partyId, certId: m.data.certId }, null, 2)}</pre>
          <p className="mt-2 text-ink-400">{t('수신 키 등록 거래가 자동으로 진행됩니다.')}</p>
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">✓ {children}</span>;
}

function Who({ tn }: { tn: Tenant }) {
  useI18n();
  return (
    <>
      <p className="text-sm font-medium">{tn.name}</p>
      {tn.profile && (
        <p className="text-[11px] text-ink-300">
          {t(tn.profile.kind)} · {t(tn.profile.country)}
        </p>
      )}
      <p className="truncate font-mono text-[11px] text-ink-500">{tn.partyId}</p>
    </>
  );
}

/** What the ledger grants, plus a warning while the receiving key is missing. */
function Granted({ tn }: { tn: Tenant }) {
  useI18n();
  return (
    <>
      {(tn.supplier || tn.recycler) && (
        <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
          {tn.supplier && <Badge>{t('공급업체 인증 완료')}</Badge>}
          {tn.recycler && <Badge>{recyclerLabel(tn.recycler)}</Badge>}
        </p>
      )}
      {/* Registered automatically when the account is created; shown only while it is missing. */}
      {!tn.receivingKey && <p className="mt-1 text-[11px] text-amber">{t('수신 키가 아직 체인에 없어 로트를 받을 수 없습니다. 실패했다면 노드를 다시 시작할 때 자동으로 다시 등록됩니다.')}</p>}
    </>
  );
}

function TenantRow({ tn }: { tn: Tenant }) {
  useI18n();
  const supplier = useRun<{ partyId: string; certId: string }>('POST', '/v2/admin/suppliers');
  const recycler = useRun<{ partyId: string; certId: string; isEu: boolean }>('POST', '/v2/admin/recyclers');
  const [eu, setEu] = useState('true');
  return (
    <div className="border-t border-ink-700 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Who tn={tn} />
          <Granted tn={tn} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!tn.supplier && (
            <Button size="sm" variant="secondary" disabled={supplier.pending} onClick={() => supplier.run({ partyId: tn.partyId, certId: tn.certId })}>
              {t('공급업체 인증')}
            </Button>
          )}
          {!tn.recycler && (
            <>
              <Select aria-label={t('재활용 구분')} className="h-7 w-24 text-xs" value={eu} onChange={(e) => setEu(e.target.value)}>
                <option value="true">EU</option>
                <option value="false">{t('EU 외')}</option>
              </Select>
              <Button size="sm" variant="secondary" disabled={recycler.pending} onClick={() => recycler.run({ partyId: tn.partyId, certId: tn.certId, isEu: eu === 'true' })}>
                {t('재활용 업체 인증')}
              </Button>
            </>
          )}
        </div>
      </div>
      <JobLine job={supplier.job ?? recycler.job} className="mt-1" />
      <ErrorLine error={supplier.error ?? recycler.error} />
    </div>
  );
}

/** The policy authority reviews what the platform's applicant asked for: one approval per item. */
function ApplicationRow({ tn }: { tn: Tenant }) {
  useI18n();
  const qc = useQueryClient();
  const supplier = useRun<{ partyId: string; certId: string }>('POST', '/v2/admin/suppliers');
  const recycler = useRun<{ partyId: string; certId: string; isEu: boolean }>('POST', '/v2/admin/recyclers');
  const decline = useMutation({
    mutationFn: () => v2('POST', '/v2/admin/applications/decline', { partyId: tn.partyId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: q2.tenants }),
  });
  const a = tn.applied!;
  return (
    <div className="border-t border-ink-700 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Who tn={tn} />
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-ink-400">{t('신청')}</span>
            {a.supplier && <span className="rounded-full border border-ink-500 px-2 py-0.5 text-ink-200">{t('공급업체 인증')}</span>}
            {a.recycler && <span className="rounded-full border border-ink-500 px-2 py-0.5 text-ink-200">{a.recycler === 'eu' ? t('재활용 업체 인증 · EU') : t('재활용 업체 인증 · EU 외')}</span>}
          </p>
          <Granted tn={tn} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {a.supplier && !tn.supplier && (
            <Button size="sm" disabled={supplier.pending} onClick={() => supplier.run({ partyId: tn.partyId, certId: tn.certId })}>
              {t('공급업체 승인')}
            </Button>
          )}
          {a.recycler && !tn.recycler && (
            <Button size="sm" disabled={recycler.pending} onClick={() => recycler.run({ partyId: tn.partyId, certId: tn.certId, isEu: a.recycler === 'eu' })}>
              {a.recycler === 'eu' ? t('재활용 업체 승인 · EU') : t('재활용 업체 승인 · EU 외')}
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={decline.isPending} onClick={() => decline.mutate()}>
            {t('반려')}
          </Button>
        </div>
      </div>
      <JobLine job={supplier.job ?? recycler.job} className="mt-1" />
      <ErrorLine error={supplier.error ?? recycler.error ?? decline.error} />
    </div>
  );
}

function MemberRow({ tn }: { tn: Tenant }) {
  useI18n();
  const nothing = !tn.supplier && !tn.recycler && !tn.applied?.supplier && !tn.applied?.recycler;
  return (
    <div className="border-t border-ink-700 py-3">
      <Who tn={tn} />
      <Granted tn={tn} />
      {tn.declined && <p className="mt-1 text-[11px] text-red">{t('반려됨 — 체인에는 아무것도 기록되지 않았습니다')}</p>}
      {nothing && !tn.declined && <p className="mt-1 text-[11px] text-ink-400">{t('인증 신청 없음 · 로트를 받기만 합니다')}</p>}
    </div>
  );
}

/** Simulation: the policy authority's console. Accounts come from the platform operator. */
function AuthorityHome({ tenants }: { tenants: Tenant[] }) {
  useI18n();
  const pending = tenants.filter(isPending);
  const members = tenants.filter((tn) => !isPending(tn));
  return (
    <div className="space-y-6">
      <p className="text-center text-xs text-ink-400">{t('정책 기관 콘솔 — 회사 계정은 추적 플랫폼이 발급하고, 여기서는 신청 내용을 심사해 인증을 체인에 기록합니다.')}</p>
      <section className="rounded-xl border border-ink-600 bg-ink-850 p-5">
        <h3 className="text-base font-semibold">
          {t('인증 대기')} <span className="text-sm font-normal text-ink-400">{pending.length}</span>
        </h3>
        {pending.length === 0 ? <p className="mt-3 text-sm text-ink-400">{t('대기 중인 신청이 없습니다.')}</p> : pending.map((tn) => <ApplicationRow key={tn.id} tn={tn} />)}
      </section>
      <section className="rounded-xl border border-ink-600 bg-ink-850 p-5">
        <h3 className="text-base font-semibold">{t('참여 회사')}</h3>
        {members.map((tn) => (
          <MemberRow key={tn.id} tn={tn} />
        ))}
      </section>
      <section className="rounded-xl border border-ink-600 bg-ink-850 p-5">
        <h3 className="mb-3 text-base font-semibold">{t('정책')}</h3>
        <Policy />
      </section>
    </div>
  );
}

/** Simulation: the traceability platform issues company accounts with what each applies for. */
export function PlatformHome() {
  useI18n();
  const qc = useQueryClient();
  const tenants = useQuery({ queryKey: q2.tenants, queryFn: () => v2<Tenant[]>('GET', '/v2/admin/tenants'), refetchInterval: 5_000 });
  const [f, setF] = useState({ name: '', country: '', kind: '', supplier: true, recycler: '' as '' | 'eu' | 'other' });
  const m = useMutation({
    mutationFn: () =>
      v2<TenantCreated>('POST', '/v2/admin/tenants', {
        name: f.name.trim(),
        profile: { country: f.country.trim(), kind: f.kind.trim() },
        apply: { supplier: f.supplier, recycler: f.recycler || null },
      }),
    onSuccess: () => {
      setF({ name: '', country: '', kind: '', supplier: true, recycler: '' });
      qc.invalidateQueries({ queryKey: q2.tenants });
    },
  });
  const companies = (tenants.data ?? []).filter((x) => x.role === 'company');
  const status = (tn: Tenant) =>
    tn.declined ? (
      <span className="text-red">{t('반려됨')}</span>
    ) : isPending(tn) ? (
      <span className="text-amber">{t('정책 기관 심사 대기')}</span>
    ) : tn.supplier || tn.recycler ? (
      <span className="text-accent">{t('승인됨')}</span>
    ) : (
      <span className="text-ink-400">{t('인증 신청 없음 (구매 전용)')}</span>
    );
  return (
    <div className="space-y-6">
      <p className="text-center text-xs text-ink-400">{t('추적 플랫폼 — 고객사를 확인(KYC)한 뒤 계정을 발급합니다. 인증 신청은 정책 기관의 대기 목록으로 넘어갑니다.')}</p>
      <section className="rounded-xl border border-ink-600 bg-ink-850 p-5">
        <h3 className="text-base font-semibold">{t('회사 온보딩')}</h3>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (f.name.trim() && !m.isPending) m.mutate();
          }}
        >
          <Field label={t('회사 이름')}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label={t('국가')}>
            <Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
          </Field>
          <Field label={t('업종')}>
            <Input value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-200">
            <input type="checkbox" checked={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.checked })} />
            {t('공급업체 인증 신청')}
          </label>
          <Field label={t('재활용 업체 인증 신청')}>
            <Select value={f.recycler} onChange={(e) => setF({ ...f, recycler: e.target.value as '' | 'eu' | 'other' })}>
              <option value="">{t('신청 안 함')}</option>
              <option value="eu">EU</option>
              <option value="other">{t('EU 외')}</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={!f.name.trim() || m.isPending}>
              {t('계정 발급')}
            </Button>
          </div>
        </form>
        <ErrorLine error={m.error} />
        {m.data && (
          <div className="mt-3 rounded-lg border border-accent/40 bg-ink-900 p-4 text-xs">
            <p className="text-sm text-accent">{t('API 키는 지금 한 번만 표시됩니다. 회사에 안전하게 전달하세요.')}</p>
            <pre className="mt-2 overflow-x-auto text-ink-200">{JSON.stringify({ apiKey: m.data.apiKey, partyId: m.data.partyId }, null, 2)}</pre>
            <p className="mt-2 text-ink-400">{t('수신 키 등록 거래가 자동으로 진행되고, 인증 신청은 정책 기관 대기 목록에 올라갑니다.')}</p>
          </div>
        )}
      </section>
      <section className="rounded-xl border border-ink-600 bg-ink-850 p-5">
        <h3 className="text-base font-semibold">{t('발급한 회사')}</h3>
        {companies.map((tn) => (
          <div key={tn.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-ink-700 py-3">
            <div className="min-w-0">
              <Who tn={tn} />
            </div>
            <p className="text-xs">{status(tn)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Policy() {
  useI18n();
  const [origin, setOrigin] = useState('');
  const [rule, setRule] = useState({ inMaterial: 'nickel', outMaterial: 'nickel', yieldPct: '100' });
  const [threshold, setThreshold] = useState('9');
  const o = useRun<{ label: string }>('POST', '/v2/admin/origins');
  const r = useRun<{ inMaterial: string; outMaterial: string; yieldPct: number }>('POST', '/v2/admin/rules');
  const th = useRun<{ value: number }>('POST', '/v2/admin/threshold');
  return (
    <div className="space-y-5">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (origin.trim()) o.run({ label: origin.trim() }); }}>
        <Field label={t('원산지 · 재활용 시설 이름')} className="w-64">
          <Input value={origin} maxLength={32} onChange={(e) => setOrigin(e.target.value)} />
        </Field>
        <Button type="submit" disabled={!origin.trim() || o.pending}>{t('원산지 승인')}</Button>
        <JobLine job={o.job} className="w-full" />
        <ErrorLine error={o.error} />
      </form>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); r.run({ inMaterial: rule.inMaterial, outMaterial: rule.outMaterial, yieldPct: Number(rule.yieldPct) }); }}>
        <Field label={t('입력 재료')} className="w-36"><Input value={rule.inMaterial} onChange={(e) => setRule({ ...rule, inMaterial: e.target.value })} /></Field>
        <Field label={t('산출 재료')} className="w-36"><Input value={rule.outMaterial} onChange={(e) => setRule({ ...rule, outMaterial: e.target.value })} /></Field>
        <Field label={t('최대 수율 (%)')} className="w-28"><Input inputMode="numeric" value={rule.yieldPct} onChange={(e) => setRule({ ...rule, yieldPct: e.target.value })} /></Field>
        <Button type="submit" disabled={r.pending}>{t('가공 규칙 등록')}</Button>
        <JobLine job={r.job} className="w-full" />
        <ErrorLine error={r.error} />
      </form>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); th.run({ value: Number(threshold) }); }}>
        <Field label={t('탄소 등급 상한')} className="w-28"><Input inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></Field>
        <Button type="submit" disabled={th.pending}>{t('설정')}</Button>
        <JobLine job={th.job} className="w-full" />
        <ErrorLine error={th.error} />
      </form>
    </div>
  );
}

export function AdminHome({ me }: { me: Profile }) {
  useI18n();
  const tenants = useQuery({ queryKey: q2.tenants, queryFn: () => v2<Tenant[]>('GET', '/v2/admin/tenants'), refetchInterval: 10_000 });
  const companies = (tenants.data ?? []).filter((x) => x.role === 'company');
  if (me.deployed && companies.some((x) => x.applied)) return <AuthorityHome tenants={companies} />;
  return (
    <div className="space-y-6">
      {!me.deployed && <Deploy />}
      <section className="rounded-xl border border-ink-600 bg-ink-850 p-5">
        <h3 className="text-base font-semibold">{t('회사')}</h3>
        <div className="mt-3">
          <CreateTenant />
        </div>
        <Heading>{t('등록된 회사')}</Heading>
        {(tenants.data ?? []).filter((x) => x.role === 'company').map((tn) => <TenantRow key={tn.id} tn={tn} />)}
      </section>
      <section className="rounded-xl border border-ink-600 bg-ink-850 p-5">
        <h3 className="mb-3 text-base font-semibold">{t('정책')}</h3>
        <Policy />
      </section>
    </div>
  );
}
