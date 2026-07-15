import type {
  CostController,
  ModelGateway,
  VectorStore,
  WithReceipt,
} from "../ports.js";
import type { TrialStageRetrieval } from "../schemas.js";
import { runCostedOperation } from "./cost.js";

export type EmbedQueryInput = {
  gateway: ModelGateway;
  vectorStore: VectorStore;
  runId: string;
  questionId: string;
  questionText: string;
  embeddingModel: string;
  /** When false, skip query_embeddings cache (inspector path). Default true. */
  persist?: boolean;
  costController?: CostController;
  operationKey?: string;
  onCost?: (usd: number) => Promise<void>;
};

export async function embedQuery(
  input: EmbedQueryInput
): Promise<{ vector: number[]; receipt: WithReceipt<unknown>["receipt"] | null }> {
  const persist = input.persist !== false;
  if (persist) {
    const cached = await input.vectorStore.getQueryEmbedding(
      input.runId,
      input.questionId,
      input.embeddingModel
    );
    if (cached) return { vector: cached, receipt: null };
  }

  const result = await runCostedOperation({
    controller: input.costController,
    operationKey:
      input.operationKey ??
      `query:${input.runId}:${input.questionId}:${input.embeddingModel}`,
    kind: "query_embedding",
    call: (maxCostUsd) =>
      input.gateway.embed({
        model: input.embeddingModel,
        input: [input.questionText],
        maxCostUsd,
      }),
  });
  await input.onCost?.(result.receipt.costUsd);
  const vector = result.vectors[0]!;
  if (persist) {
    await input.vectorStore.saveQueryEmbedding({
      runId: input.runId,
      questionId: input.questionId,
      embeddingModel: input.embeddingModel,
      vector,
      dims: result.dims,
    });
  }
  return { vector, receipt: result.receipt };
}

export type RetrieveInput = {
  vectorStore: VectorStore;
  corpusId: string;
  embeddingModel: string;
  queryVector: number[];
  retrieveK: number;
};

export async function retrieveCandidates(
  input: RetrieveInput
): Promise<TrialStageRetrieval> {
  const start = Date.now();
  const rows = await input.vectorStore.retrieve({
    corpusId: input.corpusId,
    embeddingModel: input.embeddingModel,
    queryVector: input.queryVector,
    limit: input.retrieveK,
  });
  return {
    chunkIds: rows.map((r) => r.id),
    scores: rows.map((r) => r.score),
    latencyMs: Date.now() - start,
    costUsd: 0,
  };
}

export type EmbedBatchInput = {
  gateway: ModelGateway;
  vectorStore: VectorStore;
  corpusId: string;
  embeddingModel: string;
  chunkIds: string[];
  costController?: CostController;
  operationKey?: string;
  onCost?: (usd: number) => Promise<void>;
};

export async function embedChunkBatch(
  input: EmbedBatchInput
): Promise<{ embedded: number; receipt: WithReceipt<unknown>["receipt"] }> {
  const missing = await input.vectorStore.getMissingChunkIds(
    input.corpusId,
    input.embeddingModel
  );
  const idSet = new Set(input.chunkIds);
  const toEmbed = missing.filter((id) => idSet.has(id));
  if (toEmbed.length === 0) {
    return { embedded: 0, receipt: { latencyMs: 0, costUsd: 0 } };
  }

  const chunkMap = await input.vectorStore.getChunksByIds(toEmbed);
  const ids = toEmbed.filter((id) => chunkMap.has(id));
  const texts = ids.map((id) => chunkMap.get(id)!.content);

  const result = await runCostedOperation({
    controller: input.costController,
    operationKey:
      input.operationKey ??
      `corpus:${input.corpusId}:${input.embeddingModel}:${ids.join(",")}`,
    kind: "corpus_embedding",
    call: (maxCostUsd) =>
      input.gateway.embed({
        model: input.embeddingModel,
        input: texts,
        maxCostUsd,
      }),
  });
  await input.onCost?.(result.receipt.costUsd);

  await input.vectorStore.upsertChunkEmbeddings({
    chunkIds: ids,
    contents: texts,
    embeddingModel: input.embeddingModel,
    vectors: result.vectors,
    dims: result.dims,
  });

  return { embedded: ids.length, receipt: result.receipt };
}
