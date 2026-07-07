import { task } from "@renderinc/sdk/workflows";
import { eq, sql } from "drizzle-orm";
import { extractAndChunk, embedChunkBatch as pipelineEmbedBatch } from "@ragtime/core";
import { getDb, schema, addCost, emitEvent, getMissingChunkIdsForModel } from "@ragtime/db";
import { getAppConfig } from "@ragtime/core";
import { wirePorts } from "../wiring.js";
import { maybeChaos, chunkIntoBatches } from "../lib/chaos.js";

const { documents, chunks } = schema;

export const ingestDocument = task(
  {
    name: "ingest_document",
    plan: "standard",
    timeoutSeconds: 300,
    retry: { maxRetries: 3, waitDurationMs: 3000, backoffScaling: 2 },
  },
  async function ingestDocument(args: { documentId: string; runId?: string }): Promise<{ chunkCount: number }> {
    const documentId = args.documentId;
    const db = getDb();
    const ports = wirePorts();
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
    if (!doc) throw new Error(`Document not found: ${documentId}`);

    if (doc.status === "ready") {
      const rows = await db.select().from(chunks).where(eq(chunks.documentId, documentId));
      return { chunkCount: rows.length };
    }

    await db.update(documents).set({ status: "ingesting", error: null }).where(eq(documents.id, documentId));

    try {
      const { text, chunks: parts } = await extractAndChunk({
        extractor: ports.extractor,
        chunker: ports.chunker,
        sourceType: doc.sourceType as "upload" | "url",
        rawText: doc.rawText,
        sourceUri: doc.sourceUri,
      });

      await ports.vectorStore.deleteAndInsertChunks(documentId, doc.corpusId, parts);
      await db.update(documents).set({ status: "ready", rawText: text, error: null }).where(eq(documents.id, documentId));
      if (args.runId) {
        emitEvent(db, args.runId, "doc.ingested", { documentId, chunkCount: parts.length }, documentId);
      }
      return { chunkCount: parts.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.update(documents).set({ status: "failed", error: message }).where(eq(documents.id, documentId));
      throw err;
    }
  }
);

export const embedChunkBatch = task(
  {
    name: "embed_chunk_batch",
    plan: "starter",
    timeoutSeconds: 120,
    retry: { maxRetries: 5, waitDurationMs: 2000, backoffScaling: 2 },
  },
  async function embedChunkBatch(args: {
    runId: string;
    corpusId: string;
    model: string;
    chunkIds: string[];
  }): Promise<{ embedded: number }> {
    maybeChaos();
    const db = getDb();
    const ports = wirePorts();

    const result = await pipelineEmbedBatch({
      gateway: ports.gateway,
      vectorStore: ports.vectorStore,
      corpusId: args.corpusId,
      embeddingModel: args.model,
      chunkIds: args.chunkIds,
      onCost: (usd) => {
        void addCost(db, args.runId, usd);
      },
    });

    emitEvent(db, args.runId, "embed.batch", {
      model: args.model,
      embedded: result.embedded,
      receipt: result.receipt,
    });

    return { embedded: result.embedded };
  }
);

export const embedCorpus = task(
  {
    name: "embed_corpus",
    plan: "standard",
    timeoutSeconds: 600,
    retry: { maxRetries: 2, waitDurationMs: 5000, backoffScaling: 2 },
  },
  async function embedCorpus(args: {
    runId: string;
    corpusId: string;
    model: string;
  }): Promise<{ batches: number }> {
    const db = getDb();
    const { embedBatchSize } = getAppConfig();
    const missing = await getMissingChunkIdsForModel(db, args.corpusId, args.model);
    const batches = chunkIntoBatches(missing, embedBatchSize);
    await Promise.all(
      batches.map((ids) =>
        embedChunkBatch({
          runId: args.runId,
          corpusId: args.corpusId,
          model: args.model,
          chunkIds: ids,
        })
      )
    );
    return { batches: batches.length };
  }
);
