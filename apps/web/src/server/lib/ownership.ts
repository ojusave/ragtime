import { eq } from "drizzle-orm";
import type { getDb } from "@ragtime/db";
import { schema } from "@ragtime/db";

const { runs, trials } = schema;

type Db = ReturnType<typeof getDb>;

export function assertRunOwner(
  run: { sessionId: string | null } | undefined,
  sessionId: string
): run is { sessionId: string | null } {
  if (!run) return false;
  if (!run.sessionId) return false;
  return run.sessionId === sessionId;
}

export async function getOwnedRun(db: Db, runId: string, sessionId: string) {
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!assertRunOwner(run, sessionId)) return null;
  return run;
}

export async function getOwnedTrial(db: Db, trialId: string, sessionId: string) {
  const trial = await db.query.trials.findFirst({ where: eq(trials.id, trialId) });
  if (!trial) return null;
  const run = await getOwnedRun(db, trial.runId, sessionId);
  if (!run) return null;
  return { trial, run };
}
