import { sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { emitEvent } from "./events.js";

// REVIEW C1 (Critical, OpenRouter×Render): This is post-spend accounting, not a spend
// guard. The increment happens after the provider call has already been billed, and the
// two UPDATEs below race (increment vs. status flip). Concurrent trial fan-out can blow
// past the budget before any caller observes `exceeded`. Fix: an awaited reservation with
// a DB-side ceiling, e.g.
//   UPDATE runs SET reserved_cost_usd = reserved_cost_usd + :estimate
//   WHERE id = :run_id AND total_cost_usd + reserved_cost_usd + :estimate <= budget_usd
//   RETURNING ...
// reserved before the paid call and reconciled (awaited) after the receipt arrives.
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
    // REVIEW C1/C4 (Critical): unconditional status write — a late cost callback can
    // overwrite `canceled`/`complete`/`failed`. Make it conditional:
    //   ... WHERE id = :run_id AND status NOT IN ('canceled','complete','failed','budget_exceeded')
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
