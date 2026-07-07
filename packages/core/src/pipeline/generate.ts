import {
  RAG_SYSTEM_PROMPT,
  buildGenerationUserPrompt,
} from "../prompts.js";
import type { ModelGateway } from "../ports.js";
import type { TrialStageGeneration } from "../schemas.js";

export type GenerateInput = {
  gateway: ModelGateway;
  genModel: string;
  question: string;
  keptChunkIds: string[];
  chunkMap: Map<string, { id: string; idx: number; content: string }>;
  onCost?: (usd: number) => void;
};

export async function generateAnswer(
  input: GenerateInput
): Promise<{ answer: string; stage: TrialStageGeneration }> {
  const blocks = input.keptChunkIds.map((id, i) => {
    const c = input.chunkMap.get(id);
    return { idx: c?.idx ?? i, content: c?.content ?? "" };
  });
  const userPrompt = buildGenerationUserPrompt(blocks, input.question);

  const { text, receipt } = await input.gateway.chat({
    model: input.genModel,
    messages: [
      { role: "system", content: RAG_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  input.onCost?.(receipt.costUsd);

  return {
    answer: text,
    stage: {
      contextChunkIds: input.keptChunkIds,
      latencyMs: receipt.latencyMs,
      costUsd: receipt.costUsd,
      costUnknown: receipt.costUnknown,
      tokens: receipt.tokens,
      provider: receipt.provider,
      generationId: receipt.generationId,
    },
  };
}
