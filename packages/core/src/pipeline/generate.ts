import {
  RAG_SYSTEM_PROMPT,
  buildGenerationUserPrompt,
} from "../prompts.js";
import type { CostController, ModelGateway } from "../ports.js";
import type { TrialStageGeneration } from "../schemas.js";
import { runCostedOperation } from "./cost.js";

export type GenerateInput = {
  gateway: ModelGateway;
  genModel: string;
  question: string;
  keptChunkIds: string[];
  chunkMap: Map<string, { id: string; idx: number; content: string }>;
  costController?: CostController;
  operationKey?: string;
  onCost?: (usd: number) => Promise<void>;
};

export async function generateAnswer(
  input: GenerateInput
): Promise<{ answer: string; stage: TrialStageGeneration }> {
  const blocks = input.keptChunkIds.map((id, i) => {
    const c = input.chunkMap.get(id);
    return { idx: c?.idx ?? i, content: c?.content ?? "" };
  });
  const userPrompt = buildGenerationUserPrompt(blocks, input.question);

  const { text, receipt } = await runCostedOperation({
    controller: input.costController,
    operationKey:
      input.operationKey ?? `generation:${input.genModel}:${input.question}`,
    kind: "generation",
    call: (maxCostUsd) =>
      input.gateway.chat({
        model: input.genModel,
        messages: [
          { role: "system", content: RAG_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1024,
        maxCostUsd,
      }),
  });
  await input.onCost?.(receipt.costUsd);

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
