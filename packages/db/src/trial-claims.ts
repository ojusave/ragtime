import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { TrialStages } from "@ragtime/core";
import type { Db } from "./client.js";
import { trials } from "./schema.js";

export async function claimTrial(args: {
  db: Db;
  trialId: string;
  claimToken: string;
  leaseMs: number;
  maxAttempts: number;
}): Promise<typeof trials.$inferSelect | null> {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + args.leaseMs);
  const [claimed] = await args.db
    .update(trials)
    .set({
      status: "running",
      attempts: sql`${trials.attempts} + 1`,
      claimToken: args.claimToken,
      leaseExpiresAt,
      error: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(trials.id, args.trialId),
        lt(trials.attempts, args.maxAttempts),
        or(
          eq(trials.status, "pending"),
          eq(trials.status, "failed"),
          and(
            eq(trials.status, "running"),
            or(
              isNull(trials.leaseExpiresAt),
              lt(trials.leaseExpiresAt, now)
            )
          )
        ),
        sql`EXISTS (
          SELECT 1 FROM runs r
          WHERE r.id = ${trials.runId}
            AND r.status IN ('ingesting', 'running')
        )`
      )
    )
    .returning();
  return claimed ?? null;
}

export async function checkpointTrialStage(args: {
  db: Db;
  trialId: string;
  claimToken: string;
  stage: keyof TrialStages;
  value: NonNullable<TrialStages[keyof TrialStages]>;
  answer?: string;
  leaseMs: number;
}): Promise<boolean> {
  const stagePatch = JSON.stringify({ [args.stage]: args.value });
  const [updated] = await args.db
    .update(trials)
    .set({
      stages: sql`${trials.stages} || ${stagePatch}::jsonb`,
      answer: args.answer,
      leaseExpiresAt: new Date(Date.now() + args.leaseMs),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trials.id, args.trialId),
        eq(trials.claimToken, args.claimToken),
        eq(trials.status, "running")
      )
    )
    .returning({ id: trials.id });
  return Boolean(updated);
}
