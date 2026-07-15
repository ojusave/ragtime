import { z } from "zod";

// REVIEW M10 (Medium): weights are individually bounded but their sum isn't constrained
// to 1, so overallScore's scale varies with the config. Add a .refine on the sum (within
// a tolerance) or normalize explicitly.
export const judgeWeightsSchema = z.object({
  faithfulness: z.number().min(0).max(1).default(0.4),
  correctness: z.number().min(0).max(1).default(0.4),
  completeness: z.number().min(0).max(1).default(0.2),
});

export const runConfigSchema = z.object({
  corpusId: z.string().uuid(),
  name: z.string().min(1).max(200),
  // REVIEW M9 (Medium): no max length on the arrays or the model strings, and no dedup —
  // a caller can submit huge duplicate arrays whose combo product is built and written to
  // the DB before the trial limit check runs. Cap array sizes (.max), bound string length
  // (e.g. .max(200)), and dedupe before computing the product.
  embeddingModels: z.array(z.string().min(1)).min(1),
  rerankModels: z.array(z.string().nullable()).min(1),
  genModels: z.array(z.string().min(1)).min(1),
  questionIds: z.union([z.literal("all"), z.array(z.string().uuid()).min(1)]),
  retrieveK: z.number().int().min(1).max(100).default(20),
  finalK: z.number().int().min(1).max(50).default(5),
  relevanceThreshold: z.number().min(0).max(1).optional(),
  judgeModel: z.string().min(1).optional(),
  judgeWeights: judgeWeightsSchema.optional(),
  budgetUsd: z.number().positive().optional(),
});

export type RunConfig = z.infer<typeof runConfigSchema>;
export type JudgeWeights = z.infer<typeof judgeWeightsSchema>;

export type TrialStageRetrieval = {
  chunkIds: string[];
  scores: number[];
  latencyMs: number;
  costUsd: number;
  tokens?: { input?: number; output?: number };
};

export type TrialStageRerank = {
  order: number[];
  scores: number[];
  keptChunkIds: string[];
  latencyMs: number;
  costUsd: number;
};

export type TrialStageGeneration = {
  contextChunkIds: string[];
  latencyMs: number;
  costUsd: number;
  costUnknown?: boolean;
  tokens?: { input?: number; output?: number };
  provider?: string;
  generationId?: string;
};

export type TrialStageJudge = {
  faithfulness: number;
  correctness: number;
  completeness: number;
  rationale: string;
  latencyMs: number;
  costUsd: number;
  costUnknown?: boolean;
  judgeModel: string;
};

export type TrialStages = {
  retrieval?: TrialStageRetrieval;
  rerank?: TrialStageRerank;
  generation?: TrialStageGeneration;
  judge?: TrialStageJudge;
};

export type ComboResult = {
  comboId: string;
  embeddingModel: string;
  rerankModel: string | null;
  genModel: string;
  avgScore: number | null;
  avgCostPerQuestion: number | null;
  p50GenerationLatencyMs: number | null;
  p95GenerationLatencyMs: number | null;
  totalCostUsd: number | null;
  completeCount: number;
  failedCount: number;
  selfJudged: boolean;
  label?: string;
};

export type GridCell = {
  comboId: string;
  questionId: string;
  trialId: string;
  status: string;
  overallScore: number | null;
  attempts: number;
};

export function comboLabel(
  embedding: string,
  rerank: string | null,
  gen: string
): string {
  const short = (slug: string) => slug.split("/").pop() ?? slug;
  const r = rerank ? short(rerank) : "none";
  return `${short(embedding)} / ${r} / ${short(gen)}`;
}

export function computeOverallScore(
  judge: Pick<TrialStageJudge, "faithfulness" | "correctness" | "completeness">,
  weights: JudgeWeights = {
    faithfulness: 0.4,
    correctness: 0.4,
    completeness: 0.2,
  }
): number {
  return (
    weights.faithfulness * judge.faithfulness +
    weights.correctness * judge.correctness +
    weights.completeness * judge.completeness
  );
}
