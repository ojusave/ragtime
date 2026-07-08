/** Human-readable activity feed lines. */

import { stageLabel } from "./copy.js";

type EventRow = {
  type: string;
  payload: Record<string, unknown>;
};

export function formatActivityLine(e: EventRow): string {
  const p = e.payload;
  switch (e.type) {
    case "embed.batch": {
      const r = p.receipt as { costUsd?: number; costUnknown?: boolean } | undefined;
      const cost = r?.costUnknown ? "cost unknown" : `$${Number(r?.costUsd ?? 0).toFixed(4)}`;
      const model = String(p.model ?? "").split("/").pop() ?? "model";
      return `Indexed ${p.embedded} passages with ${model} (${cost})`;
    }
    case "trial.stage":
      return `Finished: ${stageLabel(String(p.stage ?? ""))}`;
    case "trial.retry":
      return `Retrying test (attempt ${p.attempt})`;
    case "trial.failed":
      return `Test failed: ${p.message ?? "see logs"}`;
    case "embed.failed":
      return `Indexing failed: ${p.message ?? "see logs"}`;
    case "chaos.injected":
      return "Simulated error — retrying";
    case "budget.tripped":
      return "Stopped — budget limit reached";
    case "run.status":
      return `Status: ${humanRunStatus(String(p.status ?? ""))}`;
    case "doc.ingested":
      return `Document indexed (${p.chunkCount} passages)`;
    default:
      return "Update";
  }
}

function humanRunStatus(status: string): string {
  const map: Record<string, string> = {
    ingesting: "preparing documents",
    running: "tests running",
    aggregating: "adding up results",
    complete: "complete",
    failed: "failed",
    budget_exceeded: "budget reached",
  };
  return map[status] ?? status.replace(/_/g, " ");
}
