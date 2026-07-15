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

    // REVIEW M2 (Medium): the catch-all below conflates provider failure with parse
    // failure. A billed-but-malformed first response triggers a second billed call whose
    // receipt replaces (not adds to) the first, so recorded cost/latency understate real
    // spend — and permanent errors (401/400) are retried too. Let provider errors
    // propagate, retry only on parse failure, and combine both receipts when a retry
    // happens.
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
  // REVIEW M10 (Medium): no range/finiteness validation — Number(undefined) is NaN, and
  // negative or >10 values pass straight into computeOverallScore and are persisted as
  // the trial's overallScore. Validate with a strict zod schema
  // (z.number().finite().min(0).max(10)) and treat failure as a parse error; also
  // constrain judgeWeights to sum to 1 (or normalize).
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
