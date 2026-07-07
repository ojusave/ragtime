import { sql, eq, inArray } from "drizzle-orm";
import type { ComboResult } from "@ragtime/core";
import type { Db } from "./client.js";
import { chunks, combos, runs } from "./schema.js";

export async function getComboResults(db: Db, runId: string): Promise<ComboResult[]> {
  const run = await db.query.runs.findFirst({
    where: eq(runs.id, runId),
    columns: { config: true },
  });
  const judgeModel =
    run?.config && typeof run.config === "object" && "judgeModel" in run.config
      ? (run.config as { judgeModel?: string }).judgeModel
      : undefined;

  const rows = await db.execute<{
    combo_id: string;
    embedding_model: string;
    rerank_model: string | null;
    gen_model: string;
    avg_score: string | null;
    avg_cost_per_question: string | null;
    p50_generation_latency_ms: string | null;
    p95_generation_latency_ms: string | null;
    total_cost_usd: string | null;
    complete_count: string;
    failed_count: string;
  }>(sql`
    SELECT * FROM combo_results WHERE run_id = ${runId}
  `);

  return rows.map((r) => ({
    comboId: r.combo_id,
    embeddingModel: r.embedding_model,
    rerankModel: r.rerank_model,
    genModel: r.gen_model,
    avgScore: r.avg_score ? Number(r.avg_score) : null,
    avgCostPerQuestion: r.avg_cost_per_question
      ? Number(r.avg_cost_per_question)
      : null,
    p50GenerationLatencyMs: r.p50_generation_latency_ms
      ? Number(r.p50_generation_latency_ms)
      : null,
    p95GenerationLatencyMs: r.p95_generation_latency_ms
      ? Number(r.p95_generation_latency_ms)
      : null,
    totalCostUsd: r.total_cost_usd ? Number(r.total_cost_usd) : null,
    completeCount: Number(r.complete_count),
    failedCount: Number(r.failed_count),
    selfJudged: Boolean(judgeModel && r.gen_model === judgeModel),
  }));
}

export async function getMissingChunkIdsForModel(
  db: Db,
  corpusId: string,
  model: string
): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT c.id FROM chunks c
    WHERE c.corpus_id = ${corpusId}
    AND NOT EXISTS (
      SELECT 1 FROM chunk_embeddings ce
      WHERE ce.chunk_id = c.id AND ce.embedding_model = ${model}
    )
  `);
  return rows.map((r) => r.id);
}

export async function cosineRetrieve(
  db: Db,
  params: {
    corpusId: string;
    embeddingModel: string;
    queryVector: number[];
    limit: number;
  }
): Promise<{ id: string; content: string; score: number }[]> {
  const vec = `[${params.queryVector.join(",")}]`;
  const rows = await db.execute<{ id: string; content: string; score: string }>(sql`
    SELECT c.id, c.content, 1 - (ce.embedding <=> ${vec}::vector) AS score
    FROM chunk_embeddings ce
    JOIN chunks c ON c.id = ce.chunk_id
    WHERE ce.embedding_model = ${params.embeddingModel}
      AND c.corpus_id = ${params.corpusId}
    ORDER BY ce.embedding <=> ${vec}::vector
    LIMIT ${params.limit}
  `);
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    score: Number(r.score),
  }));
}

export async function getChunksByIds(
  db: Db,
  chunkIds: string[]
): Promise<Map<string, { id: string; idx: number; content: string }>> {
  if (chunkIds.length === 0) return new Map();
  const rows = await db
    .select({ id: chunks.id, idx: chunks.idx, content: chunks.content })
    .from(chunks)
    .where(inArray(chunks.id, chunkIds));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function getComboById(db: Db, comboId: string) {
  return db.query.combos.findFirst({ where: eq(combos.id, comboId) });
}
