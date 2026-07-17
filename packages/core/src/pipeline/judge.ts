import {
  JUDGE_PROMPT,
  buildJudgeUserPrompt,
} from "../prompts.js";
import type {
  CostController,
  ModelGateway,
  Receipt,
  Scorer,
  ScorerInput,
} from "../ports.js";
import type { TrialStageJudge } from "../schemas.js";
import { runCostedOperation } from "./cost.js";

export const rubricScorer: Scorer = {
  async score(input: ScorerInput) {
    const userContent = buildJudgeUserPrompt(
      input.context,
      input.question,
      input.referenceAnswer,
      input.candidate
    );

    const operationPrefix = input.operationPrefix ?? `judge:${input.judgeModel}`;
    const first = await runCostedOperation({
      controller: input.costController,
      operationKey: `${operationPrefix}:attempt:1`,
      kind: "judge",
      call: (maxCostUsd) =>
        input.gateway.chat({
          model: input.judgeModel,
          messages: [
            { role: "system", content: JUDGE_PROMPT },
            { role: "user", content: userContent },
          ],
          maxTokens: 768,
          maxCostUsd,
        }),
    });

    try {
      return {
        ...parseJudgeJson(first.text),
        receipt: first.receipt,
      };
    } catch {
      const retry = await runCostedOperation({
        controller: input.costController,
        operationKey: `${operationPrefix}:attempt:2`,
        kind: "judge",
        call: (maxCostUsd) =>
          input.gateway.chat({
            model: input.judgeModel,
            messages: [
              { role: "system", content: JUDGE_PROMPT },
              { role: "user", content: userContent + "\n\nRespond with JSON only." },
            ],
            maxTokens: 768,
            maxCostUsd,
          }),
      });
      return {
        ...parseJudgeJson(retry.text),
        receipt: combineReceipts(first.receipt, retry.receipt),
      };
    }
  },
};

function combineReceipts(first: Receipt, second: Receipt): Receipt {
  return {
    latencyMs: first.latencyMs + second.latencyMs,
    costUsd: first.costUsd + second.costUsd,
    costUnknown: Boolean(first.costUnknown || second.costUnknown),
    tokens: {
      input: (first.tokens?.input ?? 0) + (second.tokens?.input ?? 0),
      output: (first.tokens?.output ?? 0) + (second.tokens?.output ?? 0),
    },
    provider: second.provider ?? first.provider,
    generationId: second.generationId ?? first.generationId,
  };
}

export function parseJudgeJson(raw: string): {
  faithfulness: number;
  correctness: number;
  completeness: number;
  rationale: string;
} {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenceMatch ? fenceMatch[1]!.trim() : trimmed;
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  const score = (value: unknown, name: string) => {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 10
    ) {
      throw new Error(`Invalid judge score: ${name}`);
    }
    return value;
  };
  if (typeof parsed.rationale !== "string") {
    throw new Error("Invalid judge rationale");
  }
  return {
    faithfulness: score(parsed.faithfulness, "faithfulness"),
    correctness: score(parsed.correctness, "correctness"),
    completeness: score(parsed.completeness, "completeness"),
    rationale: parsed.rationale,
  };
}

export type JudgeInput = {
  scorer: Scorer;
  gateway: ModelGateway;
  judgeModel: string;
  context: string;
  question: string;
  referenceAnswer: string;
  candidate: string;
  costController?: CostController;
  operationPrefix?: string;
  onCost?: (usd: number) => Promise<void>;
};

export async function judgeAnswer(
  input: JudgeInput
): Promise<TrialStageJudge> {
  const result = await input.scorer.score({
    gateway: input.gateway,
    judgeModel: input.judgeModel,
    context: input.context,
    question: input.question,
    referenceAnswer: input.referenceAnswer,
    candidate: input.candidate,
    costController: input.costController,
    operationPrefix: input.operationPrefix,
  });
  await input.onCost?.(result.receipt.costUsd);

  return {
    faithfulness: result.faithfulness,
    correctness: result.correctness,
    completeness: result.completeness,
    rationale: result.rationale,
    latencyMs: result.receipt.latencyMs,
    costUsd: result.receipt.costUsd,
    costUnknown: result.receipt.costUnknown,
    judgeModel: input.judgeModel,
  };
}
