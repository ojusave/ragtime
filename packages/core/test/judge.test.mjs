import assert from "node:assert/strict";
import test from "node:test";

import { parseJudgeJson, rubricScorer } from "../dist/pipeline/judge.js";

test("judge parsing rejects non-finite and out-of-range scores", () => {
  assert.deepEqual(
    parseJudgeJson(
      JSON.stringify({
        faithfulness: 8,
        correctness: 7,
        completeness: 6,
        rationale: "grounded",
      })
    ),
    {
      faithfulness: 8,
      correctness: 7,
      completeness: 6,
      rationale: "grounded",
    }
  );

  for (const value of [-1, 11, null, "not-a-number"]) {
    assert.throws(
      () =>
        parseJudgeJson(
          JSON.stringify({
            faithfulness: value,
            correctness: 7,
            completeness: 6,
            rationale: "bad",
          })
        ),
      /Invalid judge score/
    );
  }
});

test("judge retries only malformed output and accounts for both calls", async () => {
  const calls = [];
  const gateway = {
    async chat() {
      const attempt = calls.length + 1;
      calls.push(attempt);
      return attempt === 1
        ? {
            text: "not json",
            receipt: { latencyMs: 10, costUsd: 0.01, tokens: { input: 2, output: 1 } },
          }
        : {
            text: JSON.stringify({
              faithfulness: 8,
              correctness: 7,
              completeness: 6,
              rationale: "retry succeeded",
            }),
            receipt: { latencyMs: 12, costUsd: 0.02, tokens: { input: 3, output: 2 } },
          };
    },
  };
  const ledger = [];
  const costController = {
    async reserve(key) {
      ledger.push(["reserve", key]);
      return { maxCostUsd: 0.25 };
    },
    async settle(key, cost) {
      ledger.push(["settle", key, cost]);
    },
  };

  const result = await rubricScorer.score({
    gateway,
    judgeModel: "judge/model",
    context: "context",
    question: "question",
    referenceAnswer: "reference",
    candidate: "candidate",
    costController,
    operationPrefix: "trial:1:judge",
  });

  assert.equal(result.rationale, "retry succeeded");
  assert.deepEqual(result.receipt, {
    latencyMs: 22,
    costUsd: 0.03,
    costUnknown: false,
    tokens: { input: 5, output: 3 },
    provider: undefined,
    generationId: undefined,
  });
  assert.deepEqual(ledger, [
    ["reserve", "trial:1:judge:attempt:1"],
    ["settle", "trial:1:judge:attempt:1", 0.01],
    ["reserve", "trial:1:judge:attempt:2"],
    ["settle", "trial:1:judge:attempt:2", 0.02],
  ]);
});

test("judge provider errors are not retried", async () => {
  let calls = 0;
  const gateway = {
    async chat() {
      calls += 1;
      throw new Error("provider unavailable");
    },
  };

  await assert.rejects(
    () =>
      rubricScorer.score({
        gateway,
        judgeModel: "judge/model",
        context: "context",
        question: "question",
        referenceAnswer: "reference",
        candidate: "candidate",
      }),
    /provider unavailable/
  );
  assert.equal(calls, 1);
});
