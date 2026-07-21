import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { getDb, schema, seedCorpus, SCIFACT_CORPUS } from "@ragtime/db";
import { asSessionRequest } from "../types.js";

const { corpora, documents, questions } = schema;
const SCIFACT_NAME = SCIFACT_CORPUS.corpusName;

function allowDemoSeed(): boolean {
  return process.env.ALLOW_DEMO_SEED !== "false";
}

export function registerDemoRoutes(app: FastifyInstance): void {
  const db = getDb();

  app.post("/api/seed-demo", async (_req, reply) => {
    if (!allowDemoSeed()) {
      return reply.status(403).send({ error: "Demo seeding is disabled on this deployment." });
    }
    const corpusId = await seedCorpus(db, SCIFACT_CORPUS);
    return { data: { corpusId, name: SCIFACT_NAME } };
  });

  app.get("/api/demo", async () => {
    const corpus = await db.query.corpora.findFirst({
      where: eq(corpora.name, SCIFACT_NAME),
    });
    if (!corpus) {
      return { data: { ready: false, corpusId: null, documentCount: 0, questionCount: 0 } };
    }
    const docs = await db
      .select({ status: documents.status })
      .from(documents)
      .where(eq(documents.corpusId, corpus.id));
    const qs = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.corpusId, corpus.id), isNull(questions.sessionId)));
    const readyDocs = docs.filter((d) => d.status === "ready").length;
    return {
      data: {
        ready: docs.length > 0 && qs.length > 0,
        corpusId: corpus.id,
        documentCount: docs.length,
        readyDocumentCount: readyDocs,
        questionCount: qs.length,
        name: corpus.name,
      },
    };
  });

  app.get("/api/samples", async () => {
    const corpus = await db.query.corpora.findFirst({
      where: eq(corpora.name, SCIFACT_NAME),
    });
    if (!corpus) return { data: [] };
    const rows = await db
      .select({
        id: questions.id,
        text: questions.text,
        referenceAnswer: questions.referenceAnswer,
      })
      .from(questions)
      .where(and(eq(questions.corpusId, corpus.id), isNull(questions.sessionId)))
      .limit(8);
    return { data: rows };
  });

  app.post<{ Body: { text: string; referenceAnswer?: string | null } }>(
    "/api/questions",
    async (req, reply) => {
      const { sessionId } = asSessionRequest(req);
      const text = req.body?.text?.trim();
      if (!text) return reply.status(400).send({ error: "text required" });

      const corpus = await db.query.corpora.findFirst({
        where: eq(corpora.name, SCIFACT_NAME),
      });
      if (!corpus) {
        return reply.status(404).send({ error: "Demo corpus not found. Load sample data first." });
      }

      // No reference answer means the judge will not score correctness.
      const referenceAnswer = req.body.referenceAnswer?.trim() || null;
      const [row] = await db
        .insert(questions)
        .values({
          corpusId: corpus.id,
          sessionId,
          text,
          referenceAnswer,
          origin: "manual",
        })
        .returning();

      return { data: row };
    }
  );
}
