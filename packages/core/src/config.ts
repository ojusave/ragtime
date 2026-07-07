/** Runtime config from environment. No model slugs here. */

export function envString(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${key}`);
}

export function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`Invalid number for ${key}: ${raw}`);
  return n;
}

export function getAppConfig() {
  return {
    appUrl: envString("APP_URL", "http://localhost:5173"),
    openRouterAppTitle: envString("OPENROUTER_APP_TITLE", "RAGtime"),
    judgeModel: process.env.JUDGE_MODEL ?? "",
    maxRunBudgetUsd: envNumber("MAX_RUN_BUDGET_USD", 5),
    embedBatchSize: envNumber("EMBED_BATCH_SIZE", 64),
    chaosFailureRate: envNumber("CHAOS_FAILURE_RATE", 0),
    workflowSlug: envString("WORKFLOW_SLUG", "ragtime-workflows"),
  };
}

export type AppConfig = ReturnType<typeof getAppConfig>;
