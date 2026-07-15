/** Serializable port contracts. Adapters live in separate packages. */

export type Receipt = {
  latencyMs: number;
  costUsd: number;
  costUnknown?: boolean;
  tokens?: { input?: number; output?: number };
  provider?: string;
  generationId?: string;
};

export type WithReceipt<T> = T & { receipt: Receipt };

export type Msg = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ModelInfo = {
  id: string;
  name: string;
  contextLength?: number;
  pricing?: { prompt?: string; completion?: string; request?: string };
};

export interface ModelGateway {
  chat(req: {
    model: string;
    messages: Msg[];
    jsonSchema?: Record<string, unknown>;
    maxTokens?: number;
    /** Adapter-enforced upper bound for this provider request. */
    maxCostUsd?: number;
  }): Promise<WithReceipt<{ text: string }>>;

  embed(req: {
    model: string;
    input: string[];
    /** Adapter-enforced upper bound for this provider request. */
    maxCostUsd?: number;
  }): Promise<WithReceipt<{ vectors: number[][]; dims: number }>>;

  rerank(req: {
    model: string;
    query: string;
    documents: string[];
    topN: number;
    /** Adapter-enforced upper bound for this provider request. */
    maxCostUsd?: number;
  }): Promise<WithReceipt<{ results: { index: number; relevance: number }[] }>>;

  catalog(): Promise<{
    embedding: ModelInfo[];
    rerank: ModelInfo[];
    chat: ModelInfo[];
  }>;
}

export type CostOperationKind =
  | "corpus_embedding"
  | "query_embedding"
  | "rerank"
  | "generation"
  | "judge";

/** Durable, idempotent budget control supplied by the workflow boundary. */
export interface CostController {
  reserve(
    operationKey: string,
    kind: CostOperationKind
  ): Promise<{ maxCostUsd: number }>;
  settle(operationKey: string, actualUsd: number): Promise<void>;
}

export type ChunkRecord = {
  idx: number;
  content: string;
  tokenEstimate: number;
};

export type RetrievedChunk = {
  id: string;
  content: string;
  score: number;
  idx: number;
};

export interface VectorStore {
  deleteAndInsertChunks(
    documentId: string,
    corpusId: string,
    chunks: ChunkRecord[]
  ): Promise<void>;

  getMissingChunkIds(corpusId: string, embeddingModel: string): Promise<string[]>;

  upsertChunkEmbeddings(args: {
    chunkIds: string[];
    contents: string[];
    embeddingModel: string;
    vectors: number[][];
    dims: number;
  }): Promise<number>;

  getQueryEmbedding(
    runId: string,
    questionId: string,
    embeddingModel: string
  ): Promise<number[] | null>;

  saveQueryEmbedding(args: {
    runId: string;
    questionId: string;
    embeddingModel: string;
    vector: number[];
    dims: number;
  }): Promise<void>;

  retrieve(args: {
    corpusId: string;
    embeddingModel: string;
    queryVector: number[];
    limit: number;
  }): Promise<RetrievedChunk[]>;

  getChunksByIds(
    chunkIds: string[]
  ): Promise<Map<string, { id: string; idx: number; content: string }>>;
}

export interface Extractor {
  extract(args: {
    sourceType: "upload" | "url";
    rawText?: string | null;
    sourceUri?: string | null;
  }): Promise<string>;
}

export interface Chunker {
  chunk(text: string): Promise<ChunkRecord[]>;
}

export type JudgeResult = {
  faithfulness: number;
  correctness: number;
  completeness: number;
  rationale: string;
};

export type ScorerInput = {
  gateway: ModelGateway;
  judgeModel: string;
  context: string;
  question: string;
  referenceAnswer: string;
  candidate: string;
  costController?: CostController;
  operationPrefix?: string;
};

export interface Scorer {
  score(input: ScorerInput): Promise<WithReceipt<JudgeResult>>;
}

export type PipelinePorts = {
  gateway: ModelGateway;
  vectorStore: VectorStore;
  extractor: Extractor;
  chunker: Chunker;
  scorer: Scorer;
};
