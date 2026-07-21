import assert from "node:assert/strict";
import test from "node:test";
import { runConfigSchema } from "@ragtime/core";
import {
  createRunPlan,
  getRunPlanRejection,
} from "../src/server/routes/run-plan.js";

const corpusId = "00000000-0000-4000-8000-000000000001";
const questionA = "00000000-0000-4000-8000-00000000000a";
const questionB = "00000000-0000-4000-8000-00000000000b";
const questionC = "00000000-0000-4000-8000-00000000000c";

function parseConfig(overrides: Record<string, unknown> = {}) {
  return runConfigSchema.parse({
    corpusId,
    name: "test run",
    embeddingModels: ["embed/a"],
    rerankModels: [null],
    genModels: ["gen/a"],
    questionIds: [questionA],
    judgeModel: "judge/model",
    ...overrides,
  });
}

test("normalizes duplicate model and question inputs without removing null reranking", () => {
  const config = parseConfig({
    embeddingModels: ["embed/a", "embed/a", "embed/b"],
    rerankModels: [null, null, "rerank/a"],
    genModels: ["gen/a", "gen/a"],
    questionIds: [questionA, questionA, questionB],
  });

  assert.deepEqual(config.embeddingModels, ["embed/a", "embed/b"]);
  assert.deepEqual(config.rerankModels, [null, "rerank/a"]);
  assert.deepEqual(config.genModels, ["gen/a"]);
  assert.deepEqual(config.questionIds, [questionA, questionB]);

  const plan = createRunPlan(config, [questionA, questionB]);
  assert.equal(plan.comboCount, 4);
  assert.equal(plan.trialCount, 8);
});

