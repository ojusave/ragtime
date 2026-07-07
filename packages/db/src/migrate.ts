import { sql } from "drizzle-orm";
import { getDb, closeDb } from "./client.js";

export async function migrate(): Promise<void> {
  const db = getDb();
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS corpora (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      description text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      corpus_id uuid NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
      source_type text NOT NULL CHECK (source_type IN ('upload', 'url')),
      title text NOT NULL,
      source_uri text,
      raw_text text,
      status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'ingesting', 'ready', 'failed')),
      error text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chunks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      corpus_id uuid NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
      idx int NOT NULL,
      content text NOT NULL,
      token_estimate int NOT NULL,
      UNIQUE (document_id, idx)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chunk_embeddings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      chunk_id uuid NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
      embedding_model text NOT NULL,
      dims int NOT NULL,
      embedding vector NOT NULL,
      UNIQUE (chunk_id, embedding_model)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS chunk_embeddings_model_idx ON chunk_embeddings (embedding_model)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS query_embeddings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id uuid NOT NULL,
      question_id uuid NOT NULL,
      embedding_model text NOT NULL,
      dims int NOT NULL,
      embedding vector NOT NULL,
      UNIQUE (run_id, question_id, embedding_model)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS questions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      corpus_id uuid NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
      text text NOT NULL,
      reference_answer text NOT NULL,
      origin text NOT NULL DEFAULT 'manual'
        CHECK (origin IN ('manual', 'csv', 'generated')),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      corpus_id uuid NOT NULL REFERENCES corpora(id),
      name text NOT NULL,
      status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'ingesting', 'running', 'aggregating', 'complete',
          'failed', 'canceled', 'budget_exceeded')),
      config jsonb NOT NULL,
      budget_usd numeric NOT NULL,
      total_cost_usd numeric NOT NULL DEFAULT 0,
      started_at timestamptz,
      finished_at timestamptz,
      error text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS combos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      embedding_model text NOT NULL,
      rerank_model text,
      gen_model text NOT NULL,
      retrieve_k int NOT NULL DEFAULT 20,
      final_k int NOT NULL DEFAULT 5,
      relevance_threshold numeric
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS trials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      combo_id uuid NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
      question_id uuid NOT NULL REFERENCES questions(id),
      status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'complete', 'failed', 'skipped')),
      stages jsonb NOT NULL DEFAULT '{}',
      answer text,
      overall_score numeric,
      attempts int NOT NULL DEFAULT 0,
      error text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (combo_id, question_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS run_events (
      id bigserial PRIMARY KEY,
      run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      at timestamptz NOT NULL DEFAULT now(),
      type text NOT NULL,
      entity_id uuid,
      payload jsonb NOT NULL DEFAULT '{}'
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS run_events_run_id_idx ON run_events (run_id, id)
  `);

  await db.execute(sql`
    CREATE OR REPLACE VIEW combo_results AS
    SELECT
      c.id AS combo_id,
      c.run_id,
      c.embedding_model,
      c.rerank_model,
      c.gen_model,
      AVG(t.overall_score::numeric) AS avg_score,
      AVG(
        COALESCE((t.stages->'retrieval'->>'costUsd')::numeric, 0) +
        COALESCE((t.stages->'rerank'->>'costUsd')::numeric, 0) +
        COALESCE((t.stages->'generation'->>'costUsd')::numeric, 0) +
        COALESCE((t.stages->'judge'->>'costUsd')::numeric, 0)
      ) FILTER (WHERE t.status = 'complete') AS avg_cost_per_question,
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY (t.stages->'generation'->>'latencyMs')::numeric
      ) FILTER (WHERE t.status = 'complete') AS p50_generation_latency_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (
        ORDER BY (t.stages->'generation'->>'latencyMs')::numeric
      ) FILTER (WHERE t.status = 'complete') AS p95_generation_latency_ms,
      SUM(
        COALESCE((t.stages->'retrieval'->>'costUsd')::numeric, 0) +
        COALESCE((t.stages->'rerank'->>'costUsd')::numeric, 0) +
        COALESCE((t.stages->'generation'->>'costUsd')::numeric, 0) +
        COALESCE((t.stages->'judge'->>'costUsd')::numeric, 0)
      ) FILTER (WHERE t.status = 'complete') AS total_cost_usd,
      COUNT(*) FILTER (WHERE t.status = 'complete') AS complete_count,
      COUNT(*) FILTER (WHERE t.status = 'failed') AS failed_count
    FROM combos c
    LEFT JOIN trials t ON t.combo_id = c.id
    GROUP BY c.id, c.run_id, c.embedding_model, c.rerank_model, c.gen_model
  `);

  console.log("Migrations applied.");
}

if (process.argv[1]?.includes("migrate")) {
  migrate()
    .then(() => closeDb())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
