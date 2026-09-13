// Veilance Party Agent — startup sequence.
//
// Mirrors contract/e2e/run.ts's runFull() setup phase almost exactly (health
// check -> setNetworkId -> build+fund wallets -> ensure DUST -> build
// providers), reusing the same e2e/lib helpers, but as a long-lived process:
// GET /health is served immediately (see index.ts) while this runs in the
// background, and if `agent/.state/deployment.json` already exists it
// reconnects every party to that contract instead of waiting for POST
// /deploy.

import * as ledger from "@midnight-ntwrk/ledger-v8";
import path from "node:path";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

import { createVeilancePrivateState } from "../../contract/src/witnesses.js";
import { generateEncKeypair } from "../../contract/src/sealed-entry.js";
import { checkDevnetHealth, formatHealthReport } from "../../contract/e2e/lib/health.js";
import { checkZkBuild } from "../../contract/e2e/lib/zk.js";
import { buildWallet, ensureDust, fundFromGenesis, waitForSync } from "../../contract/e2e/lib/wallet.js";
import { buildProviders } from "../../contract/e2e/lib/providers.js";

import {
  AGENT_STATE_DIR,
  FUNDING_AMOUNT,
  FUNDER_SEED,
  SHARED_FEE_WALLET,
  NETWORK_ID,
  PARTY_NAMES,
  WALLET_SEEDS,
  type PartyName,
} from "./config.js";
import { appState, type AppParty } from "./appState.js";
import { fromHex, ZERO_HEX_32 } from "./bytes.js";
import { registry } from "./registry.js";
import { findVeilance } from "./contractSetup.js";
import { loadDeployment, loadOrCreatePartyFile } from "./state.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHealthyDevnet = async (): Promise<void> => {
  for (;;) {
    const health = await checkDevnetHealth();
    console.log(formatHealthReport(health));
    if (health.allHealthy) {
      for (const w of health.warnings) console.warn(`WARN ${w}`);
      return;
    }
    appState.boot.step = "waiting for devnet health";
    console.log("Devnet not healthy yet — retrying in 3s...");
    await sleep(3_000);
  }
};

const defaultCertId = (party: PartyName): string => registry.supplierCertId(party) ?? ZERO_HEX_32;

export const bootstrap = async (): Promise<void> => {
  try {
    appState.boot.step = "checking ZK build";
    const zkCheck = checkZkBuild();
    console.log(zkCheck.message);
    if (!zkCheck.ok) {
      appState.boot = { ready: false, step: "ZK build missing", error: zkCheck.message };
      return;
    }

    appState.boot.step = "checking devnet health";
    await waitForHealthyDevnet();

    setNetworkId(NETWORK_ID);

    appState.boot.step = "building wallets";
    // On the local devnet the funder is the genesis wallet. On a public network
    // it is a faucet-funded wallet given via VEILANCE_FUNDER_SEED, or absent —
    // then the party wallets must already hold NIGHT.
    // Build every wallet before waiting on any of them so they sync in parallel:
    // a fresh wallet's first sync on a public network walks millions of blocks,
    // and five sequential syncs would multiply that wait. Wallet state is
    // persisted under AGENT_STATE_DIR/wallets so later boots restore instantly.
    const walletStateDir = path.join(AGENT_STATE_DIR, "wallets");
    const funder = FUNDER_SEED ? await buildWallet("funder", FUNDER_SEED, { stateDir: walletStateDir }) : null;
    const wallets: Record<PartyName, Awaited<ReturnType<typeof buildWallet>>> = {} as never;
    if (SHARED_FEE_WALLET) {
      // One fee-paying wallet for every party (see config.ts SHARED_FEE_WALLET).
      if (!funder) throw new Error("VEILANCE_SHARED_FEE_WALLET=1 requires VEILANCE_FUNDER_SEED");
      appState.boot.step = "syncing the shared fee wallet (a first sync on a public network takes a long time)";
      await waitForSync(funder);
      for (const name of PARTY_NAMES) wallets[name] = funder;
      appState.boot.step = "ensuring DUST on the shared fee wallet";
      await ensureDust(funder);
    } else {
      for (const name of PARTY_NAMES) {
        wallets[name] = await buildWallet(name, WALLET_SEEDS[name], { stateDir: walletStateDir });
      }
      appState.boot.step = "syncing wallets (a first sync on a public network takes a long time)";
      if (funder) await waitForSync(funder);

      appState.boot.step = "funding wallets (if needed)";
      const needsFunding = [];
      for (const name of PARTY_NAMES) {
        const s = await waitForSync(wallets[name]);
        const night = s.unshielded.balances[ledger.unshieldedToken().raw] ?? 0n;
        if (night < FUNDING_AMOUNT / 2n) needsFunding.push(wallets[name]);
        else console.log(`  ${name}: already holds ${night} NIGHT, skipping funding`);
      }
      if (needsFunding.length > 0) {
        if (!funder) {
          throw new Error(
            `${needsFunding.length} party wallet(s) hold less than ${FUNDING_AMOUNT / 2n} NIGHT and no funder wallet is configured (VEILANCE_FUNDER_SEED). Fund them from the network faucet first.`,
          );
        }
        await fundFromGenesis(funder, needsFunding);
      }

      appState.boot.step = "ensuring DUST";
      for (const name of PARTY_NAMES) await ensureDust(wallets[name]);
    }

    appState.boot.step = "building providers and private state";
    for (const name of PARTY_NAMES) {
      const providers = await buildProviders(name, wallets[name], {
        baseStateDir: AGENT_STATE_DIR,
        accountId: `agent-${name}`,
      });

      const file = loadOrCreatePartyFile(name, name === "admin" ? ZERO_HEX_32 : defaultCertId(name));
      if (!file.encPk || !file.encSk) {
        const enc = generateEncKeypair();
        file.encPk = Buffer.from(enc.encPk).toString("hex");
        file.encSk = Buffer.from(enc.encSk).toString("hex");
      }

      // Not written to the private state provider here: deployVeilance() /
      // findVeilance() (contractSetup.ts) pass this as `initialPrivateState`,
      // which the SDK writes for us once the contract address is known —
      // exactly the deployContract/findDeployedContract convention
      // contract/e2e/run.ts follows.
      const privateState = createVeilancePrivateState(fromHex(file.partySecret), fromHex(file.certId));

      const appParty: AppParty = {
        name,
        party: {
          name,
          wallet: wallets[name],
          providers,
          enc: { encPk: fromHex(file.encPk), encSk: fromHex(file.encSk) },
          privateState,
        },
        file,
      };
      appState.parties.set(name, appParty);
      for (const job of file.jobs) appState.registerJob(job);
    }
    console.log("All party wallets funded, DUST-registered, and providers built.");

    appState.boot.step = "reconnecting to deployed contract (if any)";
    const deployment = loadDeployment();
    if (deployment) {
      for (const name of PARTY_NAMES) {
        const appParty = appState.partyOrThrow(name);
        appParty.party.providers.privateStateProvider.setContractAddress(deployment.contractAddress);
        appParty.contract = await findVeilance(appParty.party, deployment.contractAddress);
      }
      appState.contractAddress = deployment.contractAddress;
      console.log(`Reconnected to existing contract at ${deployment.contractAddress}`);
    } else {
      console.log("No agent/.state/deployment.json yet — waiting for POST /deploy.");
    }

    appState.boot = { ready: true, step: "ready" };
    console.log("Party Agent ready.");
  } catch (err) {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error("Bootstrap failed:", message);
    appState.boot = { ready: false, step: "bootstrap failed", error: message };
  }
};
