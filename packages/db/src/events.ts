import { sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { runEvents } from "./schema.js";

export type RunEventType =
  | "run.status"
  | "doc.ingested"
  | "embed.batch"
  | "trial.stage"
  | "trial.retry"
  | "chaos.injected"
  | "budget.tripped";

/** Fire-and-forget event append. Never throws to caller. */
export function emitEvent(
  db: Db,
  runId: string,
  type: RunEventType,
  payload: Record<string, unknown> = {},
  entityId?: string
): void {
  void db
    .insert(runEvents)
    .values({
      runId,
      type,
      entityId: entityId ?? null,
      payload,
    })
    .catch((err) => {
      console.error("emitEvent failed", { runId, type, err });
    });
}

/** Awaited event append for state transitions and other required audit events. */
export async function appendRunEvent(
  db: Db,
  runId: string,
  type: RunEventType,
  payload: Record<string, unknown> = {},
  entityId?: string
): Promise<void> {
  await db.insert(runEvents).values({
    runId,
    type,
    entityId: entityId ?? null,
    payload,
  });
}

export async function listRunEvents(
  db: Db,
  runId: string,
  afterId: number,
  limit = 200
) {
  return db.execute<{
    id: string;
    run_id: string;
    at: string;
    type: string;
    entity_id: string | null;
    payload: Record<string, unknown>;
  }>(sql`
    SELECT e.id, e.run_id, e.at, e.type, e.entity_id, e.payload
    FROM run_events e
    WHERE e.run_id = ${runId}
      AND e.id > ${afterId}
      AND (
        e.type NOT IN ('trial.stage', 'trial.retry', 'chaos.injected')
        OR EXISTS (
          SELECT 1
          FROM trials t
          JOIN runs r ON r.id = t.run_id
          WHERE t.id = e.entity_id
            AND t.run_id = e.run_id
            AND jsonb_typeof(r.config->'questionIds') = 'array'
            AND (r.config->'questionIds') ? t.question_id::text
        )
      )
    ORDER BY e.id ASC
    LIMIT ${limit}
  `);
}

export async function getPhaseCounters(db: Db, runId: string, corpusId: string) {
  const docs = await db.execute<{ total: string; ready: string }>(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'ready')::text AS ready
    FROM documents WHERE corpus_id = ${corpusId}
  `);

  const runModels = await db.execute<{ embedding_model: string }>(sql`
    SELECT DISTINCT embedding_model FROM combos WHERE run_id = ${runId}
  `);

  const embedProgress = await db.execute<{
    embedding_model: string;
    total: string;
    done: string;
  }>(sql`
    SELECT ce.embedding_model,
      (SELECT COUNT(*) FROM chunks c WHERE c.corpus_id = ${corpusId})::text AS total,
      COUNT(DISTINCT ce.chunk_id)::text AS done
    FROM chunk_embeddings ce
    JOIN chunks c ON c.id = ce.chunk_id
    WHERE c.corpus_id = ${corpusId}
    GROUP BY ce.embedding_model
  `);

  const progressByModel = new Map(
    embedProgress.map((r) => [
      r.embedding_model,
      { model: r.embedding_model, total: Number(r.total), done: Number(r.done) },
    ])
  );
  const chunkTotal = Number(embedProgress[0]?.total ?? 0);
  if (!chunkTotal) {
    const countRow = await db.execute<{ total: string }>(sql`
      SELECT COUNT(*)::text AS total FROM chunks WHERE corpus_id = ${corpusId}
    `);
    const t = Number(countRow[0]?.total ?? 0);
    for (const row of runModels) {
      if (!progressByModel.has(row.embedding_model)) {
        progressByModel.set(row.embedding_model, {
          model: row.embedding_model,
          total: t,
          done: 0,
        });
      }
    }
  } else {
    for (const row of runModels) {
      if (!progressByModel.has(row.embedding_model)) {
        progressByModel.set(row.embedding_model, {
          model: row.embedding_model,
          total: chunkTotal,
          done: 0,
        });
      }
    }
  }

  const trials = await db.execute<{ status: string; count: string }>(sql`
    SELECT t.status, COUNT(*)::text AS count
    FROM trials t
    JOIN runs r ON r.id = t.run_id
    WHERE t.run_id = ${runId}
      AND jsonb_typeof(r.config->'questionIds') = 'array'
      AND (r.config->'questionIds') ? t.question_id::text
    GROUP BY t.status
  `);

  return {
    documents: {
      total: Number(docs[0]?.total ?? 0),
      ready: Number(docs[0]?.ready ?? 0),
    },
    embeddings: [...progressByModel.values()],
    trials: Object.fromEntries(trials.map((t) => [t.status, Number(t.count)])),
  };
}
