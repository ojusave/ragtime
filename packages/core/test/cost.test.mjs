import assert from "node:assert/strict";
import test from "node:test";

import { runCostedOperation } from "../dist/pipeline/cost.js";

test("cost controller reserves before a call and settles before returning", async () => {
  const events = [];
  const controller = {
    async reserve(key, kind) {
      events.push(["reserve", key, kind]);
      return { maxCostUsd: 0.25 };
    },
    async settle(key, actualUsd) {
      events.push(["settle", key, actualUsd]);
    },
  };

  const result = await runCostedOperation({
    controller,
    operationKey: "trial:1:generation",
    kind: "generation",
    async call(maxCostUsd) {
      events.push(["call", maxCostUsd]);
      return { value: "ok", receipt: { latencyMs: 1, costUsd: 0.1 } };
    },
  });

  assert.equal(result.value, "ok");
  assert.deepEqual(events, [
    ["reserve", "trial:1:generation", "generation"],
    ["call", 0.25],
    ["settle", "trial:1:generation", 0.1],
  ]);
});

test("failed provider calls leave the durable reservation unsettled", async () => {
  const events = [];
  const controller = {
    async reserve() {
      events.push("reserve");
      return { maxCostUsd: 0.25 };
    },
    async settle() {
      events.push("settle");
    },
  };

  await assert.rejects(
    () =>
      runCostedOperation({
        controller,
        operationKey: "trial:1:judge",
        kind: "judge",
        async call() {
          events.push("call");
          throw new Error("ambiguous provider failure");
        },
      }),
    /ambiguous provider failure/
  );
  assert.deepEqual(events, ["reserve", "call"]);
});

test("unknown provider costs fail closed and retain the reservation", async () => {
  const events = [];
  const controller = {
    async reserve() {
      events.push("reserve");
      return { maxCostUsd: 0.25 };
    },
    async settle() {
      events.push("settle");
    },
  };

  await assert.rejects(
    () =>
      runCostedOperation({
        controller,
        operationKey: "trial:1:generation",
        kind: "generation",
        async call() {
          events.push("call");
          return {
            receipt: { latencyMs: 1, costUsd: 0, costUnknown: true },
          };
        },
      }),
    /Provider cost is unknown/
  );
  assert.deepEqual(events, ["reserve", "call"]);
});

test("unbudgeted calls remain available for non-run inspector use", async () => {
  let received;
  const result = await runCostedOperation({
    operationKey: "inspect",
    kind: "generation",
    async call(maxCostUsd) {
      received = maxCostUsd;
      return { receipt: { latencyMs: 0, costUsd: 0 } };
    },
  });
  assert.equal(received, undefined);
  assert.equal(result.receipt.costUsd, 0);
});
