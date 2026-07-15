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

    // REVIEW C2 (Critical, OpenRouter×Render): read-then-write claim is not atomic. Two
    // Render deliveries or replays of the same trialId can both see 'pending', both flip
    // to 'running', and both run the full paid pipeline — duplicate provider billing with
    // last-writer-wins on the result. The trials_combo_question unique index dedupes rows,
    // not workers. Fix: atomic claim with a token + lease, e.g.
    //   UPDATE trials SET status='running', attempts=attempts+1, claim_token=:token, ...
    //   WHERE id=:trial_id AND (status='pending' OR (status='failed' ...) OR
    //         (status='running' AND lease_expires_at < now()))
    //   RETURNING *;
    // and stop if no row returns. All later writes must carry `AND claim_token = :token`.
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
        // REVIEW C1 (Critical): fire-and-forget cost recording. The pipeline continues
        // (and the task can finish) before the spend lands in the DB, so budget
        // enforcement lags actual billing and DB failures are swallowed. Make onCost
        // async (`(usd) => Promise<void>`) and await it in the pipeline.
        onCost: (usd) => {
          void addCost(db, trial.runId, usd);
        },
      });

      for (const [stage, data] of Object.entries(result.stages)) {
        emitEvent(db, trial.runId, "trial.stage", { trialId, stage, data }, trialId);
      }

      // REVIEW C3 (Critical): stages are only persisted here, after the whole trial
      // succeeds. A judge failure/timeout after a billed generation loses all stage
      // state; the Render retry re-runs (and re-bills) rerank + generation. This breaks
      // the README's "skips completed work on retry (no double billing)" claim. Fix:
      // checkpoint each stage to trials.stages immediately after it completes (guarded by
      // the C2 claim token), persist `answer` right after generation, and only mark
      // complete once all checkpoints exist.
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
