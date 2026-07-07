import { task } from "@renderinc/sdk/workflows";
import { eq, sql } from "drizzle-orm";
import { runTrialPipeline, runConfigSchema } from "@ragtime/core";
import { getDb, schema, addCost, emitEvent } from "@ragtime/db";
import { wirePorts } from "../wiring.js";
import { maybeChaos, ChaosError } from "../lib/chaos.js";

const { runs, trials, questions, combos } = schema;

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

    const trial = await db.query.trials.findFirst({ where: eq(trials.id, trialId) });
    if (!trial) throw new Error(`Trial not found: ${trialId}`);
    if (trial.status === "complete") {
      return { score: trial.overallScore ? Number(trial.overallScore) : null };
    }

    const run = await db.query.runs.findFirst({ where: eq(runs.id, trial.runId) });
    if (!run) throw new Error(`Run not found: ${trial.runId}`);

    if (run.status === "canceled" || run.status === "budget_exceeded") {
      await db.update(trials).set({ status: "skipped", updatedAt: new Date() }).where(eq(trials.id, trialId));
      return { score: null };
    }

    const config = runConfigSchema.parse(run.config);
    const combo = await db.query.combos.findFirst({ where: eq(combos.id, trial.comboId) });
    if (!combo) throw new Error(`Combo not found: ${trial.comboId}`);

    const question = await db.query.questions.findFirst({ where: eq(questions.id, trial.questionId) });
    if (!question) throw new Error(`Question not found: ${trial.questionId}`);

    const prevAttempts = trial.attempts;
    await db
      .update(trials)
      .set({
        status: "running",
        attempts: sql`${trials.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(trials.id, trialId));

    if (prevAttempts > 0) {
      emitEvent(db, trial.runId, "trial.retry", { trialId, attempt: prevAttempts + 1 }, trialId);
    }

    try {
      const result = await runTrialPipeline({
        ports,
        runId: trial.runId,
        corpusId: run.corpusId,
        questionId: trial.questionId,
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
        judgeModel: config.judgeModel ?? process.env.JUDGE_MODEL ?? "openai/gpt-4o-mini",
        judgeWeights: config.judgeWeights,
        existingStages: trial.stages ?? {},
        existingAnswer: trial.answer,
        onCost: (usd) => {
          void addCost(db, trial.runId, usd);
        },
      });

      for (const [stage, data] of Object.entries(result.stages)) {
        emitEvent(db, trial.runId, "trial.stage", { trialId, stage, data }, trialId);
      }

      await db
        .update(trials)
        .set({
          stages: result.stages,
          answer: result.answer,
          overallScore: String(result.overallScore),
          status: "complete",
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(trials.id, trialId));

      return { score: result.overallScore };
    } catch (err) {
      if (err instanceof ChaosError) {
        emitEvent(db, trial.runId, "chaos.injected", { trialId }, trialId);
      }
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(trials)
        .set({ status: "failed", error: message, updatedAt: new Date() })
        .where(eq(trials.id, trialId));
      throw err;
    }
  }
);
