import assert from "node:assert/strict";
import test from "node:test";

import { createOpenRouterGateway } from "../dist/index.js";

async function withMockFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("paid POSTs are attempted once when the response is billing-ambiguous", async () => {
  let attempts = 0;
  await withMockFetch(
    async () => {
      attempts += 1;
      throw new TypeError("connection reset after write");
    },
    async () => {
      const gateway = createOpenRouterGateway({ apiKey: "test-key" });
      await assert.rejects(
        () =>
          gateway.chat({
            model: "test/model",
            messages: [{ role: "user", content: "hello" }],
            maxTokens: 10,
            maxCostUsd: 0.2,
          }),
        /connection reset/
      );
    }
  );
  assert.equal(attempts, 1);
});

test("chat requests carry a conservative provider price bound and accept explicit zero cost", async () => {
  const messages = [{ role: "user", content: "hello" }];
  let requestBody;
  await withMockFetch(
    async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          id: "gen-free",
          choices: [{ message: { content: "ok" } }],
          usage: { cost: 0, prompt_tokens: 2, completion_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    },
    async () => {
      const gateway = createOpenRouterGateway({ apiKey: "test-key" });
      const result = await gateway.chat({
        model: "test/model",
        messages,
        maxTokens: 100,
        maxCostUsd: 0.3,
      });
      assert.equal(result.receipt.costUsd, 0);
      assert.equal(result.receipt.costUnknown, false);
    }
  );

  assert.equal(requestBody.max_tokens, 100);
  assert.equal(requestBody.provider.allow_fallbacks, false);
  assert.equal(requestBody.provider.require_parameters, true);
  const prices = requestBody.provider.max_price;
  const promptUpperBound = Buffer.byteLength(JSON.stringify(messages), "utf8") + 4096;
  const maximumCharge =
    prices.request +
    (prices.prompt * promptUpperBound) / 1_000_000 +
    (prices.completion * 100) / 1_000_000;
  assert.ok(maximumCharge <= 0.3 + Number.EPSILON);
});

test("missing embedding cost is recovered from generation metadata", async () => {
  const urls = [];
  await withMockFetch(
    async (url) => {
      urls.push(String(url));
      if (String(url).includes("/generation?")) {
        return new Response(
          JSON.stringify({ data: { total_cost: 0.012 } }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          id: "emb-1",
          data: [{ embedding: [0.1, 0.2] }],
          usage: { total_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    },
    async () => {
      const gateway = createOpenRouterGateway({ apiKey: "test-key" });
      const result = await gateway.embed({
        model: "test/embed",
        input: ["hello"],
        maxCostUsd: 0.2,
      });
      assert.equal(result.receipt.costUsd, 0.012);
      assert.equal(result.receipt.costUnknown, false);
    }
  );
  assert.equal(urls.length, 2);
});

test("provider error bodies are not exposed and paid errors are not retried", async () => {
  let attempts = 0;
  await withMockFetch(
    async () => {
      attempts += 1;
      return new Response("secret prompt fragment", { status: 503 });
    },
    async () => {
      const gateway = createOpenRouterGateway({ apiKey: "test-key" });
      await assert.rejects(
        () =>
          gateway.rerank({
            model: "test/rerank",
            query: "q",
            documents: ["d"],
            topN: 1,
            maxCostUsd: 0.2,
          }),
        (error) => {
          assert.match(error.message, /HTTP 503/);
          assert.doesNotMatch(error.message, /secret prompt/);
          return true;
        }
      );
    }
  );
  assert.equal(attempts, 1);
});