test("rejects oversized inputs and invalid judge weights", () => {
  assert.equal(
    runConfigSchema.safeParse({
      ...parseConfig(),
      embeddingModels: Array.from({ length: 51 }, (_, index) => `embed/${index}`),
    }).success,
    false
  );
  assert.equal(
    runConfigSchema.safeParse({
      ...parseConfig(),
      embeddingModels: ["x".repeat(201)],
    }).success,
    false
  );
  assert.equal(
    runConfigSchema.safeParse({
      ...parseConfig(),
      judgeModel: "x".repeat(201),
    }).success,
    false
  );
  assert.equal(
    runConfigSchema.safeParse({
      ...parseConfig(),
      questionIds: Array.from(
        { length: 1_001 },
        (_, index) =>
          `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
      ),
    }).success,
    false
  );

  for (const judgeWeights of [
    { faithfulness: 0.5, correctness: 0.5, completeness: 0.5 },
    { faithfulness: Number.NaN, correctness: 0.8, completeness: 0.2 },
    { faithfulness: Number.POSITIVE_INFINITY, correctness: 0, completeness: 0 },
  ]) {
    assert.equal(
      runConfigSchema.safeParse({ ...parseConfig(), judgeWeights }).success,
      false
    );
  }
  assert.equal(
    runConfigSchema.safeParse({
      ...parseConfig(),
      judgeWeights: { faithfulness: 0.4, correctness: 0.4, completeness: 0.2 },
    }).success,
    true
  );
});

test("computes an oversized normalized matrix before any rows are constructed", () => {
  const questionIds = Array.from(
    { length: 41 },
    (_, index) =>
      `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
  );
  const config = parseConfig({
    embeddingModels: ["embed/a", "embed/b"],
    rerankModels: [null, "rerank/a"],
    genModels: ["gen/a", "gen/b"],
    questionIds,
  });
  const plan = createRunPlan(config, questionIds);

  assert.equal(plan.comboCount, 8);
  assert.equal(plan.trialCount, 328);
  assert.equal(getRunPlanRejection(plan, 324)?.statusCode, 400);
});

test("snapshots only authorized questions and reports unavailable explicit IDs", () => {
  const explicit = createRunPlan(
    parseConfig({ questionIds: [questionA, questionB] }),
    [questionA]
  );
  assert.deepEqual(explicit.config.questionIds, [questionA]);
  assert.deepEqual(explicit.unavailableQuestionIds, [questionB]);
  assert.equal(getRunPlanRejection(explicit, 324)?.statusCode, 403);

  const authorizedAtCreation = [questionA, questionB];
  const all = createRunPlan(
    parseConfig({ questionIds: "all" }),
    authorizedAtCreation
  );
  authorizedAtCreation.push(questionC);

  assert.deepEqual(all.config.questionIds, [questionA, questionB]);
  assert.deepEqual(all.unavailableQuestionIds, []);
  assert.equal(getRunPlanRejection(all, 324), null);
});

test("rejects an empty all-question snapshot before run creation", () => {
  const plan = createRunPlan(parseConfig({ questionIds: "all" }), []);

  assert.deepEqual(plan.config.questionIds, []);
  assert.deepEqual(getRunPlanRejection(plan, 324), {
    statusCode: 400,
    error: "No questions are available for this run.",
  });
});

test("requires a judge model from the request or the env fallback", () => {
  const withoutJudge = runConfigSchema.parse({
    corpusId,
    name: "test run",
    embeddingModels: ["embed/a"],
    rerankModels: [null],
    genModels: ["gen/a"],
    questionIds: [questionA],
  });

  const noJudge = createRunPlan(withoutJudge, [questionA]);
  assert.equal(noJudge.config.judgeModel, undefined);
  assert.deepEqual(getRunPlanRejection(noJudge, 324), {
    statusCode: 400,
    error:
      "No judge model configured. Set JUDGE_MODEL or include judgeModel in the run request.",
  });

  const fromFallback = createRunPlan(withoutJudge, [questionA], {
    judgeModelFallback: "env/judge",
  });
  assert.equal(fromFallback.config.judgeModel, "env/judge");
  assert.equal(getRunPlanRejection(fromFallback, 324), null);

  const fromRequest = createRunPlan(
    parseConfig({ judgeModel: "request/judge" }),
    [questionA],
    { judgeModelFallback: "env/judge" }
  );
  assert.equal(fromRequest.config.judgeModel, "request/judge");

  const blankFallback = createRunPlan(withoutJudge, [questionA], {
    judgeModelFallback: "   ",
  });
  assert.equal(blankFallback.config.judgeModel, undefined);
  assert.equal(getRunPlanRejection(blankFallback, 324)?.statusCode, 400);
});

test("explicit setups drive combos and normalize the model arrays", () => {
  const config = parseConfig({
    embeddingModels: ["embed/a", "embed/b", "embed/unused"],
    rerankModels: [null, "rerank/a"],
    genModels: ["gen/a", "gen/b", "gen/unused"],
    setups: [
      { embeddingModel: "embed/a", rerankModel: null, genModel: "gen/a" },
      { embeddingModel: "embed/b", rerankModel: "rerank/a", genModel: "gen/b" },
      // Duplicate of the first setup: collapsed.
      { embeddingModel: "embed/a", rerankModel: null, genModel: "gen/a" },
    ],
    questionIds: [questionA, questionB],
  });

  const plan = createRunPlan(config, [questionA, questionB]);
  assert.equal(plan.comboCount, 2);
  assert.equal(plan.trialCount, 4);
  assert.equal(plan.config.setups?.length, 2);
  // Model arrays collapse to the union actually referenced by the setups.
  assert.deepEqual(plan.config.embeddingModels, ["embed/a", "embed/b"]);
  assert.deepEqual(plan.config.rerankModels, [null, "rerank/a"]);
  assert.deepEqual(plan.config.genModels, ["gen/a", "gen/b"]);
});

test("caps an all-question snapshot even when the trial cap is raised", () => {
  const authorized = Array.from(
    { length: 1_001 },
    (_, index) =>
      `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
  );
  const plan = createRunPlan(
    parseConfig({ questionIds: "all" }),
    authorized
  );

  assert.deepEqual(getRunPlanRejection(plan, 10_000), {
    statusCode: 400,
    error: "Runs support at most 1000 questions.",
  });
});
