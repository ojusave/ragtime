import type { CostController, ModelGateway } from "../ports.js";
import type { TrialStageRerank } from "../schemas.js";
import { runCostedOperation } from "./cost.js";

export type RerankInput = {
  gateway: ModelGateway;
  rerankModel: string;
  query: string;
  chunkIds: string[];
  chunkContents: string[];
  finalK: number;
  relevanceThreshold?: number | null;
  costController?: CostController;
  operationKey?: string;
  onCost?: (usd: number) => Promise<void>;
};

export async function rerankCandidates(
  input: RerankInput
): Promise<{ stage: TrialStageRerank; keptChunkIds: string[] }> {
  const { results, receipt } = await runCostedOperation({
    controller: input.costController,
    operationKey:
      input.operationKey ?? `rerank:${input.rerankModel}:${input.query}`,
    kind: "rerank",
    call: (maxCostUsd) =>
      input.gateway.rerank({
        model: input.rerankModel,
        query: input.query,
        documents: input.chunkContents,
        topN: input.finalK,
        maxCostUsd,
      }),
  });
  await input.onCost?.(receipt.costUsd);

  let filtered = results;
  if (input.relevanceThreshold != null) {
    filtered = results.filter((r) => r.relevance >= input.relevanceThreshold!);
  }

  const keptChunkIds = filtered.map((r) => input.chunkIds[r.index]!);

  return {
    stage: {
      order: results.map((r) => r.index),
      scores: results.map((r) => r.relevance),
      keptChunkIds,
      latencyMs: receipt.latencyMs,
      costUsd: receipt.costUsd,
    },
    keptChunkIds,
  };
}

export function topKByScore(
  chunkIds: string[],
  scores: number[],
  finalK: number
): string[] {
  const paired = chunkIds.map((id, i) => ({ id, score: scores[i] ?? 0 }));
  paired.sort((a, b) => b.score - a.score);
  return paired.slice(0, finalK).map((p) => p.id);
}
