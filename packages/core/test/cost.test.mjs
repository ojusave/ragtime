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
    async settle(key, actualUsd, replayResult) {
      events.push(["settle", key, actualUsd, replayResult]);
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
    [
      "settle",
      "trial:1:generation",
      0.1,
      { value: "ok", receipt: { latencyMs: 1, costUsd: 0.1 } },
    ],
  ]);
});

test("settled provider results replay without another paid call", async () => {
  let calls = 0;
  const replay = {
    value: "cached",
    receipt: { latencyMs: 2, costUsd: 0.1 },
  };
  const controller = {
    async reserve() {
      return {
        maxCostUsd: 0.25,
        replayAvailable: true,
        replayResult: replay,
      };
    },
    async settle() {
      assert.fail("a replayed operation must not settle twice");
    },
    async release() {
      assert.fail("a replayed operation must not release its settled cost");
    },
  };

  const result = await runCostedOperation({
    controller,
    operationKey: "trial:1:generation",
    kind: "generation",
    async call() {
      calls += 1;
      throw new Error("paid call must not be repeated");
    },
  });

  assert.equal(calls, 0);
  assert.deepEqual(result, replay);
});

test("definitively unbilled provider failures release the reservation for retry", async () => {
  const events = [];
  const controller = {
    async reserve() {
      events.push("reserve");
      return { maxCostUsd: 0.25 };
    },
    async settle() {
      events.push("settle");
    },
    async release(key) {
      events.push(["release", key]);
    },
  };

  const error = new Error("provider rejected request");
  error.billingAmbiguous = false;
  await assert.rejects(
    () =>
      runCostedOperation({
        controller,
        operationKey: "trial:1:judge",
        kind: "judge",
        async call() {
          events.push("call");
          throw error;
        },
      }),
    /provider rejected request/
  );
  assert.deepEqual(events, [
    "reserve",
    "call",
    ["release", "trial:1:judge"],
  ]);
});

test("billing-ambiguous failures conservatively settle the reservation", async () => {
  const events = [];
  const controller = {
    async reserve() {
      events.push("reserve");
      return { maxCostUsd: 0.25 };
    },
    async settle(key, actualUsd, replayResult) {
      events.push(["settle", key, actualUsd, replayResult]);
    },
    async release() {
      events.push("release");
    },
  };

  const error = new Error("connection reset after write");
  error.billingAmbiguous = true;
  await assert.rejects(
    () =>
      runCostedOperation({
        controller,
        operationKey: "trial:1:generation",
        kind: "generation",
        async call() {
          events.push("call");
          throw error;
        },
      }),
    /connection reset/
  );
  assert.deepEqual(events, [
    "reserve",
    "call",
    ["settle", "trial:1:generation", 0.25, undefined],
  ]);
});

test("unknown provider costs settle conservatively and preserve the result", async () => {
  const events = [];
  const controller = {
    async reserve() {
      events.push("reserve");
      return { maxCostUsd: 0.25 };
    },
    async settle(key, actualUsd, replayResult) {
      events.push(["settle", key, actualUsd, replayResult]);
    },
    async release() {
      events.push("release");
    },
  };

  const result = await runCostedOperation({
    controller,
    operationKey: "trial:1:generation",
    kind: "generation",
    async call() {
      events.push("call");
      return {
        value: "completed",
        receipt: { latencyMs: 1, costUsd: 0, costUnknown: true },
      };
    },
  });

  assert.deepEqual(result, {
    value: "completed",
    receipt: { latencyMs: 1, costUsd: 0.25, costUnknown: true },
  });
  assert.deepEqual(events, [
    "reserve",
    "call",
    [
      "settle",
      "trial:1:generation",
      0.25,
      {
        value: "completed",
        receipt: { latencyMs: 1, costUsd: 0.25, costUnknown: true },
      },
    ],
  ]);
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
