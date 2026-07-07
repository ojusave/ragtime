import {
  JUDGE_PROMPT,
  buildJudgeUserPrompt,
} from "../prompts.js";
import type { ModelGateway, Scorer, ScorerInput } from "../ports.js";
import type { TrialStageJudge } from "../schemas.js";

export const rubricScorer: Scorer = {
  async score(input: ScorerInput) {
    const userContent = buildJudgeUserPrompt(
      input.context,
      input.question,
      input.referenceAnswer,
      input.candidate
    );

    let text: string;
    let receipt;
    try {
      const result = await input.gateway.chat({
        model: input.judgeModel,
        messages: [
          { role: "system", content: JUDGE_PROMPT },
          { role: "user", content: userContent },
        ],
      });
      text = result.text;
      receipt = result.receipt;
      parseJudgeJson(text);
    } catch {
      const retry = await input.gateway.chat({
        model: input.judgeModel,
        messages: [
          { role: "system", content: JUDGE_PROMPT },
          { role: "user", content: userContent + "\n\nRespond with JSON only." },
        ],
      });
      text = retry.text;
      receipt = retry.receipt;
    }

    const parsed = parseJudgeJson(text);
    return {
      ...parsed,
      receipt,
    };
  },
};

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
  return {
    faithfulness: Number(parsed.faithfulness),
    correctness: Number(parsed.correctness),
    completeness: Number(parsed.completeness),
    rationale: String(parsed.rationale ?? ""),
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
  onCost?: (usd: number) => void;
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
  });
  input.onCost?.(result.receipt.costUsd);

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
