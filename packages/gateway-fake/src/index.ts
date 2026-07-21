import type { GatewayIdentity, ModelCatalog, ModelGateway } from "@ragtime/core";

const FAKE_DIMS = 64;

const FAKE_GATEWAY_IDENTITY: GatewayIdentity = {
  id: "fake",
  label: "Fake gateway (offline)",
};

function hashEmbed(text: string): number[] {
  const vec = new Array(FAKE_DIMS).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % FAKE_DIMS]! += text.charCodeAt(i) / 1000;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function tokenOverlap(query: string, doc: string): number {
  const q = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  const d = doc.toLowerCase().split(/\W+/).filter(Boolean);
  if (q.size === 0) return 0;
  let hit = 0;
  for (const t of d) if (q.has(t)) hit++;
  return hit / q.size;
}

const FAKE_CATALOG: ModelCatalog = {
  embedding: [
    {
      id: "fake/embed-small",
      name: "Fake Embed Small",
      pricing: { prompt: "0.00000001" },
    },
    {
      id: "fake/embed-large",
      name: "Fake Embed Large",
      pricing: { prompt: "0.00000005" },
    },
  ],
  rerank: [{ id: "fake/rerank-v1", name: "Fake Rerank v1" }],
  chat: [
    {
      id: "fake/chat-mini",
      name: "Fake Chat Mini",
      pricing: { prompt: "0.0000001", completion: "0.0000002" },
    },
    {
      id: "fake/chat-pro",
      name: "Fake Chat Pro",
      pricing: { prompt: "0.000001", completion: "0.000002" },
    },
  ],
  gateway: FAKE_GATEWAY_IDENTITY,
};

function fakeReceipt(latencyMs = 12): {
  latencyMs: number;
  costUsd: number;
  provider: string;
} {
  return { latencyMs, costUsd: 0, provider: "fake" };
}

export function createFakeGateway(): ModelGateway {
  return {
    async chat(req) {
      await delay(20);
      const user = req.messages.find((m) => m.role === "user")?.content ?? "";
      const contextMatch = user.match(/CONTEXT:\s*([\s\S]*?)\n\nQUESTION:/);
      const context = contextMatch?.[1]?.trim() ?? "";
      const questionMatch = user.match(/QUESTION:\s*([\s\S]*?)(?:\n\nREFERENCE:|$)/);
      const question = questionMatch?.[1]?.trim() ?? user;

      if (req.jsonSchema || user.includes("REFERENCE:")) {
        const text = JSON.stringify({
          faithfulness: context ? 8 : 7,
          correctness: 7,
          completeness: 6,
          rationale: "Fake judge scored from context overlap.",
        });
        return { text, receipt: fakeReceipt(15) };
      }

      if (!context) {
        return {
          text: "The context does not cover this question.",
          receipt: fakeReceipt(),
        };
      }

      const snippet = context.slice(0, 200).replace(/\s+/g, " ");
      return {
        text: `Based on the context [chunk:0]: ${snippet}`,
        receipt: fakeReceipt(),
      };
    },

    async embed(req) {
      await delay(10);
      const vectors = req.input.map(hashEmbed);
      return {
        vectors,
        dims: FAKE_DIMS,
        receipt: fakeReceipt(8),
      };
    },

    async rerank(req) {
      await delay(10);
      const scored = req.documents.map((doc, index) => ({
        index,
        relevance: tokenOverlap(req.query, doc),
      }));
      scored.sort((a, b) => b.relevance - a.relevance);
      return {
        results: scored.slice(0, req.topN),
        receipt: fakeReceipt(8),
      };
    },

    async catalog() {
      await delay(5);
      return FAKE_CATALOG;
    },
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
