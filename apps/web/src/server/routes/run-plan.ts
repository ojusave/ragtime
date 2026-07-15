import { MAX_EXPLICIT_QUESTIONS, type RunConfig } from "@ragtime/core";

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

/**
 * Converts a parsed request into the immutable question snapshot persisted with a run.
 * `authorizedQuestionIds` must already be restricted to the requested corpus and caller.
 */
export function createRunPlan(
  config: RunConfig,
  authorizedQuestionIds: readonly string[]
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
  const comboCount =
    config.embeddingModels.length *
    config.rerankModels.length *
    config.genModels.length;

  return {
    config: { ...config, questionIds: [...questionIds] },
    comboCount,
    trialCount: comboCount * questionIds.length,
    unavailableQuestionIds,
  };
}

export function getRunPlanRejection(
  plan: RunPlan,
  maxTrials: number
): RunPlanRejection | null {
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
      error: `This matrix would run ${plan.trialCount} trials (max ${maxTrials}). Reduce embedding, rerank, or generation models, or pick fewer questions.`,
    };
  }
  return null;
}
