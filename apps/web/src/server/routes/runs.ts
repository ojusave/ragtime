import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  runConfigSchema,
  getAppConfig,
  envNumber,
  comboLabel,
} from "@ragtime/core";
import {
  getDb,
  schema,
  getComboResults,
  listRunEvents,
  getPhaseCounters,
  getChunksByIds,
} from "@ragtime/db";
import { getRenderClient } from "../lib/render-client.js";
import { getOwnedRun } from "../lib/ownership.js";
import { asSessionRequest } from "../types.js";

const { questions, runs, combos, trials } = schema;

const ACTIVE = new Set(["ingesting", "running", "aggregating"]);

export function registerRunRoutes(app: FastifyInstance): void {
  const db = getDb();
  const config = getAppConfig();

  app.post("/api/runs", async (req, reply) => {
    const { sessionId } = asSessionRequest(req);
    const parsed = runConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const body = parsed.data;
    const maxBudget = envNumber("MAX_RUN_BUDGET_USD", 5);
    const budgetUsd = Math.min(body.budgetUsd ?? maxBudget, maxBudget);

    if (body.questionIds !== "all") {
      const allowed = await db
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            eq(questions.corpusId, body.corpusId),
            inArray(questions.id, body.questionIds),
            or(isNull(questions.sessionId), eq(questions.sessionId, sessionId))
          )
        );
      if (allowed.length !== body.questionIds.length) {
        return reply.status(403).send({ error: "One or more questions are not available." });
      }
    }

    // REVIEW M8 (Medium): no idempotency key — a client retry after a timeout creates a
    // second run and a second workflow. Accept an Idempotency-Key, store
    // (session_id, key) -> run_id uniquely, and return the existing run on conflict.
    // REVIEW M9 (Medium): the combo product is built and inserted before the trial-limit
    // check below; oversized/duplicate model arrays cause writes then delete-rollback.
    // Cap and dedupe arrays in the schema, and compute trialCount before any insert.
    const [run] = await db
      .insert(runs)
      .values({
        corpusId: body.corpusId,
        sessionId,
        name: body.name,
        status: "draft",
        config: body,
        budgetUsd: String(budgetUsd),
      })
      .returning();

    const comboRows = [];
    for (const emb of body.embeddingModels) {
      for (const rer of body.rerankModels) {
        for (const gen of body.genModels) {
          comboRows.push({
            runId: run!.id,
            embeddingModel: emb,
            rerankModel: rer,
            genModel: gen,
            retrieveK: body.retrieveK,
            finalK: body.finalK,
            relevanceThreshold:
              body.relevanceThreshold != null ? String(body.relevanceThreshold) : null,
          });
        }
      }
    }
    if (comboRows.length > 0) {
      await db.insert(combos).values(comboRows);
    }

    let questionCount: number;
    if (body.questionIds === "all") {
      const qs = await db
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            eq(questions.corpusId, body.corpusId),
            or(isNull(questions.sessionId), eq(questions.sessionId, sessionId))
          )
        );
      questionCount = qs.length;
    } else {
      questionCount = body.questionIds.length;
    }

    const trialCount = comboRows.length * questionCount;
    const maxTrials = envNumber("MAX_TRIALS_PER_RUN", 324);
    if (trialCount > maxTrials) {
      await db.delete(combos).where(eq(combos.runId, run!.id));
      await db.delete(runs).where(eq(runs.id, run!.id));
      return reply.status(400).send({
        error: `This matrix would run ${trialCount} trials (max ${maxTrials}). Reduce embedding, rerank, or generation models, or pick fewer questions.`,
      });
    }

    try {
      const render = getRenderClient();
      await render.workflows.startTask(`${config.workflowSlug}/run_bakeoff`, [run!.id]);
    } catch (err) {
      await db
        .update(runs)
        .set({
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        })
        .where(eq(runs.id, run!.id));
      // REVIEW M4 (Medium): raw upstream error messages are persisted and returned to
      // the anonymous caller; they can carry internal diagnostics. Map to a safe public
      // message and log the details server-side.
      return reply.status(502).send({
        error:
          err instanceof Error
            ? err.message
            : "Failed to start workflow. Check RENDER_API_KEY and WORKFLOW_SLUG on the web service.",
      });
    }

    return { data: { runId: run!.id } };
  });

  app.get<{ Params: { id: string } }>("/api/runs/:id", async (req, reply) => {
    const { sessionId } = asSessionRequest(req);
    const run = await getOwnedRun(db, req.params.id, sessionId);
    if (!run) return reply.status(404).send({ error: "Not found" });

    const comboResults = await getComboResults(db, req.params.id);
    const grid = await db
      .select({
        trialId: trials.id,
        comboId: trials.comboId,
        questionId: trials.questionId,
        status: trials.status,
        overallScore: trials.overallScore,
        attempts: trials.attempts,
      })
      .from(trials)
      .where(eq(trials.runId, req.params.id));

    const questionIds = [...new Set(grid.map((g) => g.questionId))];
    const questionRows =
      questionIds.length > 0
        ? await db
            .select({ id: questions.id, text: questions.text })
            .from(questions)
            .where(inArray(questions.id, questionIds))
        : [];

    const phases = await getPhaseCounters(db, req.params.id, run.corpusId);

    return {
      data: {
        run,
        phases,
        comboResults: comboResults.map((c) => ({
          ...c,
          label: comboLabel(c.embeddingModel, c.rerankModel, c.genModel),
        })),
        grid,
        questions: questionRows,
      },
    };
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>(
    "/api/runs/:id/events",
    async (req, reply) => {
      const { sessionId } = asSessionRequest(req);
      const run = await getOwnedRun(db, req.params.id, sessionId);
      if (!run) return reply.status(404).send({ error: "Not found" });

      const after = Number(req.query.after ?? 0);
      const rows = await listRunEvents(db, req.params.id, after);
      return {
        data: rows.map((r) => ({
          id: Number(r.id),
          runId: r.run_id,
          at: r.at,
          type: r.type,
          entityId: r.entity_id,
          payload: r.payload,
        })),
      };
    }
  );

  app.post<{ Params: { id: string } }>("/api/runs/:id/cancel", async (req, reply) => {
    const { sessionId } = asSessionRequest(req);
    const run = await getOwnedRun(db, req.params.id, sessionId);
    if (!run) return reply.status(404).send({ error: "Not found" });

    // REVIEW C4 (Critical): cancel only flips the DB flag — in-flight ingest/embed/trial
    // tasks keep running and spending, and the orchestrator's unconditional status
    // writes later overwrite 'canceled' with 'running'/'complete'. Make orchestrator
    // transitions conditional on non-terminal status, propagate cancellation into the
    // pipeline (abort signal / Render task cancel), and make this endpoint idempotent
    // (return the existing terminal state instead of overwriting it).
    await db
      .update(runs)
      .set({ status: "canceled", finishedAt: new Date() })
      .where(eq(runs.id, req.params.id));
    return { data: { canceled: true } };
  });
}

export { ACTIVE };
