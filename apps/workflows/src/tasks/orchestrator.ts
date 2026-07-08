import { task } from "@renderinc/sdk/workflows";
import { eq, sql } from "drizzle-orm";
import {
  runConfigSchema,
  QUESTION_GEN_SYSTEM,
  buildQuestionGenUserPrompt,
} from "@ragtime/core";
import { getAppConfig } from "@ragtime/core";
import { getDb, schema, emitEvent } from "@ragtime/db";
import { wirePorts } from "../wiring.js";
import { runInWaves } from "../lib/fanout.js";
import { ingestDocument, embedCorpus } from "./ingest.js";
import { runTrial } from "./trial.js";

const { runs, documents, trials, combos, questions, chunks } = schema;

export const aggregateRun = task(
  {
    name: "aggregate_run",
    plan: "starter",
    timeoutSeconds: 120,
    retry: { maxRetries: 2, waitDurationMs: 3000, backoffScaling: 2 },
  },
  async function aggregateRun(runId: string): Promise<{ totalCostUsd: number }> {
    const db = getDb();
    const rows = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(
        COALESCE((t.stages->'retrieval'->>'costUsd')::numeric, 0) +
        COALESCE((t.stages->'rerank'->>'costUsd')::numeric, 0) +
        COALESCE((t.stages->'generation'->>'costUsd')::numeric, 0) +
        COALESCE((t.stages->'judge'->>'costUsd')::numeric, 0)
      ), 0) AS total
      FROM trials t WHERE run_id = ${runId}
    `);
    const total = Number(rows[0]?.total ?? 0);
    await db.update(runs).set({ totalCostUsd: String(total), finishedAt: new Date() }).where(eq(runs.id, runId));
    return { totalCostUsd: total };
  }
);

export const generateQuestions = task(
  {
    name: "generate_questions",
    plan: "starter",
    timeoutSeconds: 120,
    retry: { maxRetries: 2, waitDurationMs: 3000, backoffScaling: 2 },
  },
  async function generateQuestions(args: { corpusId: string; n: number; model: string }) {
    const db = getDb();
    const { gateway } = wirePorts();
    const allChunks = await db.select().from(chunks).where(eq(chunks.corpusId, args.corpusId));
    if (allChunks.length === 0) throw new Error("No chunks in corpus");

    const step = Math.max(1, Math.floor(allChunks.length / args.n));
    const samples = allChunks.filter((_, i) => i % step === 0).slice(0, args.n).map((c, i) => ({
      title: `Chunk ${i + 1}`,
      excerpt: c.content.slice(0, 800),
    }));

    const { text } = await gateway.chat({
      model: args.model,
      messages: [
        { role: "system", content: QUESTION_GEN_SYSTEM },
        { role: "user", content: buildQuestionGenUserPrompt(samples, args.n) },
      ],
    });

    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
      questions?: { text: string; referenceAnswer: string }[];
    };

    let created = 0;
    for (const q of parsed.questions ?? []) {
      await db.insert(questions).values({
        corpusId: args.corpusId,
        text: q.text,
        referenceAnswer: q.referenceAnswer,
        origin: "generated",
      });
      created++;
    }
    return { created };
  }
);

export const runBakeoff = task(
  {
    name: "run_bakeoff",
    plan: "standard",
    timeoutSeconds: 3600,
    retry: { maxRetries: 1, waitDurationMs: 10000, backoffScaling: 2 },
  },
  async function runBakeoff(runId: string): Promise<{ status: string }> {
    const db = getDb();
    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    if (!run) throw new Error(`Run not found: ${runId}`);

    const config = runConfigSchema.parse(run.config);
    emitEvent(db, runId, "run.status", { status: "ingesting" });
    await db.update(runs).set({ status: "ingesting", startedAt: new Date(), error: null }).where(eq(runs.id, runId));

    const pendingDocs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(sql`${documents.corpusId} = ${run.corpusId} AND ${documents.status} != 'ready'`);

    const ingestResults = await Promise.allSettled(
      pendingDocs.map((d) => ingestDocument({ documentId: d.id, runId }))
    );
    if (ingestResults.some((r) => r.status === "rejected")) {
      await db.update(runs).set({ status: "failed", error: "Document ingestion failed" }).where(eq(runs.id, runId));
      throw new Error("Document ingestion failed");
    }

    const embedModels = [...new Set(config.embeddingModels)];
    await Promise.all(
      embedModels.map((model) => embedCorpus({ runId, corpusId: run.corpusId, model }))
    );

    let questionIds = config.questionIds;
    if (questionIds === "all") {
      const qs = await db.select({ id: questions.id }).from(questions).where(eq(questions.corpusId, run.corpusId));
      questionIds = qs.map((q) => q.id);
    }

    const runCombos = await db.select().from(combos).where(eq(combos.runId, runId));
    for (const combo of runCombos) {
      for (const qid of questionIds) {
        await db.execute(sql`
          INSERT INTO trials (run_id, combo_id, question_id, status, stages)
          VALUES (${runId}, ${combo.id}, ${qid}, 'pending', '{}')
          ON CONFLICT (combo_id, question_id) DO NOTHING
        `);
      }
    }

    emitEvent(db, runId, "run.status", { status: "running" });
    await db.update(runs).set({ status: "running" }).where(eq(runs.id, runId));

    const pendingTrials = await db
      .select({ id: trials.id })
      .from(trials)
      .where(sql`${trials.runId} = ${runId} AND ${trials.status} NOT IN ('complete', 'skipped')`);

    const { trialFanoutBatch } = getAppConfig();
    await runInWaves(pendingTrials, trialFanoutBatch, (t) => runTrial(t.id));

    const incomplete = await db
      .select({ id: trials.id, status: trials.status })
      .from(trials)
      .where(sql`${trials.runId} = ${runId} AND ${trials.status} NOT IN ('complete', 'skipped')`);

    if (incomplete.length > 0) {
      const failed = incomplete.filter((t) => t.status === "failed").length;
      const stuck = incomplete.length - failed;
      const message = `Bake-off incomplete: ${failed} failed, ${stuck} pending/running trials`;
      await db.update(runs).set({ status: "failed", error: message }).where(eq(runs.id, runId));
      emitEvent(db, runId, "run.status", { status: "failed", error: message });
      throw new Error(message);
    }

    const updated = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    if (updated?.status === "budget_exceeded") {
      emitEvent(db, runId, "budget.tripped", {});
      await aggregateRun(runId);
      return { status: "budget_exceeded" };
    }

    emitEvent(db, runId, "run.status", { status: "aggregating" });
    await db.update(runs).set({ status: "aggregating" }).where(eq(runs.id, runId));
    await aggregateRun(runId);
    await db.update(runs).set({ status: "complete" }).where(eq(runs.id, runId));
    emitEvent(db, runId, "run.status", { status: "complete" });

    return { status: "complete" };
  }
);
