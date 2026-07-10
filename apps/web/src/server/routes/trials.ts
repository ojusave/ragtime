import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { getDb, schema, getChunksByIds } from "@ragtime/db";
import { getOwnedTrial } from "../lib/ownership.js";
import { asSessionRequest } from "../types.js";

const { combos, questions } = schema;

export function registerTrialRoutes(app: FastifyInstance): void {
  const db = getDb();

  app.get<{ Params: { id: string } }>("/api/trials/:id", async (req, reply) => {
    const { sessionId } = asSessionRequest(req);
    const owned = await getOwnedTrial(db, req.params.id, sessionId);
    if (!owned) return reply.status(404).send({ error: "Not found" });

    const { trial } = owned;
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
}
