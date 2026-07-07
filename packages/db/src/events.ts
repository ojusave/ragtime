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
    SELECT id, run_id, at, type, entity_id, payload
    FROM run_events
    WHERE run_id = ${runId} AND id > ${afterId}
    ORDER BY id ASC
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
    SELECT status, COUNT(*)::text AS count
    FROM trials WHERE run_id = ${runId}
    GROUP BY status
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
