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
    /** Max parallel workflow subtasks when embedding a corpus (per model). */
    embedFanoutBatch: envNumber("EMBED_FANOUT_BATCH", 6),
    /** Max parallel run_trial subtasks per wave during a bake-off. */
    trialFanoutBatch: envNumber("TRIAL_FANOUT_BATCH", 8),
    /** Postgres pool size per workflow/web process. Keep low on basic Postgres plans. */
    dbPoolMax: envNumber("DB_POOL_MAX", 3),
    /** Hard cap on trials per bake-off (combos × questions). Protects basic Postgres. */
    maxTrialsPerRun: envNumber("MAX_TRIALS_PER_RUN", 324),
    chaosFailureRate: envNumber("CHAOS_FAILURE_RATE", 0),
    workflowSlug: envString("WORKFLOW_SLUG", "ragtime-workflows"),
  };
}

export type AppConfig = ReturnType<typeof getAppConfig>;
