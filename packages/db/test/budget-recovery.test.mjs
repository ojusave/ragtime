import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";

const databaseUrl = process.env.TEST_DATABASE_URL;

test(
  "cost reservations release, replay, and expire without double charging",
  { skip: databaseUrl ? false : "TEST_DATABASE_URL is not set" },
  async () => {
    process.env.DATABASE_URL = databaseUrl;
    const {
      BudgetReservationError,
      closeDb,
      corpora,
      getDb,
      releaseCost,
      reserveCost,
      runCostEntries,
      runs,
      settleCost,
    } = await import("../dist/index.js");
    const db = getDb();

    const [corpus] = await db
      .insert(corpora)
      .values({ name: `budget recovery ${crypto.randomUUID()}` })
      .returning();
    assert.ok(corpus);
    const config = {
      corpusId: corpus.id,
      name: "budget recovery",
      embeddingModels: ["test/embed"],
      rerankModels: [null],
      genModels: ["test/chat"],
      questionIds: [crypto.randomUUID()],
      retrieveK: 20,
      finalK: 5,
    };
    const [run] = await db
      .insert(runs)
      .values({
        corpusId: corpus.id,
        name: "budget recovery",
        status: "running",
        config,
        budgetUsd: "1",
      })
      .returning();
    assert.ok(run);

    try {
      await reserveCost(db, run.id, "generation:replay", "generation", 0.5);
      const replayResult = {
        text: "persisted result",
        receipt: { latencyMs: 10, costUsd: 0.12 },
      };
      await settleCost(
        db,
        run.id,
        "generation:replay",
        0.12,
        replayResult
      );
      const replay = await reserveCost(
        db,
        run.id,
        "generation:replay",
        "generation",
        0.5
      );
      assert.equal(replay.replayAvailable, true);
      assert.deepEqual(replay.replayResult, replayResult);
      await db
        .update(runs)
        .set({ status: "budget_exceeded" })
        .where(eq(runs.id, run.id));
      const inactiveReplay = await reserveCost(
        db,
        run.id,
        "generation:replay",
        "generation",
        0.5
      );
      assert.deepEqual(inactiveReplay.replayResult, replayResult);
      await db
        .update(runs)
        .set({ status: "running", finishedAt: null })
        .where(eq(runs.id, run.id));

      await reserveCost(db, run.id, "generation:release", "generation", 0.5);
      await releaseCost(db, run.id, "generation:release");
      await reserveCost(db, run.id, "generation:release", "generation", 0.5);
      await settleCost(db, run.id, "generation:release", 0.1, {
        text: "retried result",
        receipt: { latencyMs: 10, costUsd: 0.1 },
      });

      await reserveCost(db, run.id, "generation:live", "generation", 0.5);
      await assert.rejects(
        () =>
          reserveCost(db, run.id, "generation:live", "generation", 0.5),
        (error) => {
          assert.ok(error instanceof BudgetReservationError);
          assert.equal(error.retryable, true);
          return true;
        }
      );
      await releaseCost(db, run.id, "generation:live");

      await reserveCost(db, run.id, "generation:expired", "generation", 0.5);
      await db
        .update(runCostEntries)
        .set({ reservationExpiresAt: new Date(0) })
        .where(
          and(
            eq(runCostEntries.runId, run.id),
            eq(runCostEntries.operationKey, "generation:expired")
          )
        );
      await assert.rejects(
        () =>
          reserveCost(db, run.id, "generation:expired", "generation", 0.5),
        (error) => {
          assert.ok(error instanceof BudgetReservationError);
          assert.equal(error.retryable, false);
          return true;
        }
      );

      const recoveredRun = await db.query.runs.findFirst({
        where: eq(runs.id, run.id),
      });
      assert.ok(recoveredRun);
      assert.equal(Number(recoveredRun.totalCostUsd), 0.72);
      assert.equal(Number(recoveredRun.reservedCostUsd), 0);
    } finally {
      await db.delete(runs).where(eq(runs.id, run.id));
      await db.delete(corpora).where(eq(corpora.id, corpus.id));
      await closeDb();
    }
  }
);
