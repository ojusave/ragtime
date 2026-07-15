import { and, eq, sql } from "drizzle-orm";
import type { CostController, CostOperationKind } from "@ragtime/core";
import type { Db } from "./client.js";
import { appendRunEvent } from "./events.js";
import { runCostEntries, runs } from "./schema.js";

const ACTIVE_RUN_STATUSES = new Set(["draft", "ingesting", "running", "aggregating"]);
const EPSILON_USD = 0.000001;

export class BudgetReservationError extends Error {
  constructor(
    message: string,
    readonly runStatus: string
  ) {
    super(message);
    this.name = "BudgetReservationError";
  }
}

export function createRunCostController(
  db: Db,
  runId: string,
  maxOperationUsd: number
): CostController {
  if (!Number.isFinite(maxOperationUsd) || maxOperationUsd <= 0) {
    throw new Error("maxOperationUsd must be a positive finite number");
  }
  return {
    reserve: (operationKey, kind) =>
      reserveCost(db, runId, operationKey, kind, maxOperationUsd),
    settle: (operationKey, actualUsd) =>
      settleCost(db, runId, operationKey, actualUsd),
  };
}

export async function reserveCost(
  db: Db,
  runId: string,
  operationKey: string,
  kind: CostOperationKind,
  maxOperationUsd: number
): Promise<{ maxCostUsd: number }> {
  if (!operationKey || operationKey.length > 500) {
    throw new Error("Invalid cost operation key");
  }

  const result = await db.transaction(async (tx) => {
    const runRows = await tx.execute<{
      total_cost_usd: string;
      reserved_cost_usd: string;
      budget_usd: string;
      status: string;
    }>(sql`
      SELECT total_cost_usd, reserved_cost_usd, budget_usd, status
      FROM runs WHERE id = ${runId} FOR UPDATE
    `);
    const run = runRows[0];
    if (!run) throw new Error(`Run not found: ${runId}`);

    const existing = await tx
      .select({ status: runCostEntries.status })
      .from(runCostEntries)
      .where(
        and(
          eq(runCostEntries.runId, runId),
          eq(runCostEntries.operationKey, operationKey)
        )
      )
      .limit(1);
    if (existing[0]) {
      return {
        allowed: false as const,
        tripped: false,
        status: run.status,
        reason: `Cost operation ${operationKey} is already ${existing[0].status}`,
      };
    }

    if (!ACTIVE_RUN_STATUSES.has(run.status)) {
      return {
        allowed: false as const,
        tripped: false,
        status: run.status,
        reason: `Run is ${run.status}`,
      };
    }

    const total = Number(run.total_cost_usd);
    const reserved = Number(run.reserved_cost_usd);
    const budget = Number(run.budget_usd);
    const available = budget - total - reserved;
    const reservation = Math.min(maxOperationUsd, available);

    if (reservation < EPSILON_USD) {
      const exhaustedBySettledSpend = budget - total < EPSILON_USD;
      if (exhaustedBySettledSpend) {
        await tx
          .update(runs)
          .set({ status: "budget_exceeded", finishedAt: new Date() })
          .where(eq(runs.id, runId));
      }
      return {
        allowed: false as const,
        tripped: exhaustedBySettledSpend,
        status: exhaustedBySettledSpend ? "budget_exceeded" : run.status,
        total,
        budget,
        reason: exhaustedBySettledSpend
          ? "Run budget is spent"
          : "Run budget is temporarily reserved by in-flight operations",
      };
    }

    await tx.insert(runCostEntries).values({
      runId,
      operationKey,
      kind,
      reservedUsd: String(reservation),
      status: "reserved",
    });
    await tx
      .update(runs)
      .set({ reservedCostUsd: String(reserved + reservation) })
      .where(eq(runs.id, runId));

    return { allowed: true as const, maxCostUsd: reservation };
  });

  if (!result.allowed) {
    if (result.tripped) {
      await appendRunEvent(db, runId, "budget.tripped", {
        totalUsd: result.total,
        budgetUsd: result.budget,
      });
    }
    throw new BudgetReservationError(result.reason, result.status);
  }
  return { maxCostUsd: result.maxCostUsd };
}

export async function settleCost(
  db: Db,
  runId: string,
  operationKey: string,
  actualUsd: number
): Promise<void> {
  if (!Number.isFinite(actualUsd) || actualUsd < 0) {
    throw new Error(`Invalid actual cost for ${operationKey}`);
  }

  const result = await db.transaction(async (tx) => {
    const runRows = await tx.execute<{
      total_cost_usd: string;
      reserved_cost_usd: string;
      budget_usd: string;
      status: string;
    }>(sql`
      SELECT total_cost_usd, reserved_cost_usd, budget_usd, status
      FROM runs WHERE id = ${runId} FOR UPDATE
    `);
    const run = runRows[0];
    if (!run) throw new Error(`Run not found: ${runId}`);

    const entries = await tx
      .select()
      .from(runCostEntries)
      .where(
        and(
          eq(runCostEntries.runId, runId),
          eq(runCostEntries.operationKey, operationKey)
        )
      )
      .limit(1);
    const entry = entries[0];
    if (!entry) throw new Error(`Cost reservation not found: ${operationKey}`);
    if (entry.status === "settled") return { tripped: false, total: Number(run.total_cost_usd), budget: Number(run.budget_usd) };
    if (entry.status !== "reserved") {
      throw new Error(`Cost reservation ${operationKey} is ${entry.status}`);
    }

    const reservedForOperation = Number(entry.reservedUsd);
    const total = Number(run.total_cost_usd) + actualUsd;
    const reserved = Math.max(
      0,
      Number(run.reserved_cost_usd) - reservedForOperation
    );
    const budget = Number(run.budget_usd);
    const exceededReservation = actualUsd - reservedForOperation > EPSILON_USD;
    const tripped = total - budget > EPSILON_USD || exceededReservation;

    await tx
      .update(runCostEntries)
      .set({ actualUsd: String(actualUsd), status: "settled", updatedAt: new Date() })
      .where(eq(runCostEntries.id, entry.id));

    const nextStatus =
      tripped && ACTIVE_RUN_STATUSES.has(run.status)
        ? "budget_exceeded"
        : run.status;
    await tx
      .update(runs)
      .set({
        totalCostUsd: String(total),
        reservedCostUsd: String(reserved),
        status: nextStatus,
        finishedAt: nextStatus === "budget_exceeded" ? new Date() : undefined,
      })
      .where(eq(runs.id, runId));

    return { tripped: nextStatus === "budget_exceeded" && run.status !== nextStatus, total, budget };
  });

  if (result.tripped) {
    await appendRunEvent(db, runId, "budget.tripped", {
      totalUsd: result.total,
      budgetUsd: result.budget,
    });
  }
}

export async function getRunStatus(db: Db, runId: string): Promise<string | null> {
  const rows = await db.execute<{ status: string }>(sql`
    SELECT status FROM runs WHERE id = ${runId}
  `);
  return rows[0]?.status ?? null;
}
