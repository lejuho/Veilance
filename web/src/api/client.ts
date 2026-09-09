import type {
  AttestInput,
  Challenge,
  Credential,
  DisclosureOp,
  DisclosurePreview,
  Health,
  IssueInput,
  Job,
  Ledger,
  LedgerTx,
  Party,
  PartyName,
  Policy,
  Profile,
  ScanResult,
  TransferInput,
  VerifyResult,
} from './types';

/** Everything the UI ever calls. One implementation talks HTTP to the party agent, the other is an in-browser mock. */
export interface VeilanceApi {
  readonly mode: 'mock' | 'http';
  readonly baseUrl?: string;

  health(): Promise<Health>;
  parties(): Promise<Party[]>;
  deploy(): Promise<Job | { contractAddress: string }>;

  ledger(): Promise<Ledger>;
  policy(): Promise<Policy>;
  txs(): Promise<LedgerTx[]>;

  job(id: string): Promise<Job>;
  jobs(party?: PartyName): Promise<Job[]>;

  addOrigin(input: { label: string; originId?: string }): Promise<Job>;
  addSupplier(input: { partyName: PartyName; certId?: string; certLabel?: string }): Promise<Job>;
  setCarbonThreshold(threshold: number): Promise<Job>;
  bootstrap(): Promise<{ jobs: Job[] }>;

  registerEncKey(party: PartyName): Promise<Job>;
  credentials(party: PartyName): Promise<Credential[]>;
  scan(party: PartyName): Promise<ScanResult>;
  issue(party: PartyName, input: IssueInput): Promise<Job>;
  transfer(party: PartyName, credentialId: string, input: TransferInput): Promise<Job>;
  attest(party: PartyName, credentialId: string, input: AttestInput): Promise<Job>;
  disclosurePreview(party: PartyName, op: DisclosureOp, profile?: Profile): Promise<DisclosurePreview>;

  createChallenge(input: { profile: Profile; holder: PartyName }): Promise<Challenge>;
  challenges(): Promise<Challenge[]>;
  verify(challenge: string, holder: PartyName, profile: Profile): Promise<VerifyResult>;

  /** Mock only: wipe the simulated chain. */
  resetMock?(): void;
}

let instance: VeilanceApi | null = null;

export function isMockMode(): boolean {
  const env = import.meta.env;
  if (env.VITE_MOCK === '1' || env.VITE_MOCK === 'true') return true;
  return !env.VITE_API_URL;
}

export async function loadApi(): Promise<VeilanceApi> {
  if (instance) return instance;
  if (isMockMode()) {
    const { createMockApi } = await import('./mock');
    instance = createMockApi();
  } else {
    const { createHttpApi } = await import('./http');
    instance = createHttpApi(import.meta.env.VITE_API_URL as string);
  }
  return instance;
}

export function getApi(): VeilanceApi {
  if (!instance) throw new Error('API not loaded yet — call loadApi() first');
  return instance;
}
