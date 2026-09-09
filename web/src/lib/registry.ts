import type { PartyName, Profile, Role } from '@/api/types';

/** L3 display data — names never go on chain. Mirrors agent/registry.json demo seed. */
export const PARTIES: Record<PartyName, { org: string; role: string; short: string }> = {
  admin: { org: 'Battery Passport Consortium (Admin)', role: 'Policy admin', short: 'Admin' },
  mine: { org: 'Congo Mine Co.', role: 'Root issuer', short: 'Mine' },
  refiner: { org: 'EuroRefine GmbH', role: 'Holder', short: 'Refiner' },
  batteryMfr: { org: 'VoltCell Battery', role: 'Holder', short: 'Battery Manufacturer' },
};

export const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: 'admin', label: 'Admin', hint: PARTIES.admin.org },
  { id: 'mine', label: 'Mine', hint: PARTIES.mine.org },
  { id: 'refiner', label: 'Refiner', hint: PARTIES.refiner.org },
  { id: 'batteryMfr', label: 'Battery Manufacturer', hint: PARTIES.batteryMfr.org },
  { id: 'verifier', label: 'Verifier', hint: 'OEM / Consumer / Regulator — no wallet' },
];

export const HOLDERS: PartyName[] = ['mine', 'refiner', 'batteryMfr'];
export const RECIPIENTS: PartyName[] = ['refiner', 'batteryMfr', 'mine'];

export const MATERIALS = ['Cobalt', 'Lithium', 'Nickel', 'Graphite', 'Manganese'];

/** Accepts either a PartyName key or an org display name (the agent's /ledger/policy sends the latter). */
export function partyByNameOrOrg(v: string | undefined): PartyName | undefined {
  if (!v) return undefined;
  if (v in PARTIES) return v as PartyName;
  return (Object.keys(PARTIES) as PartyName[]).find((k) => PARTIES[k].org === v);
}

export const PROFILE_CODE: Record<Profile, number> = { consumer: 1, procurement: 2, regulator: 3 };

export interface PredicateDef {
  key: string;
  label: string;
  /** positive: ✓ when passed. negative: ✗ when passed (the bad thing was NOT found). */
  polarity: 'positive' | 'negative';
  profiles: Profile[];
  note?: string;
}

/** spec.md §4.2.3 result table. */
export const PREDICATES: PredicateDef[] = [
  { key: 'responsibleSourcing', label: 'Responsible sourcing', polarity: 'positive', profiles: ['consumer', 'procurement', 'regulator'] },
  { key: 'chainOfCustody', label: 'Valid chain of custody', polarity: 'positive', profiles: ['consumer', 'procurement', 'regulator'] },
  { key: 'supplierCertification', label: 'Supplier certification', polarity: 'positive', profiles: ['procurement', 'regulator'] },
  { key: 'carbonThreshold', label: 'Carbon class ≤ threshold', polarity: 'positive', profiles: ['procurement', 'regulator'], note: 'value private' },
  { key: 'restrictedSource', label: 'Restricted source', polarity: 'negative', profiles: ['consumer', 'procurement', 'regulator'] },
  { key: 'duplicateClaim', label: 'Duplicate claim', polarity: 'negative', profiles: ['regulator'], note: 'Regulator only' },
];

export const PROFILES: { id: Profile; label: string; who: string; circuit: string; blurb: string }[] = [
  {
    id: 'consumer',
    label: 'Consumer',
    who: 'End customer',
    circuit: 'attestConsumer',
    blurb: 'Ownership, tree membership, certified origin.',
  },
  {
    id: 'procurement',
    label: 'OEM Procurement',
    who: 'Buyer',
    circuit: 'attestProcurement',
    blurb: 'Consumer checks + supplier certification + carbon class ≤ policy threshold.',
  },
  {
    id: 'regulator',
    label: 'Regulator',
    who: 'Authority',
    circuit: 'attestRegulator',
    blurb: 'Procurement checks + credential not consumed. Reveals the nullifier.',
  },
];

export const PRIVATE_ROWS = ['Upstream supplier', 'Origin', 'Material amount', 'Commercial relationship'];

export function profileDef(p: Profile) {
  return PROFILES.find((x) => x.id === p)!;
}
export function predicatesFor(p: Profile) {
  return PREDICATES.filter((d) => d.profiles.includes(p));
}
