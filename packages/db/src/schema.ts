import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
  uniqueIndex,
  index,
  check,
  customType,
  bigserial,
} from "drizzle-orm/pg-core";
import type { RunConfig, TrialStages } from "@ragtime/core";

/** Untyped pgvector column: different embedding models have different dimensions. */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    const trimmed = value.replace(/^\[/, "").replace(/\]$/, "");
    if (!trimmed) return [];
    return trimmed.split(",").map(Number);
  },
});

export const corpora = pgTable("corpora", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    title: text("title").notNull(),
    sourceUri: text("source_uri"),
    rawText: text("raw_text"),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("documents_source_type_check", sql`${t.sourceType} IN ('upload', 'url')`),
    check(
      "documents_status_check",
      sql`${t.status} IN ('pending', 'ingesting', 'ready', 'failed')`
    ),
  ]
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    content: text("content").notNull(),
    tokenEstimate: integer("token_estimate").notNull(),
  },
  (t) => [uniqueIndex("chunks_document_idx").on(t.documentId, t.idx)]
);

export const chunkEmbeddings = pgTable(
  "chunk_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => chunks.id, { onDelete: "cascade" }),
    embeddingModel: text("embedding_model").notNull(),
    dims: integer("dims").notNull(),
    embedding: vector("embedding").notNull(),
  },
  (t) => [
    uniqueIndex("chunk_embeddings_chunk_model").on(t.chunkId, t.embeddingModel),
    index("chunk_embeddings_model_idx").on(t.embeddingModel),
  ]
);

export const queryEmbeddings = pgTable(
  "query_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull(),
    questionId: uuid("question_id").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    dims: integer("dims").notNull(),
    embedding: vector("embedding").notNull(),
  },
  (t) => [
    uniqueIndex("query_embeddings_run_question_model").on(
      t.runId,
      t.questionId,
      t.embeddingModel
    ),
  ]
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id, { onDelete: "cascade" }),
    sessionId: text("session_id"),
    text: text("text").notNull(),
    referenceAnswer: text("reference_answer").notNull(),
    origin: text("origin").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("questions_origin_check", sql`${t.origin} IN ('manual', 'csv', 'generated')`),
    index("questions_session_corpus_idx").on(t.sessionId, t.corpusId),
  ]
);

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    corpusId: uuid("corpus_id")
      .notNull()
      .references(() => corpora.id),
    sessionId: text("session_id"),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    config: jsonb("config").$type<RunConfig>().notNull(),
    budgetUsd: numeric("budget_usd", { precision: 12, scale: 6 }).notNull(),
    totalCostUsd: numeric("total_cost_usd", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "runs_status_check",
      sql`${t.status} IN ('draft', 'ingesting', 'running', 'aggregating', 'complete', 'failed', 'canceled', 'budget_exceeded')`
    ),
    index("runs_session_id_idx").on(t.sessionId),
  ]
);

export const combos = pgTable("combos", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  embeddingModel: text("embedding_model").notNull(),
  rerankModel: text("rerank_model"),
  genModel: text("gen_model").notNull(),
  retrieveK: integer("retrieve_k").notNull().default(20),
  finalK: integer("final_k").notNull().default(5),
  relevanceThreshold: numeric("relevance_threshold", { precision: 6, scale: 4 }),
});

export const trials = pgTable(
  "trials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    comboId: uuid("combo_id")
      .notNull()
      .references(() => combos.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    status: text("status").notNull().default("pending"),
    stages: jsonb("stages").$type<TrialStages>().notNull().default({}),
    answer: text("answer"),
    overallScore: numeric("overall_score", { precision: 6, scale: 3 }),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trials_combo_question").on(t.comboId, t.questionId),
    check(
      "trials_status_check",
      sql`${t.status} IN ('pending', 'running', 'complete', 'failed', 'skipped')`
    ),
  ]
);

export const runEvents = pgTable(
  "run_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    type: text("type").notNull(),
    entityId: uuid("entity_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("run_events_run_id_idx").on(t.runId, t.id)]
);

export type Corpus = typeof corpora.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Combo = typeof combos.$inferSelect;
export type Trial = typeof trials.$inferSelect;
