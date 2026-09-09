import type { NodeId, PartyName, Profile } from '@/api/types';

/** L3 display data — names never go on chain. Mirrors agent/registry.json. */
export const PARTIES: Record<PartyName, { org: string; short: string; role: string }> = {
  admin: { org: 'Admin', short: 'Admin', role: 'Policy admin' },
  mine: { org: 'Congo Mine Co.', short: 'Congo Mine', role: 'Mine' },
  refiner: { org: 'EuroRefine GmbH', short: 'EuroRefine', role: 'Refiner' },
  batteryMfr: { org: 'VoltCell Battery', short: 'VoltCell', role: 'Battery maker' },
};
export const VERIFIER = { org: 'OEM', short: 'OEM', role: 'Verifier' };

/** Map order, left to right. */
export const CHAIN: PartyName[] = ['mine', 'refiner', 'batteryMfr'];
export const NODES: NodeId[] = [...CHAIN, 'verifier'];

export const orgName = (id: NodeId | undefined) => (!id ? '—' : id === 'verifier' ? VERIFIER.org : PARTIES[id].org);
export const shortName = (id: NodeId | undefined) => (!id ? '—' : id === 'verifier' ? VERIFIER.short : PARTIES[id].short);
export const nextInChain = (p: PartyName): PartyName => CHAIN[CHAIN.indexOf(p) + 1] ?? CHAIN.find((x) => x !== p)!;

export const MATERIALS = ['Cobalt', 'Lithium', 'Nickel', 'Graphite', 'Manganese'];

export const PROFILES: { id: Profile; label: string }[] = [
  { id: 'consumer', label: 'Consumer' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'regulator', label: 'Regulator' },
];
export const profileLabel = (p: Profile) => PROFILES.find((x) => x.id === p)?.label ?? p;
export const PROFILE_CODE: Record<Profile, number> = { consumer: 1, procurement: 2, regulator: 3 };

export const PRIVATE_ROWS = ['Upstream supplier', 'Origin', 'Quantity', 'Commercial terms'];
