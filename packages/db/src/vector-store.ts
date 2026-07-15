import { eq, inArray, sql } from "drizzle-orm";
import type { VectorStore } from "@ragtime/core";
import type { Db } from "./client.js";
import { chunks, chunkEmbeddings } from "./schema.js";

/** pgvector adapter implementing VectorStore. */
export function createPgVectorStore(db: Db): VectorStore {
  return {
    async deleteAndInsertChunks(documentId, corpusId, chunkRecords) {
      // REVIEW M6 (Medium): delete and insert run as separate statements — a failure in
      // between leaves the document with zero chunks, and concurrent ingestions can
      // delete each other's inserts. Run both in one transaction (ideally together with
      // the document status update in the caller).
      await db.delete(chunks).where(eq(chunks.documentId, documentId));
      if (chunkRecords.length === 0) return;
      await db.insert(chunks).values(
        chunkRecords.map((c) => ({
          documentId,
          corpusId,
          idx: c.idx,
          content: c.content,
          tokenEstimate: c.tokenEstimate,
        }))
      );
    },

    async getMissingChunkIds(corpusId, embeddingModel) {
      const rows = await db.execute<{ id: string }>(sql`
        SELECT c.id FROM chunks c
        WHERE c.corpus_id = ${corpusId}
        AND NOT EXISTS (
          SELECT 1 FROM chunk_embeddings ce
          WHERE ce.chunk_id = c.id AND ce.embedding_model = ${embeddingModel}
        )
      `);
      return rows.map((r) => r.id);
    },

    async upsertChunkEmbeddings(args) {
      let count = 0;
      for (let i = 0; i < args.chunkIds.length; i++) {
        const id = args.chunkIds[i]!;
        const vec = args.vectors[i];
        if (!vec) continue;
        await db.execute(sql`
          INSERT INTO chunk_embeddings (chunk_id, embedding_model, dims, embedding)
          VALUES (${id}, ${args.embeddingModel}, ${args.dims}, ${`[${vec.join(",")}]`}::vector)
          ON CONFLICT (chunk_id, embedding_model) DO NOTHING
        `);
        count++;
      }
      return count;
    },

    async getQueryEmbedding(runId, questionId, embeddingModel) {
      const rows = await db.execute<{ embedding: string }>(sql`
        SELECT embedding::text AS embedding FROM query_embeddings
        WHERE run_id = ${runId} AND question_id = ${questionId}
          AND embedding_model = ${embeddingModel}
      `);
      if (!rows[0]) return null;
      return parseVector(rows[0].embedding);
    },

    async saveQueryEmbedding(args) {
      await db.execute(sql`
        INSERT INTO query_embeddings (run_id, question_id, embedding_model, dims, embedding)
        VALUES (${args.runId}, ${args.questionId}, ${args.embeddingModel},
          ${args.dims}, ${`[${args.vector.join(",")}]`}::vector)
        ON CONFLICT (run_id, question_id, embedding_model) DO NOTHING
      `);
    },

    async retrieve(args) {
      const vec = `[${args.queryVector.join(",")}]`;
      const rows = await db.execute<{
        id: string;
        content: string;
        idx: number;
        score: string;
      }>(sql`
        SELECT c.id, c.content, c.idx, 1 - (ce.embedding <=> ${vec}::vector) AS score
        FROM chunk_embeddings ce
        JOIN chunks c ON c.id = ce.chunk_id
        WHERE ce.embedding_model = ${args.embeddingModel}
          AND c.corpus_id = ${args.corpusId}
        ORDER BY ce.embedding <=> ${vec}::vector
        LIMIT ${args.limit}
      `);
      return rows.map((r) => ({
        id: r.id,
        content: r.content,
        idx: r.idx,
        score: Number(r.score),
      }));
    },

    async getChunksByIds(chunkIds) {
      if (chunkIds.length === 0) return new Map();
      const rows = await db
        .select({ id: chunks.id, idx: chunks.idx, content: chunks.content })
        .from(chunks)
        .where(inArray(chunks.id, chunkIds));
      return new Map(rows.map((r) => [r.id, r]));
    },
  };
}

function parseVector(text: string): number[] {
  const trimmed = text.replace(/^\[/, "").replace(/\]$/, "");
  if (!trimmed) return [];
  return trimmed.split(",").map(Number);
}
