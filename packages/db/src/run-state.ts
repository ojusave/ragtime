import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "./client.js";
import { runs } from "./schema.js";

export type RunStatus =
  | "draft"
  | "ingesting"
  | "running"
  | "aggregating"
  | "complete"
  | "failed"
  | "canceled"
  | "budget_exceeded";

export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = [
  "complete",
  "failed",
  "canceled",
  "budget_exceeded",
];

export async function transitionRun(
  db: Db,
  runId: string,
  expected: RunStatus | RunStatus[],
  next: RunStatus,
  changes: Partial<typeof runs.$inferInsert> = {}
): Promise<typeof runs.$inferSelect | null> {
  const expectedStatuses = Array.isArray(expected) ? expected : [expected];
  const [updated] = await db
    .update(runs)
    .set({ ...changes, status: next })
    .where(
      and(eq(runs.id, runId), inArray(runs.status, expectedStatuses))
    )
    .returning();
  return updated ?? null;
}
