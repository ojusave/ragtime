import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  embedQuery,
  retrieveCandidates,
  rerankCandidates,
  topKByScore,
  generateAnswer,
  judgeAnswer,
} from "@ragtime/core";
import { wirePorts } from "./wiring.js";

export const inspectConfigSchema = z.object({
  corpusId: z.string().uuid(),
  query: z.string().min(1),
  embeddingModel: z.string(),
  rerankModel: z.string().nullable(),
  genModel: z.string(),
  retrieveK: z.number().int().min(1).default(20),
  finalK: z.number().int().min(1).default(5),
  relevanceThreshold: z.number().min(0).max(1).optional(),
  judgeModel: z.string().optional(),
});

type InspectSession = {
  config: z.infer<typeof inspectConfigSchema>;
};

const sessions = new Map<string, InspectSession>();

export function registerInspectRoutes(app: FastifyInstance) {
  app.post("/api/inspect", async (req, reply) => {
    const parsed = inspectConfigSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const inspectId = randomUUID();
    sessions.set(inspectId, { config: parsed.data });
    return { data: { inspectId } };
  });

  app.get<{ Params: { id: string } }>("/api/inspect/:id/stream", async (req, reply) => {
    const session = sessions.get(req.params.id);
    if (!session) return reply.status(404).send({ error: "Not found" });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const ports = wirePorts();
    const cfg = session.config;
    let totalCost = 0;
    let totalLatency = 0;

    try {
      const embed = await embedQuery({
        gateway: ports.gateway,
        vectorStore: ports.vectorStore,
        runId: "inspect",
        questionId: "inspect-q",
        questionText: cfg.query,
        embeddingModel: cfg.embeddingModel,
        persist: false,
        onCost: (usd) => {
          totalCost += usd;
        },
      });
      if (embed.receipt) {
        totalLatency += embed.receipt.latencyMs;
        send("stage", { stage: "embed", data: { dims: embed.vector.length }, receipt: embed.receipt });
      }

      const retrieval = await retrieveCandidates({
        vectorStore: ports.vectorStore,
        corpusId: cfg.corpusId,
        embeddingModel: cfg.embeddingModel,
        queryVector: embed.vector,
        retrieveK: cfg.retrieveK,
      });
      const retrievedChunks = await ports.vectorStore.getChunksByIds(retrieval.chunkIds);
      send("stage", {
        stage: "retrieve",
        data: {
          ...retrieval,
          chunks: retrieval.chunkIds.map((id, i) => ({
            id,
            idx: retrievedChunks.get(id)?.idx,
            content: retrievedChunks.get(id)?.content ?? "",
            score: retrieval.scores[i],
          })),
        },
        receipt: { latencyMs: retrieval.latencyMs, costUsd: 0 },
      });
      totalLatency += retrieval.latencyMs;

      let keptIds = topKByScore(retrieval.chunkIds, retrieval.scores, cfg.finalK);
      if (cfg.rerankModel) {
        const chunkMap = await ports.vectorStore.getChunksByIds(retrieval.chunkIds);
        const docs = retrieval.chunkIds.map((id) => chunkMap.get(id)?.content ?? "");
        const { stage, keptChunkIds } = await rerankCandidates({
          gateway: ports.gateway,
          rerankModel: cfg.rerankModel,
          query: cfg.query,
          chunkIds: retrieval.chunkIds,
          chunkContents: docs,
          finalK: cfg.finalK,
          relevanceThreshold: cfg.relevanceThreshold,
          onCost: (usd) => {
            totalCost += usd;
          },
        });
        keptIds = keptChunkIds;
        totalLatency += stage.latencyMs;
        totalCost += stage.costUsd;
        send("stage", { stage: "rerank", data: stage, receipt: stage });
      } else {
        send("stage", { stage: "rerank", data: { skipped: true }, receipt: { latencyMs: 0, costUsd: 0 } });
      }

      const chunkMap = await ports.vectorStore.getChunksByIds(keptIds);
      const gen = await generateAnswer({
        gateway: ports.gateway,
        genModel: cfg.genModel,
        question: cfg.query,
        keptChunkIds: keptIds,
        chunkMap,
        onCost: (usd) => {
          totalCost += usd;
        },
      });
      totalLatency += gen.stage.latencyMs;
      totalCost += gen.stage.costUsd;
      send("stage", { stage: "generate", data: { answer: gen.answer, ...gen.stage }, receipt: gen.stage });

      const judgeModel = cfg.judgeModel ?? process.env.JUDGE_MODEL;
      if (judgeModel) {
        const context = keptIds.map((id) => chunkMap.get(id)?.content ?? "").join("\n\n");
        const judge = await judgeAnswer({
          scorer: ports.scorer,
          gateway: ports.gateway,
          judgeModel,
          context,
          question: cfg.query,
          referenceAnswer: "",
          candidate: gen.answer,
          onCost: (usd) => {
            totalCost += usd;
          },
        });
        totalLatency += judge.latencyMs;
        totalCost += judge.costUsd;
        send("stage", { stage: "judge", data: judge, receipt: judge });
      } else {
        send("stage", {
          stage: "judge",
          data: { skipped: true, reason: "Set JUDGE_MODEL or judgeModel in request" },
          receipt: { latencyMs: 0, costUsd: 0 },
        });
      }

      send("done", { totalCostUsd: totalCost, totalLatencyMs: totalLatency });
    } catch (err) {
      send("error", { message: err instanceof Error ? err.message : String(err) });
    } finally {
      sessions.delete(req.params.id);
      reply.raw.end();
    }
  });
}
