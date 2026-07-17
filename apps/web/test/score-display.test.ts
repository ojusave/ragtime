import assert from "node:assert/strict";
import test from "node:test";
import {
  scoreOnTen,
  scorePercent,
  scoreTone,
  summarizeTrialScores,
} from "../src/client/lib/score-display.js";
import { prioritizeSampleQuestions } from "../src/client/lib/sample-display.js";

test("keeps zero scores visible and clamps values to the evaluation scale", () => {
  assert.equal(scoreOnTen("0"), 0);
  assert.equal(scorePercent("0"), 0);
  assert.equal(scorePercent(7.54, 1), 75.4);
  assert.equal(scorePercent(12), 100);
  assert.equal(scorePercent(-2), 0);
  assert.equal(scorePercent(null), null);
});

test("assigns score bands with an explicit neutral state", () => {
  assert.equal(scoreTone(91), "high");
  assert.equal(scoreTone(72), "medium");
  assert.equal(scoreTone(59), "low");
  assert.equal(scoreTone(null), "neutral");
});

test("summarizes scored trials without silently treating failures or pending work as zero", () => {
  const summary = summarizeTrialScores([
    { status: "complete", overallScore: "0" },
    { status: "complete", overallScore: "7.5" },
    { status: "failed", overallScore: null },
    { status: "pending", overallScore: null },
  ]);

  assert.deepEqual(summary, {
    overallPercent: 37.5,
    earnedPoints: 7.5,
    possiblePoints: 20,
    scoredCount: 2,
    completeCount: 2,
    failedCount: 1,
    totalCount: 4,
  });
});

test("starts the demo with the clearest sample while preserving the remaining order", () => {
  const samples = [
    { id: "a", text: "0-dimensional biomaterials show inductive properties.", referenceAnswer: "A" },
    { id: "b", text: "A deficiency of vitamin B12 increases homocysteine.", referenceAnswer: "B" },
    { id: "c", text: "A later sample.", referenceAnswer: "C" },
  ];

  assert.deepEqual(
    prioritizeSampleQuestions(samples).map((sample) => sample.id),
    ["b", "a", "c"]
  );
  assert.deepEqual(samples.map((sample) => sample.id), ["a", "b", "c"]);
});
