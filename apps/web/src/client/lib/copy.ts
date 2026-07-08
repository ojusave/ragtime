/** User-facing copy and status labels (single vocabulary). */

export const APP_NAME = "RAGtime";

export const RUN_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ingesting: "Preparing documents",
  running: "Running evaluations",
  aggregating: "Summarizing results",
  complete: "Complete",
  failed: "Failed",
  canceled: "Canceled",
  budget_exceeded: "Stopped: budget limit",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  ingesting: "Indexing",
  ready: "Ready",
  failed: "Failed",
};

export const TRIAL_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  running: "In progress",
  complete: "Complete",
  failed: "Failed",
  skipped: "Skipped",
};

export function formatMatrixSummary(args: {
  embedCount: number;
  rerankCount: number;
  genCount: number;
  questionCount: number;
  budgetUsd: number;
  maxTrials: number;
}): { line: string; trialCount: number; overLimit: boolean } {
  const stacks = args.embedCount * args.rerankCount * args.genCount;
  const trialCount = stacks * args.questionCount;
  const overLimit = trialCount > args.maxTrials;
  const line = `${stacks} model stack${stacks === 1 ? "" : "s"} × ${args.questionCount} question${args.questionCount === 1 ? "" : "s"} = ${trialCount} evaluation${trialCount === 1 ? "" : "s"}. Max spend: $${args.budgetUsd.toFixed(2)}. Platform limit: ${args.maxTrials} evaluations per run.`;
  return { line, trialCount, overLimit };
}

export function friendlyError(raw: string): string {
  const msg = raw.trim();
  if (!msg || msg === "Unknown error") {
    return "Something went wrong. Try a smaller model matrix or check Render service logs.";
  }
  if (msg.includes("ECONNREFUSED") || msg.includes("CONNECT_TIMEOUT") || msg.includes("5432")) {
    return "The database is temporarily unavailable. Wait a minute and try again.";
  }
  if (msg.includes("403") || msg.includes("forbidden") || msg.includes("RENDER_API_KEY")) {
    return "Could not start the workflow. Check RENDER_API_KEY on the web service.";
  }
  if (msg.includes("402") || msg.includes("Insufficient credits")) {
    return "OpenRouter credits are insufficient. Add credits at openrouter.ai/settings/credits.";
  }
  if (msg.includes("matrix would run") || msg.includes("max ")) {
    return msg;
  }
  if (msg.includes("Not found")) {
    return "That item was not found. It may have been deleted.";
  }
  return msg;
}
