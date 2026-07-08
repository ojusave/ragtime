import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import { Render } from "@renderinc/sdk";
import { eq, desc, sql } from "drizzle-orm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import {
  runConfigSchema,
  getAppConfig,
  envNumber,
  comboLabel,
} from "@ragtime/core";
import { getDb, schema, getComboResults, listRunEvents, getPhaseCounters, getChunksByIds } from "@ragtime/db";
import { createGateway } from "./wiring.js";
import { registerInspectRoutes } from "./inspect.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { corpora, documents, questions, runs, combos, trials } = schema;

let catalogCache: { data: unknown; expires: number } | null = null;

function getRenderClient(): Render {
  const baseUrl = process.env.RENDER_API_URL;
  const token = process.env.RENDER_API_KEY;
  if (!token) {
    throw new Error(
      "RENDER_API_KEY is not set. Add a Render API key to the web service to trigger workflows."
    );
  }
  return new Render({ baseUrl, token });
}

export async function buildServer() {
  const app = Fastify({ logger: true });
  const db = getDb();
  const config = getAppConfig();

  await app.register(fastifyMultipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  app.get("/healthz", async () => ({ ok: true }));

  app.get("/api/config", async () => ({
    data: {
      maxTrialsPerRun: envNumber("MAX_TRIALS_PER_RUN", 324),
      maxRunBudgetUsd: envNumber("MAX_RUN_BUDGET_USD", 5),
    },
  }));

  app.get("/api/corpora", async () => {
    const rows = await db.select().from(corpora).orderBy(desc(corpora.createdAt));
    return { data: rows };
  });

  app.post<{ Body: { name: string; description?: string } }>(
    "/api/corpora",
    async (req, reply) => {
      const name = req.body?.name?.trim();
      if (!name) return reply.status(400).send({ error: "name required" });
      const [row] = await db
        .insert(corpora)
        .values({ name, description: req.body.description })
        .returning();
      return { data: row };
    }
  );

  app.get<{ Params: { id: string } }>("/api/corpora/:id", async (req, reply) => {
    const corpus = await db.query.corpora.findFirst({
      where: eq(corpora.id, req.params.id),
    });
    if (!corpus) return reply.status(404).send({ error: "Not found" });
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.corpusId, req.params.id));
    const qs = await db
      .select()
      .from(questions)
      .where(eq(questions.corpusId, req.params.id));
    return { data: { corpus, documents: docs, questions: qs } };
  });

  app.get<{ Params: { id: string } }>("/api/corpora/:id/runs", async (req, reply) => {
    const corpus = await db.query.corpora.findFirst({
      where: eq(corpora.id, req.params.id),
    });
    if (!corpus) return reply.status(404).send({ error: "Not found" });
    const rows = await db
      .select({
        id: runs.id,
        name: runs.name,
        status: runs.status,
        totalCostUsd: runs.totalCostUsd,
        budgetUsd: runs.budgetUsd,
        createdAt: runs.createdAt,
        finishedAt: runs.finishedAt,
      })
      .from(runs)
      .where(eq(runs.corpusId, req.params.id))
      .orderBy(desc(runs.createdAt))
      .limit(20);
    return { data: rows };
  });

  app.post<{ Params: { id: string } }>(
    "/api/corpora/:id/documents",
    async (req, reply) => {
      const corpusId = req.params.id;
      const contentType = req.headers["content-type"] ?? "";

      if (contentType.includes("application/json")) {
        const body = req.body as { url?: string; title?: string };
        if (!body?.url) return reply.status(400).send({ error: "url required" });
        const [row] = await db
          .insert(documents)
          .values({
            corpusId,
            sourceType: "url",
            title: body.title ?? body.url,
            sourceUri: body.url,
            status: "pending",
          })
          .returning();
        return { data: row };
      }

      const file = await req.file();
      if (!file) return reply.status(400).send({ error: "file required" });
      const buf = await file.toBuffer();
      const text = buf.toString("utf-8");
      const [row] = await db
        .insert(documents)
        .values({
          corpusId,
          sourceType: "upload",
          title: file.filename,
          sourceUri: file.filename,
          rawText: text,
          status: "pending",
        })
        .returning();
      return { data: row };
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/corpora/:id/questions",
    async (req, reply) => {
      const corpusId = req.params.id;
      const contentType = req.headers["content-type"] ?? "";
      let items: { text: string; referenceAnswer: string }[] = [];

      if (contentType.includes("text/csv")) {
        const file = await req.file();
        if (!file) return reply.status(400).send({ error: "CSV file required" });
        const csv = (await file.toBuffer()).toString("utf-8");
        const parsed = Papa.parse<{ question: string; reference_answer: string }>(
          csv,
          { header: true, skipEmptyLines: true }
        );
        items = parsed.data.map((r) => ({
          text: r.question,
          referenceAnswer: r.reference_answer,
        }));
      } else {
        const body = req.body as
          | { text: string; referenceAnswer: string }
          | { text: string; referenceAnswer: string }[];
        items = Array.isArray(body) ? body : [body];
      }

      const created = [];
      for (const q of items) {
        if (!q?.text || !q?.referenceAnswer) continue;
        const [row] = await db
          .insert(questions)
          .values({
            corpusId,
            text: q.text,
            referenceAnswer: q.referenceAnswer,
            origin: contentType.includes("csv") ? "csv" : "manual",
          })
          .returning();
        created.push(row);
      }
      return { data: created };
    }
  );

  app.post<{ Params: { id: string }; Body: { n: number; model?: string } }>(
    "/api/corpora/:id/questions/generate",
    async (req, reply) => {
      const n = req.body?.n ?? 5;
      const model = req.body?.model ?? process.env.JUDGE_MODEL ?? "openai/gpt-4o-mini";
      const render = getRenderClient();
      const slug = config.workflowSlug;
      await render.workflows.startTask(`${slug}/generate_questions`, [
        { corpusId: req.params.id, n, model },
      ]);
      return { data: { started: true } };
    }
  );

  app.get("/api/models", async () => {
    if (catalogCache && catalogCache.expires > Date.now()) {
      return { data: catalogCache.data };
    }
    const gateway = createGateway();
    const data = await gateway.catalog();
    catalogCache = { data, expires: Date.now() + 10 * 60 * 1000 };
    return { data };
  });

  registerInspectRoutes(app);

  app.post("/api/runs", async (req, reply) => {
    const parsed = runConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const body = parsed.data;
    const maxBudget = envNumber("MAX_RUN_BUDGET_USD", 5);
    const budgetUsd = Math.min(body.budgetUsd ?? maxBudget, maxBudget);

    const [run] = await db
      .insert(runs)
      .values({
        corpusId: body.corpusId,
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
              body.relevanceThreshold != null
                ? String(body.relevanceThreshold)
                : null,
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
        .where(eq(questions.corpusId, body.corpusId));
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
      await render.workflows.startTask(`${config.workflowSlug}/run_bakeoff`, [
        run!.id,
      ]);
    } catch (err) {
      await db
        .update(runs)
        .set({ status: "failed", error: err instanceof Error ? err.message : String(err) })
        .where(eq(runs.id, run!.id));
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
    const run = await db.query.runs.findFirst({
      where: eq(runs.id, req.params.id),
    });
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

    const questionRows = await db
      .select({ id: questions.id, text: questions.text })
      .from(questions)
      .where(eq(questions.corpusId, run.corpusId));

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
    async (req) => {
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

  app.get<{ Params: { id: string } }>("/api/trials/:id", async (req, reply) => {
    const trial = await db.query.trials.findFirst({
      where: eq(trials.id, req.params.id),
    });
    if (!trial) return reply.status(404).send({ error: "Not found" });
    const combo = await db.query.combos.findFirst({
      where: eq(combos.id, trial.comboId),
    });
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, trial.questionId),
    });
    const stages = trial.stages as {
      retrieval?: { chunkIds: string[] };
      rerank?: { keptChunkIds: string[] };
    };
    const chunkIds = [
      ...(stages.retrieval?.chunkIds ?? []),
      ...(stages.rerank?.keptChunkIds ?? []),
    ];
    const uniqueIds = [...new Set(chunkIds)];
    const chunkMap = await getChunksByIds(db, uniqueIds);
    return {
      data: {
        trial,
        combo,
        question,
        chunks: [...chunkMap.values()],
      },
    };
  });

  app.post<{ Params: { id: string } }>("/api/runs/:id/cancel", async (req) => {
    await db
      .update(runs)
      .set({ status: "canceled", finishedAt: new Date() })
      .where(eq(runs.id, req.params.id));
    return { data: { canceled: true } };
  });

  const clientDist = path.join(__dirname, "../../dist/client");
  await app.register(fastifyStatic, {
    root: clientDist,
    prefix: "/",
  });

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });

  return app;
}

export async function startServer() {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });
}

const isMain =
  process.argv[1]?.endsWith("index.js") ||
  process.argv[1]?.endsWith("index.ts");

if (isMain) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
