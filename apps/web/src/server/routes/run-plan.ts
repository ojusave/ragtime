import { MAX_EXPLICIT_QUESTIONS, type RunConfig, type Setup } from "@ragtime/core";

const setupKey = (setup: Setup): string =>
  `${setup.embeddingModel}\u0000${setup.rerankModel ?? ""}\u0000${setup.genModel}`;

/** Removes duplicate pipelines while preserving the order the caller supplied. */
function dedupeSetups(setups: readonly Setup[]): Setup[] {
  const seen = new Set<string>();
  const out: Setup[] = [];
  for (const setup of setups) {
    const key = setupKey(setup);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(setup);
  }
  return out;
}

export type SnapshotRunConfig = Omit<RunConfig, "questionIds"> & {
  questionIds: string[];
};

export type RunPlan = {
  config: SnapshotRunConfig;
  comboCount: number;
  trialCount: number;
  unavailableQuestionIds: string[];
};

export type RunPlanRejection = {
  statusCode: 400 | 403;
  error: string;
};

export type RunPlanOptions = {
  /** Env-supplied judge model used when the request omits one. */
  judgeModelFallback?: string;
};

function resolveJudgeModel(
  config: RunConfig,
  options?: RunPlanOptions
): string | undefined {
  const candidate = config.judgeModel ?? options?.judgeModelFallback;
  const trimmed = candidate?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Converts a parsed request into the immutable question snapshot persisted with a run.
 * `authorizedQuestionIds` must already be restricted to the requested corpus and caller.
 */
export function createRunPlan(
  config: RunConfig,
  authorizedQuestionIds: readonly string[],
  options?: RunPlanOptions
): RunPlan {
  const authorized = [...new Set(authorizedQuestionIds)];
  const authorizedSet = new Set(authorized);
  const requested =
    config.questionIds === "all"
      ? authorized
      : [...new Set(config.questionIds)];
  const questionIds = requested.filter((id) => authorizedSet.has(id));
  const unavailableQuestionIds =
    config.questionIds === "all"
      ? []
      : requested.filter((id) => !authorizedSet.has(id));
  const judgeModel = resolveJudgeModel(config, options);

  // Explicit setups win over the cross-product. Normalize the model arrays to the
  // union of the setups so the embed phase (which reads embeddingModels) stays correct.
  const setups =
    config.setups && config.setups.length > 0
      ? dedupeSetups(config.setups)
      : undefined;
  const normalized = setups
    ? {
        embeddingModels: [...new Set(setups.map((s) => s.embeddingModel))],
        rerankModels: [...new Set(setups.map((s) => s.rerankModel))],
        genModels: [...new Set(setups.map((s) => s.genModel))],
      }
    : {
        embeddingModels: config.embeddingModels,
        rerankModels: config.rerankModels,
        genModels: config.genModels,
      };
  const comboCount = setups
    ? setups.length
    : normalized.embeddingModels.length *
      normalized.rerankModels.length *
      normalized.genModels.length;

  return {
    config: {
      ...config,
      ...normalized,
      setups,
      judgeModel,
      questionIds: [...questionIds],
    },
    comboCount,
    trialCount: comboCount * questionIds.length,
    unavailableQuestionIds,
  };
}

export function getRunPlanRejection(
  plan: RunPlan,
  maxTrials: number
): RunPlanRejection | null {
  if (!plan.config.judgeModel) {
    return {
      statusCode: 400,
      error:
        "No judge model configured. Set JUDGE_MODEL or include judgeModel in the run request.",
    };
  }
  if (plan.unavailableQuestionIds.length > 0) {
    return {
      statusCode: 403,
      error: "One or more questions are not available.",
    };
  }
  if (plan.config.questionIds.length === 0) {
    return {
      statusCode: 400,
      error: "No questions are available for this run.",
    };
  }
  if (plan.config.questionIds.length > MAX_EXPLICIT_QUESTIONS) {
    return {
      statusCode: 400,
      error: `Runs support at most ${MAX_EXPLICIT_QUESTIONS} questions.`,
    };
  }
  if (plan.trialCount > maxTrials) {
    return {
      statusCode: 400,
      error: `This run would produce ${plan.trialCount} answers (max ${maxTrials}). Remove a setup or pick fewer questions.`,
    };
  }
  return null;
}
