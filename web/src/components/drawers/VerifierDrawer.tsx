import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import type { Challenge, PartyName, Profile } from '@/api/types';
import { Drawer } from '@/components/Drawer';
import { Button, ErrorLine, Explore, Field, Heading, LockBlock, Mark, Select } from '@/components/ui';
import { qk, useChallenges, useGraph, useVerify } from '@/hooks/queries';
import { cx } from '@/lib/format';
import { CHAIN, PARTIES, PRIVATE_ROWS, PROFILES, VERIFIER, profileLabel, shortName } from '@/lib/registry';

function useStatus(c: Challenge) {
  const v = useVerify(c.challenge, c.holder, c.profile);
  const r = v.data;
  if (!r) return { text: '…', tone: 'text-ink-400' };
  if (r.status === 'PASSED') return { text: `✓ Passed · v${r.attestation?.policyVersion}`, tone: 'text-accent' };
  if (r.status === 'STALE') return { text: `⚠ Re-verify (v${r.attestation?.policyVersion}→v${r.currentPolicyVersion})`, tone: 'text-amber' };
  return { text: '… waiting', tone: 'text-ink-400' };
}

function RequestRow({ c }: { c: Challenge }) {
  const s = useStatus(c);
  return (
    <Link
      to={{ pathname: '/', search: `?org=verifier&req=${c.challenge}` }}
      className="flex items-center gap-2 rounded px-1 py-1.5 text-[13px] hover:bg-ink-800"
    >
      <span className="flex-1">
        {profileLabel(c.profile)} · {shortName(c.holder)} · <span className={s.tone}>{s.text}</span>
      </span>
      <span className="text-ink-500">›</span>
    </Link>
  );
}

function RequestDetail({ c }: { c: Challenge }) {
  const v = useVerify(c.challenge, c.holder, c.profile);
  const graph = useGraph();
  const att = graph.data?.attestations.find((a) => a.challenge === c.challenge || (a.holder === c.holder && a.attestationKey === c.attestationKey));
  const s = useStatus(c);
  return (
    <>
      <Link to={{ pathname: '/', search: '?org=verifier' }} className="text-[12px] text-ink-400 hover:text-ink-100">
        ‹ Requests
      </Link>
      <div className="mt-3 flex items-center justify-between text-[14px]">
        <span>
          {profileLabel(c.profile)} · {PARTIES[c.holder].org}
        </span>
        <span className={cx('flex items-center gap-2 text-[13px]', s.tone)}>
          {s.text} <Explore tx={att?.txHash} />
        </span>
      </div>
      <div className="mt-3 divide-y divide-ink-700/70 rounded-md border border-ink-700">
        {(v.data?.predicates ?? []).map((p) => (
          <div key={p.key} className="flex items-center justify-between px-3 py-1.5 text-[13px]">
            <span className="text-ink-200">{p.label}</span>
            <Mark state={p.passed} />
          </div>
        ))}
        {!v.data && <div className="px-3 py-2 text-[13px] text-ink-500">…</div>}
      </div>
      <Heading>Private</Heading>
      <div className="divide-y divide-ink-700/50">
        {PRIVATE_ROWS.map((r) => (
          <LockBlock key={r} label={r} />
        ))}
      </div>
    </>
  );
}

export function VerifierDrawer({ req, onClose }: { req: string | null; onClose: () => void }) {
  const challenges = useChallenges();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [from, setFrom] = useState<PartyName>('batteryMfr');
  const [level, setLevel] = useState<Profile>('procurement');
  const create = useMutation({
    mutationFn: () => getApi().createChallenge({ profile: level, holder: from }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.challenges });
      qc.invalidateQueries({ queryKey: ['open'] });
      setCreating(false);
    },
  });
  const list = [...(challenges.data ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const selected = req ? list.find((c) => c.challenge === req) : undefined;

  return (
    <Drawer title={VERIFIER.org} subtitle={VERIFIER.role} onClose={onClose}>
      {selected ? (
        <RequestDetail key={selected.challenge} c={selected} />
      ) : (
        <>
          {creating ? (
            <form
              className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!create.isPending) create.mutate();
              }}
            >
              <Field label="From">
                <Select value={from} onChange={(e) => setFrom(e.target.value as PartyName)}>
                  {CHAIN.map((p) => (
                    <option key={p} value={p}>
                      {PARTIES[p].org}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Level">
                <Select value={level} onChange={(e) => setLevel(e.target.value as Profile)}>
                  {PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" size="sm" className="h-8" disabled={create.isPending}>
                Create
              </Button>
            </form>
          ) : (
            <Button onClick={() => setCreating(true)}>Request proof</Button>
          )}
          <ErrorLine error={create.error} />

          <Heading>Requests</Heading>
          {list.length ? (
            <div className="-mx-1">
              {list.map((c) => (
                <RequestRow key={c.challenge} c={c} />
              ))}
            </div>
          ) : (
            <p className="py-1.5 text-[13px] text-ink-500">—</p>
          )}
        </>
      )}
    </Drawer>
  );
}
