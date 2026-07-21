import { randomUUID } from "node:crypto";
import { task } from "@renderinc/sdk/workflows";
import { and, eq, inArray } from "drizzle-orm";
import {
  CostOperationError,
  getAppConfig,
  runTrialPipeline,
  runConfigSchema,
  safePersistedError,
} from "@ragtime/core";
import {
  BudgetReservationError,
  claimTrial,
  checkpointTrialStage,
  createRunCostController,
  emitEvent,
  getDb,
  getRunStatus,
  schema,
} from "@ragtime/db";
import { wirePorts } from "../wiring.js";
import { maybeChaos, ChaosError } from "../lib/chaos.js";

const { runs, trials, questions, combos } = schema;
export const TRIAL_LEASE_MS = 300_000;
export const MAX_TRIAL_ATTEMPTS = 4;

export const runTrial = task(
  {
    name: "run_trial",
    plan: "standard",
    timeoutSeconds: 300,
    retry: { maxRetries: 3, waitDurationMs: 5000, backoffScaling: 2 },
  },
  async function runTrial(trialId: string): Promise<{ score: number | null }> {
    maybeChaos();
    const db = getDb();
    const ports = wirePorts();

    const initial = await db.query.trials.findFirst({
      where: eq(trials.id, trialId),
    });
    if (!initial) throw new Error(`Trial not found: ${trialId}`);
    if (initial.status === "complete") {
      return {
        score:
          initial.overallScore != null ? Number(initial.overallScore) : null,
      };
    }

    const run = await db.query.runs.findFirst({
      where: eq(runs.id, initial.runId),
    });
    if (!run) throw new Error(`Run not found: ${initial.runId}`);
    if (run.status === "canceled" || run.status === "budget_exceeded") {
      await db
        .update(trials)
        .set({ status: "skipped", updatedAt: new Date() })
        .where(and(eq(trials.id, trialId), eq(trials.status, "pending")));
      return { score: null };
    }

    const config = runConfigSchema.parse(run.config);
    if (
      config.questionIds === "all" ||
      !config.questionIds.includes(initial.questionId)
    ) {
      await db
        .update(trials)
        .set({ status: "skipped", updatedAt: new Date() })
        .where(
          and(
            eq(trials.id, trialId),
            inArray(trials.status, ["pending", "failed"])
          )
      );
      return { score: null };
    }
    const combo = await db.query.combos.findFirst({
      where: eq(combos.id, initial.comboId),
    });
    if (!combo) throw new Error(`Combo not found: ${initial.comboId}`);
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, initial.questionId),
    });
    if (!question) throw new Error(`Question not found: ${initial.questionId}`);

    const claimToken = randomUUID();
    const claimed = await claimTrial({
      db,
      trialId,
      claimToken,
      leaseMs: TRIAL_LEASE_MS,
      maxAttempts: MAX_TRIAL_ATTEMPTS,
    });
    if (!claimed) {
      const current = await db.query.trials.findFirst({
        where: eq(trials.id, trialId),
      });
      return {
        score:
          current?.status === "complete" && current.overallScore != null
            ? Number(current.overallScore)
            : null,
      };
    }

    if (claimed.attempts > 1) {
      emitEvent(
        db,
        claimed.runId,
        "trial.retry",
        { trialId, attempt: claimed.attempts },
        trialId
      );
    }

    const { maxProviderCallUsd } = getAppConfig();
    const costController = createRunCostController(
      db,
      claimed.runId,
      maxProviderCallUsd
    );

    try {
      const result = await runTrialPipeline({
        ports,
        runId: claimed.runId,
        corpusId: run.corpusId,
        questionId: claimed.questionId,
        questionText: question.text,
        referenceAnswer: question.referenceAnswer,
        embeddingModel: combo.embeddingModel,
        rerankModel: combo.rerankModel,
        genModel: combo.genModel,
        retrieveK: combo.retrieveK,
        finalK: combo.finalK,
        relevanceThreshold: combo.relevanceThreshold
          ? Number(combo.relevanceThreshold)
          : null,
        // Guaranteed at run creation (createRunPlan rejects runs without one).
        judgeModel: config.judgeModel!,
        judgeWeights: config.judgeWeights,
        existingStages: claimed.stages ?? {},
        existingAnswer: claimed.answer,
        costController,
        operationPrefix: `trial:${trialId}`,
        onStageComplete: async (stage, value, answer) => {
          const saved = await checkpointTrialStage({
            db,
            trialId,
            claimToken,
            stage,
            value,
            answer,
            leaseMs: TRIAL_LEASE_MS,
          });
          if (!saved) throw new Error(`Trial claim lost: ${trialId}`);
          emitEvent(
            db,
            claimed.runId,
            "trial.stage",
            { trialId, stage, data: value },
            trialId
          );
        },
      });

      const [completed] = await db
        .update(trials)
        .set({
          stages: result.stages,
          answer: result.answer,
          overallScore: String(result.overallScore),
          status: "complete",
          claimToken: null,
          leaseExpiresAt: null,
          error: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trials.id, trialId),
            eq(trials.claimToken, claimToken),
            eq(trials.status, "running")
          )
        )
        .returning({ id: trials.id });
      if (!completed) throw new Error(`Trial claim lost: ${trialId}`);
      return { score: result.overallScore };
    } catch (err) {
      if (err instanceof ChaosError) {
        emitEvent(db, claimed.runId, "chaos.injected", { trialId }, trialId);
      }
      const runStatus =
        err instanceof BudgetReservationError
          ? err.runStatus
          : await getRunStatus(db, claimed.runId);
      const status =
        runStatus === "canceled" || runStatus === "budget_exceeded"
          ? "skipped"
          : "failed";
      const nonRetryableCostFailure =
        err instanceof CostOperationError ||
        (err instanceof BudgetReservationError && !err.retryable);
      const message = safePersistedError(err, "Trial failed");
      await db
        .update(trials)
        .set({
          status,
          attempts: nonRetryableCostFailure
            ? MAX_TRIAL_ATTEMPTS
            : undefined,
          claimToken: null,
          leaseExpiresAt: null,
          error: message.slice(0, 1000),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trials.id, trialId),
            eq(trials.claimToken, claimToken),
            eq(trials.status, "running")
          )
        );
      throw err;
    }
  }
);
