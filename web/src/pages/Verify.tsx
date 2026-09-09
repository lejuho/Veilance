import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getApi } from '@/api/client';
import type { Challenge, PartyName, Profile } from '@/api/types';
import { PageTitle, RoleGate } from '@/components/RoleGate';
import { Badge, Banner, Button, Card, Check, Empty, Field, Hash, Select } from '@/components/ui';
import { useChallenges, useVerify } from '@/hooks/queries';
import { cx, fmtTime } from '@/lib/format';
import { HOLDERS, PARTIES, PREDICATES, PROFILES, predicatesFor } from '@/lib/registry';

export function Verify() {
  return (
    <RoleGate allow={['verifier']} why="Verification needs no wallet — switch to the Verifier view.">
      <VerifyPage />
    </RoleGate>
  );
}

export function shareLink(c: Challenge): string {
  return `${window.location.origin}/credentials?challenge=${c.challenge}&profile=${c.profile}`;
}
export function resultPath(c: Challenge): string {
  return `/verify/${c.challenge}?holder=${c.holder}&profile=${c.profile}`;
}

function VerifyPage() {
  const [profile, setProfile] = useState<Profile>('procurement');
  const [holder, setHolder] = useState<PartyName>('batteryMfr');
  const [created, setCreated] = useState<Challenge | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const challenges = useChallenges();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => getApi().createChallenge({ profile, holder }),
    onSuccess: (c) => {
      setCreated(c);
      qc.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
  const copy = (text: string, tag: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(tag);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Request a proof" subtitle="Pick what you need to know, name the holder, hand them a challenge. The answer appears here straight from the ledger." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title="Profile" subtitle="Each profile is a fixed predicate set — the holder cannot prove less, and you cannot ask for more.">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PROFILES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProfile(p.id)}
                  className={cx('rounded-md border p-3 text-left transition-colors', profile === p.id ? 'border-accent bg-accent-faint' : 'border-ink-700 hover:border-ink-500')}
                >
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="mt-0.5 text-[11px] text-ink-400">{p.who}</div>
                </button>
              ))}
            </div>
            <table className="mt-4 w-full text-sm">
              <tbody className="divide-y divide-ink-700/70">
                {PREDICATES.map((d) => {
                  const on = d.profiles.includes(profile);
                  return (
                    <tr key={d.key} className={on ? '' : 'text-ink-500'}>
                      <td className="py-1.5">
                        {d.label}
                        {d.note && <span className="ml-2 text-[11px] text-ink-400">({d.note})</span>}
                      </td>
                      <td className="py-1.5 text-right">{on ? <Check state={d.polarity === 'positive' ? 'ok' : 'fail'} /> : <Check state="na" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-ink-400">✓ = must hold · ✗ = must be absent · — = not checked by this profile. Duplicate claim is checked by the Regulator profile only.</p>
          </Card>

          <Card title="Holder">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Field label="Organisation" hint="Needed to recompute the attestation key = H(challenge, holderPartyId, profile).">
                  <Select value={holder} onChange={(e) => setHolder(e.target.value as PartyName)}>
                    {HOLDERS.map((h) => (
                      <option key={h} value={h}>
                        {PARTIES[h].org} ({PARTIES[h].short})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button size="lg" onClick={() => m.mutate()} loading={m.isPending}>
                Generate challenge
              </Button>
            </div>
            {m.isError && <Banner tone="danger" className="mt-3">{(m.error as Error).message}</Banner>}
            {created && (
              <div className="mt-5 animate-fadeIn rounded-md border border-accent/30 bg-accent-faint/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-accent">Challenge issued</div>
                  <Badge tone="neutral">{PROFILES.find((p) => p.id === created.profile)!.label}</Badge>
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-wider text-ink-400">challenge (32-byte CSPRNG)</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="break-all font-mono text-xs text-ink-100">{created.challenge}</code>
                  <Button size="sm" variant="secondary" onClick={() => copy(created.challenge, 'c')}>
                    {copied === 'c' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="mt-3 text-[11px] uppercase tracking-wider text-ink-400">share link for the holder</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="break-all font-mono text-xs text-ink-200">{shareLink(created)}</code>
                  <Button size="sm" variant="secondary" onClick={() => copy(shareLink(created), 'l')}>
                    {copied === 'l' ? 'Copied' : 'Copy link'}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-300">
                  <span>attestation key</span>
                  <Hash value={created.attestationKey} head={10} tail={6} label="attestationKey" />
                  <span className="text-ink-500">·</span>
                  <Link to={resultPath(created)} className="underline">
                    open result view (PENDING until the holder proves)
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title="My challenges" subtitle="Status is polled from the ledger.">
            {challenges.data?.length ? (
              <div className="divide-y divide-ink-700/70">
                {challenges.data.map((c) => (
                  <ChallengeRow key={c.challenge} c={c} />
                ))}
              </div>
            ) : (
              <Empty>No challenges yet.</Empty>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChallengeRow({ c }: { c: Challenge }) {
  const v = useVerify(c.challenge, c.holder, c.profile);
  const status = v.data?.status;
  const tone = status === 'PASSED' ? 'accent' : status === 'STALE' ? 'warn' : 'muted';
  return (
    <Link to={resultPath(c)} className="block py-2.5 hover:bg-ink-800/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span>{PARTIES[c.holder].short}</span>
          <span className="text-ink-500">·</span>
          <span className="text-ink-300">{PROFILES.find((p) => p.id === c.profile)!.label}</span>
        </div>
        <Badge tone={tone}>
          {status === 'PENDING' && <span className="inline-block h-1.5 w-1.5 animate-pulseDot rounded-full bg-ink-300" />}
          {status ?? '…'}
        </Badge>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-ink-400">
        <span className="font-mono">{c.challenge.slice(0, 16)}…</span>
        <span>
          {predicatesFor(c.profile).length} predicates · {fmtTime(c.createdAt)}
        </span>
      </div>
    </Link>
  );
}
