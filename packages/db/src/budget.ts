import { sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { emitEvent } from "./events.js";

/** Atomic spend guard: returns new total and whether budget was exceeded. */
export async function addCost(
  db: Db,
  runId: string,
  usd: number
): Promise<{ total: number; budget: number; status: string; exceeded: boolean }> {
  const rows = await db.execute<{
    total_cost_usd: string;
    budget_usd: string;
    status: string;
  }>(sql`
    UPDATE runs
    SET total_cost_usd = total_cost_usd + ${usd}
    WHERE id = ${runId}
    RETURNING total_cost_usd, budget_usd, status
  `);

  const row = rows[0];
  if (!row) throw new Error(`Run not found: ${runId}`);

  const total = Number(row.total_cost_usd);
  const budget = Number(row.budget_usd);

  if (total > budget && row.status !== "budget_exceeded") {
    await db.execute(sql`
      UPDATE runs SET status = 'budget_exceeded' WHERE id = ${runId}
    `);
    emitEvent(db, runId, "budget.tripped", { totalUsd: total, budgetUsd: budget });
    return { total, budget, status: "budget_exceeded", exceeded: true };
  }

  return { total, budget, status: row.status, exceeded: total > budget };
}

export async function getRunStatus(db: Db, runId: string): Promise<string | null> {
  const rows = await db.execute<{ status: string }>(sql`
    SELECT status FROM runs WHERE id = ${runId}
  `);
  return rows[0]?.status ?? null;
}
