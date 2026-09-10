import { t, useI18n, getLocale } from '@/lib/i18n';
import { useWorkspace } from '@/lib/workspace';
import { useEffect, useState } from 'react';
import { getApi } from '@/api/client';
import type { GraphEdge, PartyName, Profile } from '@/api/types';
import { Drawer } from '@/components/Drawer';
import { JobRing } from '@/components/JobRing';
import { Button, ErrorLine, Explore, Field, Hash, Heading, Input, Lock, Reason, Row, Select } from '@/components/ui';
import { useGraph, useOpenRequests } from '@/hooks/queries';
import { useAction } from '@/hooks/useAction';
import { bus } from '@/lib/bus';
import { cx } from '@/lib/format';
import { consumedBy, lotTitle } from '@/lib/lots';
import { CHAIN, PARTIES, PROFILE_HELP, PROFILES, VERIFIER, nextInChain, orgName } from '@/lib/registry';
import { isActive } from '@/lib/progress';
import { CheckInbox } from './OrgDrawer';

function TransferForm({ lot }: { lot: GraphEdge }) {
  useI18n();
  const [to, setTo] = useState<PartyName>(nextInChain(lot.to));
  const [carbon, setCarbon] = useState(String(lot.carbonClass ?? 0));
  const carbonN = Number(carbon);
  const min = lot.carbonClass ?? 0;
  const valid = Number.isInteger(carbonN) && carbonN >= min && carbonN <= 255;
  const api = getApi();
  const action = useAction((recipient: PartyName, carbonClass: number) => api.transfer(lot.to, lot.credentialId, { recipient, carbonClass }), () => to);
  const consumed = lot.status === 'CONSUMED';
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !action.pending) action.run(to, carbonN);
      }}
      onChange={() => action.job && !isActive(action.job) && action.reset()}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("To")}>
          <Select value={to} onChange={(e) => setTo(e.target.value as PartyName)}>
            {CHAIN.filter((p) => p !== lot.to).map((p) => (
              <option key={p} value={p}>
                {PARTIES[p].org}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Carbon class")}>
          <Input type="number" min={min} max={255} value={carbon} onChange={(e) => setCarbon(e.target.value)} />
        </Field>
      </div>
      {action.job ? (
        <JobRing jobId={action.job.id} initial={action.job} onTerminal={(j) => j.stage === 'rejected' && bus.flashLot(lot.id)} />
      ) : (
        <div>
          <Button type="submit" muted={consumed} disabled={!valid || action.pending}>
            {t("Transfer")}</Button>
          <ErrorLine error={action.error} />
        </div>
      )}
    </form>
  );
}

function ProveForm({ lot, requestCode }: { lot: GraphEdge; requestCode?: string | null }) {
  useI18n();
  const open = useOpenRequests(lot.to);
  const [profile, setProfile] = useState<Profile>('consumer');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    const newest = requestCode ? open.data?.find(c => c.challenge === requestCode) : open.data?.[0];
    if (!touched && newest) {
      setCode(newest.challenge);
      setProfile(newest.profile);
    }
  }, [open.data, touched, requestCode]);
  const valid = /^[0-9a-f]{64}$/i.test(code.trim());
  const api = getApi();
  const action = useAction((p: Profile, challenge: string) => api.attest(lot.to, lot.credentialId, { profile: p, challenge }), () => 'verifier');
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !action.pending) action.run(profile, code.trim().toLowerCase());
      }}
      onChange={() => action.job && !isActive(action.job) && action.reset()}
    >
      {!!open.data?.length && <Field label={t("응답할 요청")}><Select value={code} onChange={e => { const c = open.data?.find(c => c.challenge === e.target.value); if (c) { setTouched(true); setCode(c.challenge); setProfile(c.profile); } }}><option value="">{t("요청 선택")}</option>{open.data.map(c => <option key={c.challenge} value={c.challenge}>{t(c.profile === "consumer" ? "Consumer" : c.profile === "procurement" ? "Procurement" : "Regulator")} · {new Date(c.createdAt).toLocaleString(getLocale() === "ko" ? "ko-KR" : "en-US")}</option>)}</Select></Field>}
      <Field label={t("For")}>
        <Select value="verifier" onChange={() => {}}>
          <option value="verifier">{VERIFIER.org}</option>
        </Select>
      </Field>
      <div>
        <div className="mb-1 text-[11px] text-ink-300">{t("Level")}</div>
        <div className="flex gap-4 text-[13px]">
          {PROFILES.map((p) => (
            <label key={p.id} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="level"
                value={p.id}
                checked={profile === p.id}
                onChange={() => {
                  setTouched(true);
                  setProfile(p.id);
                }}
                className="accent-accent"
              />
              {t(p.label)}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-300">{t(PROFILE_HELP[profile])}</p>
      </div>
      <p className="text-xs leading-relaxed text-ink-400">{t("Proves the selected lot meets the requested checks. Private source data stays with the supplier; OEM receives a verifiable result.")}</p>
      <Field label={t("Request code · links this proof to the buyer’s request")}>
        <Input
          mono
          value={code}
          placeholder={t("64 hex characters")}
          onChange={(e) => {
            setTouched(true);
            setCode(e.target.value);
          }}
        />
      </Field>
      {action.job ? (
        <JobRing jobId={action.job.id} initial={action.job} />
      ) : (
        <div>
          <Button type="submit" disabled={!valid || action.pending}>
            {t("Prove")}</Button>
          <ErrorLine error={action.error} />
        </div>
      )}
    </form>
  );
}

export function LotDrawer({ id, onClose, requestCode }: { id: string; onClose: () => void; requestCode?: string | null }) {
  useI18n();
  const viewer = useWorkspace();
  const graph = useGraph();
  const edges = graph.data?.edges ?? [];
  const lot = edges.find((e) => e.id === id) ?? edges.find((e) => e.credentialId === id);
  const [mode, setMode] = useState<'transfer' | 'prove' | null>(null);
  useEffect(() => setMode(requestCode ? 'prove' : null), [id, requestCode]);
  if (!lot)
    return (
      <Drawer title={t("Lot")} onClose={onClose}>
        {!graph.isPending && <p className="text-[13px] text-ink-500">—</p>}
      </Drawer>
    );
  const canManage = viewer === 'admin' || viewer === lot.to;
  const held = lot.status !== 'ISSUED';
  const next = consumedBy(edges, lot);
  const consumedBlock = next?.blockHeight ?? lot.consumedBlockHeight;
  const consumedTx = next?.txHash ?? lot.consumedTxHash;
  return (
    <Drawer title={lotTitle(edges, lot)} subtitle={lot.status === 'CONSUMED' ? t("Previously held by {company}", { company: orgName(lot.to) }) : held ? t("Held by {company}", { company: orgName(lot.to) }) : t("Awaiting receipt by {company}", { company: orgName(lot.to) })} onClose={onClose}>
      <div className="mb-4 rounded-lg bg-ink-800 p-3 text-[13px] leading-relaxed">
        <p className="font-medium">{lot.status === 'CONSUMED' ? t("Used in a transfer") : held ? t("Held inventory") : t("Waiting for the recipient")}</p>
        <p className="mt-1 text-ink-300">{lot.status === 'CONSUMED' ? t("This record has been spent to create a new lot. It is no longer available inventory.") : held ? t("The recipient has imported this material record. A lot represents one tracked batch, not a measured quantity.") : t("The record has been sent. Use Check received materials to import it. This does not confirm physical delivery.")}</p>
      </div>
      <p className="mb-2 text-xs text-ink-400">{t("Supplier inventory details · These values are not shared with OEM by the proof.")}</p>
      <Row k={t("Origin")} v={<>{lot.originLabel ?? '—'} <Lock /></>} />
      <Row k={t("Carbon class")} v={<>{lot.carbonClass ?? '—'} <Lock /></>} />

      <Heading>{t("Timeline")}</Heading>
      <Row
        k={t("Issued")}
        v={
          <>
            <span>
              {"block"}{lot.blockHeight ?? '—'} · {orgName(lot.from)}
            </span>
            <Explore tx={lot.txHash} />
          </>
        }
      />
      <Row k={t("Delivered")} v={held ? t("scanned by {company}", { company: orgName(lot.to) }) : <span className="text-ink-500">—</span>} />
      <Row
        k={t("Transferred")}
        v={
          lot.status === 'CONSUMED' ? (
            <>
              <span>
                {"block"}{consumedBlock ?? '—'} {t("· to")}{orgName(next?.to)}
              </span>
              <Explore tx={consumedTx} />
            </>
          ) : (
            <span className="text-ink-500">—</span>
          )
        }
      />

      <div className="mt-6">
        {!canManage ? <p className="text-sm text-ink-300">{t("우리 회사가 보낸 기록입니다. 수령 회사의 재고 작업은 해당 회사에서 진행합니다.")}</p> : held ? (
          <>
            <div className="flex gap-2">
              <Button variant={mode ? (mode === 'transfer' ? 'secondary' : 'ghost') : 'primary'} muted={!mode && lot.status === 'CONSUMED'} onClick={() => setMode('transfer')}>
                {t("Transfer")}</Button>
              <Button variant={mode === 'prove' ? 'secondary' : 'ghost'} className={cx(!mode && 'border border-ink-600')} onClick={() => setMode('prove')}>
                {t("Prove compliance")}</Button>
            </div>
            {mode === 'transfer' && <TransferForm key={lot.id} lot={lot} />}
            {mode === 'prove' && <ProveForm key={`${lot.id}-${requestCode ?? ''}`} lot={lot} requestCode={requestCode} />}
          </>
        ) : (
          <CheckInbox party={lot.to} />
        )}
        <Reason>{null}</Reason>
      </div>

      <details className="mt-6 text-[13px]">
        <summary className="cursor-pointer select-none text-[11px] font-medium uppercase tracking-wider text-ink-400">{t("Evidence")}</summary>
        <Row k={t("Commitment")} v={<Hash value={lot.commitment} />} />
        <Row k={t("Nullifier")} v={<Hash value={lot.nullifier} />} />
        <Row k={t("Inbox #")} v={<span className="font-mono text-xs">{lot.inboxIndex ?? '—'}</span>} />
      </details>
    </Drawer>
  );
}
