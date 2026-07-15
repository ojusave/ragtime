import type { ModelGateway, ModelInfo } from "@ragtime/core";

const BASE_URL = "https://openrouter.ai/api/v1";

export function createOpenRouterGateway(options?: {
  apiKey?: string;
  appUrl?: string;
  appTitle?: string;
}): ModelGateway {
  const apiKey = options?.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");
  const appUrl = options?.appUrl ?? process.env.APP_URL ?? "http://localhost:5173";
  const appTitle = options?.appTitle ?? process.env.OPENROUTER_APP_TITLE ?? "RAGtime";

  const headers = (): Record<string, string> => ({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": appUrl,
    "X-OpenRouter-Title": appTitle,
  });

  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const status = (err as { status?: number }).status;
        // REVIEW M3 (Medium): `status === undefined` retries everything without a status
        // — JSON parse errors and programmer errors included — up to 5 times. There is
        // also no per-request timeout on the fetch below (a hung request stalls the
        // workflow), Retry-After HTTP-date values become NaN, and a large numeric
        // Retry-After sleeps unboundedly. Classify errors explicitly (retry 429/5xx/
        // network timeouts only), add AbortSignal.timeout per request, and cap both the
        // Retry-After delay and total retry time. For paid POSTs, note the provider may
        // have accepted a request even when the client lost the response — pair retries
        // with stage-level dedup (C3).
        const retryable =
          status === 429 || (status !== undefined && status >= 500) || status === undefined;
        if (!retryable || attempt === 4) break;
        const retryAfter = Number((err as { retryAfter?: number }).retryAfter) || 0;
        const delay =
          retryAfter > 0
            ? retryAfter * 1000
            : Math.min(1000 * 2 ** attempt + Math.random() * 500, 30_000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  async function request<T>(path: string, body?: unknown): Promise<T> {
    return withRetry(async () => {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: body ? "POST" : "GET",
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        // REVIEW M4 (Medium): the raw upstream body is embedded in the error message,
        // which flows into persisted trial/run/document error fields and API responses.
        // Provider bodies can include internal diagnostics and prompt fragments — keep a
        // bounded/safe public message and log the raw body server-side only.
        const err = new Error(`OpenRouter ${path}: ${res.status} ${text}`) as Error & {
          status?: number;
          retryAfter?: number;
        };
        err.status = res.status;
        const ra = res.headers.get("retry-after");
        if (ra) err.retryAfter = Number(ra);
        throw err;
      }
      return res.json() as Promise<T>;
    });
  }

  return {
    // REVIEW M1 (Medium): no token streaming — `stream: true` is never sent and the port
    // only returns completed responses, so the inspector's SSE reports finished stages,
    // not live deltas. Either document the SSE as "stage progress" or add a separate
    // `chatStream(req, signal): AsyncIterable<ChatDelta>` port that parses OpenRouter SSE
    // frames, keeping this complete-response path for judging/batch workflows.
    async chat(req) {
      const start = Date.now();
      const body: Record<string, unknown> = {
        model: req.model,
        messages: req.messages,
        usage: { include: true },
      };
      if (req.jsonSchema) {
        body.response_format = {
          type: "json_schema",
          json_schema: { name: "response", strict: true, schema: req.jsonSchema },
        };
      }
      const completion = await request<{
        id?: string;
        choices?: { message?: { content?: string } }[];
        usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number };
      }>("/chat/completions", body);

      let costUsd = completion.usage?.cost ?? 0;
      let provider: string | undefined;
      const generationId = completion.id;
      let tokens = {
        input: completion.usage?.prompt_tokens,
        output: completion.usage?.completion_tokens,
      };

      if (!costUsd && generationId) {
        const gen = await request<{ data?: {
          total_cost?: number;
          native_tokens_prompt?: number;
          native_tokens_completion?: number;
          provider_name?: string;
        } }>(`/generation?id=${encodeURIComponent(generationId)}`);
        costUsd = gen.data?.total_cost ?? 0;
        provider = gen.data?.provider_name;
        tokens = {
          input: gen.data?.native_tokens_prompt,
          output: gen.data?.native_tokens_completion,
        };
      }

      return {
        text: completion.choices?.[0]?.message?.content ?? "",
        receipt: {
          latencyMs: Date.now() - start,
          costUsd,
          costUnknown: costUsd === 0,
          tokens,
          provider,
          generationId,
        },
      };
    },

    async embed(req) {
      const start = Date.now();
      const response = await request<{
        data?: { embedding: number[] }[];
        usage?: { cost?: number; total_tokens?: number };
      }>("/embeddings", { model: req.model, input: req.input });

      const vectors = (response.data ?? []).map((d) => d.embedding);
      const dims = vectors[0]?.length ?? 0;
      return {
        vectors,
        dims,
        receipt: {
          latencyMs: Date.now() - start,
          costUsd: response.usage?.cost ?? 0,
          costUnknown: !response.usage?.cost,
          tokens: { input: response.usage?.total_tokens },
        },
      };
    },

    async rerank(req) {
      const start = Date.now();
      const data = await request<{
        results?: { index: number; relevance_score: number }[];
        usage?: { cost?: number };
      }>("/rerank", {
        model: req.model,
        query: req.query,
        documents: req.documents,
        top_n: req.topN,
      });

      return {
        results: (data.results ?? []).map((r) => ({
          index: r.index,
          relevance: r.relevance_score,
        })),
        receipt: {
          latencyMs: Date.now() - start,
          costUsd: data.usage?.cost ?? 0,
          costUnknown: !data.usage?.cost,
        },
      };
    },

    async catalog() {
      type ModelRow = {
        id: string;
        name?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string; request?: string };
        architecture?: { output_modalities?: string[] };
      };

      // GET /models defaults to output_modalities=text, which excludes embeddings and rerank.
      // REVIEW M11 (Medium): a failed /embeddings/models call is silently coerced to an
      // empty list, which the UI can't distinguish from "no embedding models exist". Return
      // a typed catalog result with per-source warnings (or fail retryably) instead of
      // swallowing the error.
      const [allModels, embeddingOnly] = await Promise.all([
        request<{ data?: ModelRow[] }>("/models?output_modalities=all"),
        request<{ data?: ModelRow[] }>("/embeddings/models").catch(() => ({ data: [] as ModelRow[] })),
      ]);

      const byId = new Map<string, ModelRow>();
      for (const m of [...(allModels.data ?? []), ...(embeddingOnly.data ?? [])]) {
        byId.set(m.id, m);
      }

      const embedding: ModelInfo[] = [];
      const rerank: ModelInfo[] = [];
      const chat: ModelInfo[] = [];

      for (const m of byId.values()) {
        const modalities = m.architecture?.output_modalities ?? [];
        const entry: ModelInfo = {
          id: m.id,
          name: m.name ?? m.id,
          contextLength: m.context_length,
          pricing: m.pricing,
        };
        // REVIEW M11 (Medium): ID-substring classification is heuristic — a rerank model
        // without "rerank" in its slug is misclassified as chat, and vice versa. Prefer
        // capability metadata and validate the selected model's capability before a paid
        // run; keep substring matching only as a clearly-marked fallback.
        if (modalities.includes("embeddings") || m.id.includes("embedding")) {
          embedding.push(entry);
        } else if (modalities.includes("rerank") || m.id.includes("rerank")) {
          rerank.push(entry);
        } else if (modalities.includes("text") || modalities.length === 0) {
          chat.push(entry);
        }
      }

      embedding.sort((a, b) => a.name.localeCompare(b.name));
      rerank.sort((a, b) => a.name.localeCompare(b.name));
      chat.sort((a, b) => a.name.localeCompare(b.name));

      return { embedding, rerank, chat };
    },
  };
}
