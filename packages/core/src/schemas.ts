import { z } from "zod";

const MAX_MODEL_OPTIONS = 50;
const MAX_MODEL_ID_LENGTH = 200;
export const MAX_EXPLICIT_QUESTIONS = 1_000;
const WEIGHT_SUM_TOLERANCE = 1e-6;

const unique = <T>(values: T[]): T[] => [...new Set(values)];
const modelIdSchema = z.string().min(1).max(MAX_MODEL_ID_LENGTH);

export const judgeWeightsSchema = z
  .object({
    faithfulness: z.number().min(0).max(1).default(0.4),
    correctness: z.number().min(0).max(1).default(0.4),
    completeness: z.number().min(0).max(1).default(0.2),
  })
  .refine(
    (weights) =>
      Math.abs(
        weights.faithfulness + weights.correctness + weights.completeness - 1
      ) <= WEIGHT_SUM_TOLERANCE,
    { message: "Judge weights must sum to 1." }
  );

export const runConfigSchema = z.object({
  corpusId: z.string().uuid(),
  name: z.string().min(1).max(200),
  embeddingModels: z
    .array(modelIdSchema)
    .min(1)
    .max(MAX_MODEL_OPTIONS)
    .transform(unique),
  rerankModels: z
    .array(modelIdSchema.nullable())
    .min(1)
    .max(MAX_MODEL_OPTIONS)
    .transform(unique),
  genModels: z
    .array(modelIdSchema)
    .min(1)
    .max(MAX_MODEL_OPTIONS)
    .transform(unique),
  questionIds: z.union([
    z.literal("all"),
    z
      .array(z.string().uuid())
      .min(1)
      .max(MAX_EXPLICIT_QUESTIONS)
      .transform(unique),
  ]),
  retrieveK: z.number().int().min(1).max(100).default(20),
  finalK: z.number().int().min(1).max(50).default(5),
  relevanceThreshold: z.number().min(0).max(1).optional(),
  judgeModel: modelIdSchema.optional(),
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
