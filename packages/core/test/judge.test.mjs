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

test("judge parsing returns null correctness when correctness is not required", () => {
  assert.deepEqual(
    parseJudgeJson(
      JSON.stringify({ faithfulness: 8, completeness: 6, rationale: "grounded" }),
      { requireCorrectness: false }
    ),
    { faithfulness: 8, correctness: null, completeness: 6, rationale: "grounded" }
  );

  // A missing correctness field must not throw when it is not required.
  assert.doesNotThrow(() =>
    parseJudgeJson(
      JSON.stringify({ faithfulness: 5, completeness: 5, rationale: "ok" }),
      { requireCorrectness: false }
    )
  );
});

test("judge does not score correctness when there is no reference answer", async () => {
  const seen = [];
  const gateway = {
    async chat(req) {
      const user = req.messages.find((m) => m.role === "user")?.content ?? "";
      seen.push(user);
      const hasReference = user.includes("REFERENCE:");
      const payload = { faithfulness: 8, completeness: 6, rationale: "no ref" };
      if (hasReference) payload.correctness = 7;
      return { text: JSON.stringify(payload), receipt: { latencyMs: 5, costUsd: 0 } };
    },
  };

  const result = await rubricScorer.score({
    gateway,
    judgeModel: "judge/model",
    context: "context",
    question: "question",
    referenceAnswer: null,
    candidate: "candidate",
  });

  assert.equal(result.correctness, null);
  assert.equal(result.faithfulness, 8);
  assert.equal(result.completeness, 6);
  assert.ok(!seen[0].includes("REFERENCE:"), "no-reference prompt omits REFERENCE");
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
