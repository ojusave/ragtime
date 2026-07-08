/** Human-readable activity feed lines (no raw event-type badges in prose). */

type EventRow = {
  type: string;
  payload: Record<string, unknown>;
};

export function formatActivityLine(e: EventRow): string {
  const p = e.payload;
  switch (e.type) {
    case "embed.batch": {
      const r = p.receipt as { costUsd?: number; costUnknown?: boolean } | undefined;
      const cost = r?.costUnknown ? "cost n/a" : `$${Number(r?.costUsd ?? 0).toFixed(4)}`;
      const model = String(p.model ?? "").split("/").pop() ?? "model";
      return `Embedded ${p.embedded} chunks with ${model} (${cost})`;
    }
    case "trial.stage":
      return `Finished ${p.stage} for an evaluation`;
    case "trial.retry":
      return `Retrying evaluation (attempt ${p.attempt})`;
    case "trial.failed":
      return `Evaluation failed: ${p.message ?? "see logs"}`;
    case "embed.failed":
      return `Embedding batch failed: ${p.message ?? "see logs"}`;
    case "chaos.injected":
      return "Simulated failure (chaos mode): retrying";
    case "budget.tripped":
      return "Run stopped: budget limit reached";
    case "run.status":
      return `Run update: ${humanRunStatus(String(p.status ?? ""))}`;
    case "doc.ingested":
      return `Indexed document (${p.chunkCount} chunks)`;
    default:
      return "System update";
  }
}

function humanRunStatus(status: string): string {
  const map: Record<string, string> = {
    ingesting: "preparing documents",
    running: "evaluations in progress",
    aggregating: "summarizing results",
    complete: "complete",
    failed: "failed",
    budget_exceeded: "budget limit reached",
  };
  return map[status] ?? status.replace(/_/g, " ");
}
