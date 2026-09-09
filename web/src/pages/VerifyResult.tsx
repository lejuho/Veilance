import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { PartyName, Profile } from '@/api/types';
import { PageTitle } from '@/components/RoleGate';
import { Badge, Banner, Card, Check, Empty, Hash, KV, Private } from '@/components/ui';
import { useLedger, useVerify } from '@/hooks/queries';
import { PARTIES, PREDICATES, PRIVATE_ROWS, PROFILES } from '@/lib/registry';

/** spec.md §4.2.3 — public result view. Anyone with the challenge can read it; there is nothing to leak. */
export function VerifyResult() {
  const { challenge = '' } = useParams();
  const [params] = useSearchParams();
  const holder = params.get('holder') as PartyName | null;
  const profile = params.get('profile') as Profile | null;
  const v = useVerify(challenge, holder, profile);
  const ledger = useLedger();

  if (!holder || !profile || !PARTIES[holder] || !PROFILES.some((p) => p.id === profile))
    return <Empty>Missing or invalid holder / profile in the URL.</Empty>;

  const r = v.data;
  const status = r?.status;
  const prof = PROFILES.find((p) => p.id === profile)!;
  const stale = status === 'STALE';

  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            Verification result
            {status && <Badge tone={status === 'PASSED' ? 'accent' : stale ? 'warn' : 'muted'}>{status}</Badge>}
          </span>
        }
        subtitle={
          <>
            {prof.label} · holder {PARTIES[holder].org} · challenge <Hash value={challenge} label="challenge" />
          </>
        }
        actions={<Link to="/verify" className="text-xs text-ink-300 underline">← my challenges</Link>}
      />

      {v.isError && <Banner tone="danger">{(v.error as Error).message}</Banner>}
      {status === 'PENDING' && (
        <Banner tone="neutral" title="Waiting for the holder">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulseDot rounded-full bg-accent" />
            The holder has not submitted a proof for this challenge yet. This page polls the ledger every 2 s.
          </span>
        </Banner>
      )}
      {stale && r && (
        <Banner tone="warn" title="Re-verification needed">
          Attested under policy <span className="font-mono">v{r.attestation?.policyVersion}</span>, current is <span className="font-mono">v{r.currentPolicyVersion}</span>. The proof was valid when made; the policy has changed since. Issue a new challenge.
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="What was proven" subtitle="Each row is a circuit assertion. The verifier learns the boolean, never the witness.">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-ink-700/70">
              {PREDICATES.map((d) => {
                const p = r?.predicates.find((x) => x.key === d.key);
                const covered = d.profiles.includes(profile);
                let state: 'ok' | 'fail' | 'pending' | 'na' = 'na';
                if (covered) {
                  if (!r || status === 'PENDING' || p?.passed == null) state = 'pending';
                  else if (p.passed) state = d.polarity === 'positive' ? 'ok' : 'fail';
                  else state = d.polarity === 'positive' ? 'fail' : 'ok';
                }
                return (
                  <tr key={d.key} className={covered ? '' : 'text-ink-500'}>
                    <td className="py-2.5">
                      {d.label}
                      {d.key === 'carbonThreshold' && covered && <span className="ml-2 inline-flex align-middle"><Private width="w-10" label="value private" /></span>}
                      {!covered && <span className="ml-2 text-[11px]">not in this profile</span>}
                    </td>
                    <td className="py-2.5 text-right text-base">
                      <Check state={state} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-ink-400">
            ✓ holds · ✗ absent (for "Restricted source" and "Duplicate claim", ✗ is the good outcome). Duplicate claim is only checked by the Regulator profile.
          </p>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card title="What stays private" subtitle="Not on chain. Not in the proof. Not in this page.">
            <KV rows={PRIVATE_ROWS.map((k) => ({ k, v: <Private /> }))} />
          </Card>
          <Card title="Ledger facts">
            <KV
              rows={[
                { k: 'Status', v: status ? <Badge tone={status === 'PASSED' ? 'accent' : stale ? 'warn' : 'muted'}>{status}</Badge> : '…' },
                { k: 'Profile', v: <span className="font-mono">{r?.attestation?.profile ?? profile}</span> },
                { k: 'Policy at proof', v: <span className="font-mono">{r?.attestation ? `v${r.attestation.policyVersion}` : '—'}</span> },
                { k: 'Current policy', v: <span className="font-mono">v{r?.currentPolicyVersion ?? ledger.data?.policyVersion ?? '…'}</span> },
                { k: 'Holder', v: <span className="flex items-center justify-end gap-2">{PARTIES[holder].org} <Badge tone="muted">off-chain</Badge></span> },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
