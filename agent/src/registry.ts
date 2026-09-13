// Veilance Party Agent — L3 label registry.
//
// Labels (origin display name, material display name, org name, certification
// name) never come from the chain — they live here. `registry.json` is the
// committed seed (origin "DRC Mine X", material "Cobalt", the four org
// names, and each party's default certId — see agent/API.md's "Notes for
// implementers"). Anything the running agent adds at runtime (new origins
// via POST /admin/origins, for example) is layered on top in
// `agent/.state/registry-runtime.json` (gitignored) — the seed file itself
// is never mutated.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  AGENT_STATE_DIR,
  REGISTRY_RUNTIME_JSON_PATH,
  REGISTRY_SEED_PATH,
} from "./config.js";
import type { PartyName } from "./types.js";

type SupplierSeed = { readonly certId: string; readonly certLabel: string };
/** Public identity of a party this agent process may not host — see registry() below. */
type PartyDirectoryEntry = { readonly partyId?: string };

type RegistrySeed = {
  readonly orgs: Record<PartyName, string>;
  readonly suppliers: Partial<Record<PartyName, SupplierSeed>>;
  /**
   * Public directory of every known party's partyId (= H("veilance:id",
   * partySecret) — never the secret itself), for `startCertifySupplierJob`
   * (handlers.ts) to certify a company this process does not host (roadmap
   * milestone 1, HANDOFF.md §4: per-company agent separation). Optional and
   * empty by default — a demo/Preprod agent that hosts every party never
   * needs it, since it computes partyId locally instead. Populate it by
   * running `npx tsx src/cli/print-identity.ts` on the OWNER agent (the one
   * that actually holds that party's secret) and pasting its output here.
   */
  readonly parties?: Partial<Record<PartyName, PartyDirectoryEntry>>;
  readonly defaultOrigin: { readonly originId: string; readonly label: string };
  readonly materials: readonly string[];
};

type RegistryRuntime = {
  origins: Record<string, string>;
};

const readJson = <T>(filePath: string, fallback: T): T => {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
};

const writeJson = (filePath: string, data: unknown): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
};

export class Registry {
  private readonly seed: RegistrySeed;
  private runtime: RegistryRuntime;

  constructor() {
    this.seed = readJson<RegistrySeed>(REGISTRY_SEED_PATH, {
      orgs: { admin: "Admin", mine: "Mine", refiner: "Refiner", batteryMfr: "Battery Manufacturer" },
      suppliers: {},
      defaultOrigin: { originId: "0".repeat(64), label: "Default Origin" },
      materials: [],
    });
    this.runtime = readJson<RegistryRuntime>(REGISTRY_RUNTIME_JSON_PATH, { origins: {} });
    // Seed the default origin into the runtime origin map on first boot so
    // originLabel lookups work for it exactly like any admin-added origin.
    if (!(this.seed.defaultOrigin.originId in this.runtime.origins)) {
      this.runtime.origins[this.seed.defaultOrigin.originId] = this.seed.defaultOrigin.label;
      this.persist();
    }
  }

  private persist(): void {
    writeJson(REGISTRY_RUNTIME_JSON_PATH, this.runtime);
  }

  orgName(party: PartyName): string {
    return this.seed.orgs[party] ?? party;
  }

  defaultOrigin(): { originId: string; label: string } {
    return this.seed.defaultOrigin;
  }

  materials(): readonly string[] {
    return this.seed.materials;
  }

  /** The party's pre-agreed certId (what admin certifies it under, and what the party proves as its own). */
  supplierCertId(party: PartyName): string | undefined {
    return this.seed.suppliers[party]?.certId;
  }

  /** Public partyId for a party this process may not host — see the `parties` directory above. */
  partyId(party: PartyName): string | undefined {
    return this.seed.parties?.[party]?.partyId;
  }

  supplierCertLabel(party: PartyName): string | undefined {
    return this.seed.suppliers[party]?.certLabel;
  }

  originLabel(originId: string): string | undefined {
    return this.runtime.origins[originId];
  }

  addOrigin(originId: string, label: string): void {
    this.runtime.origins[originId] = label;
    this.persist();
  }

  allOrigins(): ReadonlyArray<{ originId: string; label?: string }> {
    return Object.entries(this.runtime.origins).map(([originId, label]) => ({ originId, label }));
  }
}

export const registry = new Registry();
