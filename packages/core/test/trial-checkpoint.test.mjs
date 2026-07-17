import assert from "node:assert/strict";
import test from "node:test";

import { runTrialPipeline } from "../dist/pipeline/trial.js";

function createHarness() {
  const calls = { embed: 0, chat: 0, score: 0 };
  const chunks = new Map([
    ["chunk-1", { id: "chunk-1", idx: 0, content: "Relevant context" }],
  ]);
  const ports = {
    gateway: {
      async embed() {
        calls.embed += 1;
        return {
          vectors: [[1, 0]],
          dims: 2,
          receipt: { latencyMs: 2, costUsd: 0 },
        };
      },
      async chat() {
        calls.chat += 1;
        return {
          text: "Generated answer",
          receipt: { latencyMs: 3, costUsd: 0 },
        };
      },
      async rerank() {
        throw new Error("rerank should be skipped");
      },
      async catalog() {
        return { embedding: [], rerank: [], chat: [] };
      },
    },
    vectorStore: {
      async getQueryEmbedding() {
        return null;
      },
      async saveQueryEmbedding() {},
      async retrieve() {
        return [{ id: "chunk-1", content: "Relevant context", score: 0.9, idx: 0 }];
      },
      async getChunksByIds() {
        return chunks;
      },
      async deleteAndInsertChunks() {},
      async getMissingChunkIds() {
        return [];
      },
      async upsertChunkEmbeddings() {
        return 0;
      },
    },
    extractor: { async extract() { return ""; } },
    chunker: { async chunk() { return []; } },
    scorer: {
      async score() {
        calls.score += 1;
        return {
          faithfulness: 8,
          correctness: 7,
          completeness: 6,
          rationale: "ok",
          receipt: { latencyMs: 1, costUsd: 0 },
        };
      },
    },
  };
  return { calls, ports };
}

function baseInput(ports) {
  return {
    ports,
    runId: "run-1",
    corpusId: "corpus-1",
    questionId: "question-1",
    questionText: "Question?",
    referenceAnswer: "Reference",
    embeddingModel: "embed/model",
    rerankModel: null,
    genModel: "gen/model",
    retrieveK: 5,
    finalK: 1,
    judgeModel: "judge/model",
  };
}

function createReplayController() {
  const entries = new Map();
  return {
    async reserve(key) {
      const entry = entries.get(key);
      return entry
        ? {
            maxCostUsd: entry.maxCostUsd,
            replayAvailable: true,
            replayResult: entry.replayResult,
          }
        : { maxCostUsd: 0.25 };
    },
    async settle(key, _actualUsd, replayResult) {
      entries.set(key, { maxCostUsd: 0.25, replayResult });
    },
    async release(key) {
      entries.delete(key);
    },
  };
}

test("a generation checkpoint survives a later failure and prevents rebilling", async () => {
  const { calls, ports } = createHarness();
  const persisted = {};
  let persistedAnswer = null;

  await assert.rejects(
    () =>
      runTrialPipeline({
        ...baseInput(ports),
        async onStageComplete(stage, value, answer) {
          persisted[stage] = value;
          if (answer !== undefined) persistedAnswer = answer;
          if (stage === "generation") throw new Error("simulated crash");
        },
      }),
    /simulated crash/
  );

  assert.deepEqual(Object.keys(persisted), ["retrieval", "generation"]);
  assert.equal(persistedAnswer, "Generated answer");
  assert.deepEqual(calls, { embed: 1, chat: 1, score: 0 });

  const checkpoints = [];
  const result = await runTrialPipeline({
    ...baseInput(ports),
    existingStages: persisted,
    existingAnswer: persistedAnswer,
    async onStageComplete(stage) {
      checkpoints.push(stage);
    },
  });

  assert.equal(result.answer, "Generated answer");
  assert.deepEqual(checkpoints, ["judge"]);
  assert.deepEqual(calls, { embed: 1, chat: 1, score: 1 });
});

test("a settled provider result replays after a crash before its stage checkpoint", async () => {
  const { calls, ports } = createHarness();
  const costController = createReplayController();
  const persisted = {};

  await assert.rejects(
    () =>
      runTrialPipeline({
        ...baseInput(ports),
        costController,
        async onStageComplete(stage, value) {
          if (stage === "generation") {
            throw new Error("crash before generation checkpoint");
          }
          persisted[stage] = value;
        },
      }),
    /crash before generation checkpoint/
  );

  assert.deepEqual(Object.keys(persisted), ["retrieval"]);
  assert.deepEqual(calls, { embed: 1, chat: 1, score: 0 });

  const checkpoints = [];
  const result = await runTrialPipeline({
    ...baseInput(ports),
    existingStages: persisted,
    costController,
    async onStageComplete(stage) {
      checkpoints.push(stage);
    },
  });

  assert.equal(result.answer, "Generated answer");
  assert.deepEqual(checkpoints, ["generation", "judge"]);
  assert.deepEqual(calls, { embed: 1, chat: 1, score: 1 });
});
