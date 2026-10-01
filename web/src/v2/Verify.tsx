import { t, useI18n } from '@/lib/i18n';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, CopyButton, ErrorLine, Field, Input, Select } from '@/components/ui';
import { v2, pct, type AttestationCheck, type AuditorPackage, type DeclarationCheck, type DirectoryEntry } from './api';

/** Notified body: checks a declared recycled share, and the hidden total once the manufacturer hands over its package. */
function DeclarationCheckForm() {
  useI18n();
  const [raw, setRaw] = useState('');
  const m = useMutation({
    mutationFn: (pkg: Partial<AuditorPackage>) => v2<DeclarationCheck>('POST', '/v2/public/declaration', pkg, null),
  });
  let parsed: Partial<AuditorPackage> | null = null;
  try {
    parsed = raw.trim() ? (JSON.parse(raw) as Partial<AuditorPackage>) : null;
  } catch {
    parsed = null;
  }
  const valid = !!parsed?.owner && !!parsed.plant && Number.isInteger(parsed.period) && !!parsed.material;
  const r = m.data;
  return (
    <section className="rounded-xl border border-ink-600 bg-ink-850 p-5">
      <h3 className="text-base font-semibold">{t('인증기관 · 재활용 함량 신고 확인')}</h3>
      <p className="mt-1 text-xs text-ink-400">{t('제조사에게 받은 제출 패키지(JSON)를 붙여 넣으세요. 체인에 기록된 신고 비율을 읽고, 숨겨진 투입 총량이 패키지의 값과 일치하는지 확인합니다. 그 총량을 공장 생산 기록과 대조하는 것이 인증기관의 몫입니다.')}</p>
      <textarea
        aria-label={t('제출 패키지 JSON')}
        className="mt-3 h-36 w-full rounded-md border border-ink-600 bg-ink-900 p-2.5 font-mono text-xs text-ink-100 focus:border-accent/60 focus:outline-none"
        placeholder='{"owner":"…","plant":"…","period":2028,"material":"nickel","totalKg":30000,"salt":"…"}'
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      {raw.trim() && !valid && <p className="mt-1 text-xs text-amber">{t('owner, plant, period, material 이 필요합니다.')}</p>}
      <Button className="mt-3" disabled={!valid || m.isPending} onClick={() => parsed && m.mutate(parsed)}>
        {t('확인')}
      </Button>
      <ErrorLine error={m.error} />
      {r && (
        <div className="mt-4 rounded-lg bg-ink-900 p-4 text-sm" role="status">
          {!r.declared ? (
            <p className="text-amber">{t('이 공장 · 기간 · 재료로 신고된 기록이 없습니다.')}</p>
          ) : (
            <ul className="space-y-1.5">
              <li>
                {t('신고된 재활용 비율')}: <span className="font-semibold text-accent">{pct(r.shareBps ?? 0)}</span>
              </li>
              <li>
                {t('투입 총량 일치')}:{' '}
                {r.totalMatches === undefined ? (
                  <span className="text-ink-400">{t('총량과 비밀값이 없어 확인하지 않음')}</span>
                ) : r.totalMatches ? (
                  <span className="text-accent">✓ {t('일치 — 이제 공장 생산 기록과 대조하세요')}</span>
                ) : (
                  <span className="text-red">✗ {t('불일치 — 패키지의 총량이 신고 당시 값과 다릅니다')}</span>
                )}
              </li>
              <li className="text-xs text-ink-400">{t('신고 비율은 컨트랙트가 증명으로 검증한 값입니다. 투입된 로트 · 재활용 업체 · 공급사는 체인에 드러나지 않습니다.')}</li>
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// The buyer's request codes, kept in this browser with a label (an order number)
// so the same code can be picked again when the supplier's answer comes back.
type SavedRequest = { label: string; code: string };
const REQUESTS = 'veilance-v2-requests';
const loadRequests = (): SavedRequest[] => {
  try {
    return JSON.parse(localStorage.getItem(REQUESTS) ?? '[]') as SavedRequest[];
  } catch {
    return [];
  }
};
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
const HEX64 = /^[0-9a-f]{64}$/i;
const CUSTOM = '__custom';

/** Buyer: checks an order-bound attestation from the challenge it issued. */
function AttestationCheckForm() {
  useI18n();
  const [challenge, setChallenge] = useState('');
  const [owner, setOwner] = useState('');
  const [min, setMin] = useState('');
  const [label, setLabel] = useState('');
  const [requests, setRequests] = useState<SavedRequest[]>(loadRequests);
  const [customOwner, setCustomOwner] = useState(false);
  const directory = useQuery({ queryKey: ['v2', 'public-directory'], queryFn: () => v2<DirectoryEntry[]>('GET', '/v2/public/directory', undefined, null), retry: 0 });
  const m = useMutation({
    mutationFn: () => v2<AttestationCheck>('POST', '/v2/public/attestation', { challenge: challenge.trim(), owner: owner.trim(), minQuantityKg: Number(min) }, null),
  });
  const valid = HEX64.test(challenge.trim()) && HEX64.test(owner.trim()) && Number.isInteger(Number(min)) && Number(min) > 0;
  const r = m.data;
  const suppliers = directory.data ?? [];
  const known = suppliers.find((d) => d.partyId === owner.trim().toLowerCase());
  const saved = requests.find((q) => q.code === challenge.trim().toLowerCase());
  const newRequest = () => {
    const code = randomCode();
    const next = [{ label: label.trim() || t('요청 {n}', { n: requests.length + 1 }), code }, ...requests].slice(0, 20);
    setRequests(next);
    try {
      localStorage.setItem(REQUESTS, JSON.stringify(next));
    } catch {
      /* storage is optional */
    }
    setChallenge(code);
    setLabel('');
  };
  return (
    <section className="rounded-xl border border-ink-600 bg-ink-850 p-5">
      <h3 className="text-base font-semibold">{t('구매사 · 주문 증명 확인')}</h3>
      <p className="mt-1 text-xs text-ink-400">{t('공급사에 보낸 요청 코드와 주문 수량으로 증명 기록을 찾습니다. 코드와 수량을 모르는 사람에게는 이 기록이 무엇인지 보이지 않습니다.')}</p>
      <textarea
        aria-label={t('공급사가 보낸 확인 정보 JSON')}
        className="mt-3 h-20 w-full rounded-md border border-ink-600 bg-ink-900 p-2.5 font-mono text-xs text-ink-100 focus:border-accent/60 focus:outline-none"
        placeholder={t('공급사가 보낸 확인 정보(JSON)를 붙여 넣으면 아래 칸이 채워집니다')}
        onChange={(e) => {
          try {
            const j = JSON.parse(e.target.value) as { challenge?: string; owner?: string; minQuantityKg?: number };
            if (j.challenge) setChallenge(j.challenge);
            if (j.owner) setOwner(j.owner);
            if (j.minQuantityKg) setMin(String(j.minQuantityKg));
          } catch {
            /* not JSON yet */
          }
        }}
      />
      <div className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('요청 코드')}>
            <Select
              value={saved?.code ?? (challenge.trim() ? CUSTOM : '')}
              onChange={(e) => e.target.value !== CUSTOM && setChallenge(e.target.value)}
            >
              <option value="">{t('저장한 요청 선택…')}</option>
              {requests.map((q) => (
                <option key={q.code} value={q.code}>
                  {q.label} · {q.code.slice(0, 8)}…
                </option>
              ))}
              {challenge.trim() && !saved && <option value={CUSTOM}>{t('받은 코드')} · {challenge.trim().slice(0, 8)}…</option>}
            </Select>
          </Field>
          <Field label={t('새 요청 (주문 번호 등 이름)')}>
            <div className="flex gap-2">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="PO-2028-0042" />
              <Button type="button" variant="secondary" size="sm" className="h-8 shrink-0" onClick={newRequest}>
                {t('코드 만들기')}
              </Button>
            </div>
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Input mono aria-label={t('요청 코드 (64자리)')} value={challenge} onChange={(e) => setChallenge(e.target.value)} placeholder={t('요청 코드 (64자리)')} />
          {HEX64.test(challenge.trim()) && <CopyButton text={challenge.trim()} className="h-8 shrink-0" />}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('공급사')}>
            {suppliers.length > 0 && !customOwner ? (
              <Select
                value={known?.partyId ?? (owner.trim() ? CUSTOM : '')}
                onChange={(e) => (e.target.value === CUSTOM ? setCustomOwner(true) : setOwner(e.target.value))}
              >
                <option value="">{t('공급사 선택…')}</option>
                {suppliers.map((d) => (
                  <option key={d.partyId} value={d.partyId}>
                    {d.name} · {d.partyId.slice(0, 6)}…
                  </option>
                ))}
                <option value={CUSTOM}>{owner.trim() && !known ? `${t('직접 입력')} · ${owner.trim().slice(0, 8)}…` : t('직접 입력…')}</option>
              </Select>
            ) : (
              <Input mono value={owner} onChange={(e) => setOwner(e.target.value)} placeholder={t('공급사 식별자 (64자리)')} />
            )}
          </Field>
          <Field label={t('주문 수량 (kg)')}>
            <Input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-3">
        <Button disabled={!valid || m.isPending} onClick={() => m.mutate()}>
          {t('확인')}
        </Button>
      </div>
      <ErrorLine error={m.error} />
      {r && (
        <p className="mt-3 text-sm" role="status">
          {!r.attested ? (
            <span className="text-amber">{t('아직 증명이 없습니다.')}</span>
          ) : r.fresh ? (
            <span className="text-accent">✓ {t('주문 수량 이상 · 정책 충족 (정책 v{v})', { v: r.policyVersion ?? '—' })}</span>
          ) : (
            <span className="text-amber">⚠ {t('이전 정책(v{old})으로 만든 증명입니다. 현재 v{cur} 기준으로 다시 요청하세요.', { old: r.policyVersion ?? '—', cur: r.currentPolicyVersion ?? '—' })}</span>
          )}
        </p>
      )}
    </section>
  );
}

export function VerifyHome() {
  useI18n();
  const ledger = useQuery({ queryKey: ['v2', 'public-ledger'], queryFn: () => v2<Record<string, string>>('GET', '/v2/public/ledger', undefined, null), retry: 0, refetchInterval: 15_000 });
  return (
    <div className="space-y-5">
      <DeclarationCheckForm />
      <AttestationCheckForm />
      {ledger.data && (
        <p className="text-center text-xs text-ink-400">
          {t('공유 원장')} {ledger.data.contractAddress?.slice(0, 8)}… · {t('로트 {n} · 사용 식별자 {m} · 신고 {d}', { n: ledger.data.lotLeaves, m: ledger.data.nullifiers, d: ledger.data.declarations })}
        </p>
      )}
    </div>
  );
}
