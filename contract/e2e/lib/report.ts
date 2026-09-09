// Veilance e2e — timing collection and report writing (report.json / REPORT.md).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPORT_JSON_PATH, REPORT_MD_PATH } from "./config.js";

export type CircuitCallRecord = {
  readonly circuit: string;
  readonly party: string;
  /** Wall-clock time for the WHOLE call: build + prove + balance + submit + finalize. */
  readonly totalMs: number;
  /**
   * Wall-clock time spent inside the proof provider specifically, when the
   * SDK's `callTx` exposes that split. `undefined` when only a total is
   * available (see run.ts — this generation's high-level `callTx` does not
   * expose a separate proving timestamp, so this is populated only where
   * the low-level build/prove/balance/submit pipeline is used directly).
   */
  readonly provingMs?: number;
  readonly txHash?: string;
  readonly txId?: string;
  readonly blockHeight?: number;
  readonly ok: boolean;
  readonly error?: string;
};

export type LedgerSnapshot = {
  readonly adminId: string;
  readonly policyVersion: string;
  readonly carbonThreshold: string;
  readonly provenanceLeafCount: string;
  readonly nullifierCount: string;
  readonly attestationCount: string;
  readonly encKeyCount: string;
  readonly inboxCount: string;
};

export class Report {
  readonly startedAt = new Date().toISOString();
  readonly calls: CircuitCallRecord[] = [];
  contractAddress: string | undefined;
  deployTxHash: string | undefined;
  deployBlockHeight: number | undefined;
  attackResult: { readonly rejected: boolean; readonly message?: string } | undefined;
  finalLedger: LedgerSnapshot | undefined;
  expectationsMet: Record<string, boolean> | undefined;

  record(entry: CircuitCallRecord): void {
    this.calls.push(entry);
  }

  /** Times an async circuit call and records the result, re-throwing on failure. */
  async time<T>(
    circuit: string,
    party: string,
    fn: () => Promise<T>,
    extract?: (result: T) => { txHash?: string; txId?: string; blockHeight?: number },
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const extra = extract?.(result) ?? {};
      this.record({ circuit, party, totalMs: Date.now() - start, ok: true, ...extra });
      return result;
    } catch (err) {
      this.record({
        circuit,
        party,
        totalMs: Date.now() - start,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  toJSON() {
    return {
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      contractAddress: this.contractAddress,
      deployTxHash: this.deployTxHash,
      deployBlockHeight: this.deployBlockHeight,
      calls: this.calls,
      attackResult: this.attackResult,
      finalLedger: this.finalLedger,
      expectationsMet: this.expectationsMet,
    };
  }

  toMarkdown(): string {
    const lines: string[] = [];
    lines.push("# Veilance e2e report");
    lines.push("");
    lines.push(`Started: ${this.startedAt}`);
    lines.push(`Contract address: ${this.contractAddress ?? "(not deployed)"}`);
    lines.push(`Deploy tx: ${this.deployTxHash ?? "-"} (block ${this.deployBlockHeight ?? "-"})`);
    lines.push("");
    lines.push("## Per-circuit timing");
    lines.push("");
    lines.push("| circuit | party | total ms | proving ms | tx hash | block | ok |");
    lines.push("|---|---|---:|---:|---|---:|---|");
    for (const c of this.calls) {
      lines.push(
        `| ${c.circuit} | ${c.party} | ${c.totalMs} | ${c.provingMs ?? "-"} | ${c.txHash ?? "-"} | ${
          c.blockHeight ?? "-"
        } | ${c.ok ? "OK" : `FAIL: ${c.error}`} |`,
      );
    }
    lines.push("");
    lines.push("## Attack — replayed transferProvenance");
    lines.push("");
    if (this.attackResult) {
      lines.push(
        this.attackResult.rejected
          ? `REJECTED as expected: ${this.attackResult.message ?? ""}`
          : "NOT REJECTED — this is a security regression.",
      );
    } else {
      lines.push("(not run)");
    }
    lines.push("");
    lines.push("## Final ledger snapshot");
    lines.push("");
    if (this.finalLedger) {
      for (const [k, v] of Object.entries(this.finalLedger)) {
        lines.push(`- ${k}: ${v}`);
      }
    } else {
      lines.push("(not captured)");
    }
    lines.push("");
    lines.push("## Expectations");
    lines.push("");
    if (this.expectationsMet) {
      for (const [k, v] of Object.entries(this.expectationsMet)) {
        lines.push(`- [${v ? "x" : " "}] ${k}`);
      }
    } else {
      lines.push("(not checked)");
    }
    lines.push("");
    return lines.join("\n");
  }

  write(): void {
    mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true });
    writeFileSync(REPORT_JSON_PATH, JSON.stringify(this.toJSON(), null, 2));
    writeFileSync(REPORT_MD_PATH, this.toMarkdown());
  }
}
