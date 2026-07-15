import {
  computeOverallScore,
  type JudgeWeights,
  type TrialStages,
} from "../schemas.js";
import type { PipelinePorts } from "../ports.js";
import { embedQuery, retrieveCandidates } from "./retrieve.js";
import { rerankCandidates, topKByScore } from "./rerank.js";
import { generateAnswer } from "./generate.js";
import { judgeAnswer } from "./judge.js";

export type RunTrialPipelineInput = {
  ports: PipelinePorts;
  runId: string;
  corpusId: string;
  questionId: string;
  questionText: string;
  referenceAnswer: string;
  embeddingModel: string;
  rerankModel: string | null;
  genModel: string;
  retrieveK: number;
  finalK: number;
  relevanceThreshold?: number | null;
  judgeModel: string;
  judgeWeights?: JudgeWeights;
  existingStages?: TrialStages;
  existingAnswer?: string | null;
  // REVIEW C1 (Critical): a void callback forces callers into fire-and-forget cost
  // recording. Make this `(usd: number) => Promise<void>` and await it at every call
  // site — or better, a budget port the pipeline must reserve against before each paid
  // stage.
  onCost?: (usd: number) => void;
};

export type RunTrialPipelineResult = {
  stages: TrialStages;
  answer: string;
  overallScore: number;
};

export async function runTrialPipeline(
  input: RunTrialPipelineInput
): Promise<RunTrialPipelineResult> {
  const { ports } = input;
  // REVIEW C3 (Critical): `stages` is resume-aware but purely in-memory — nothing is
  // persisted until the caller writes the whole object after judge succeeds. Any failure
  // mid-pipeline discards completed (billed) stages, so retries re-bill rerank/generation.
  // Add a per-stage checkpoint hook (e.g. onStageComplete: (name, value) => Promise<void>)
  // the workflow can use to save each stage as it finishes.
  let stages: TrialStages = { ...(input.existingStages ?? {}) };

  if (!stages.retrieval) {
    const { vector, receipt } = await embedQuery({
      gateway: ports.gateway,
      vectorStore: ports.vectorStore,
      runId: input.runId,
      questionId: input.questionId,
      questionText: input.questionText,
      embeddingModel: input.embeddingModel,
      onCost: input.onCost,
    });
    stages.retrieval = await retrieveCandidates({
      vectorStore: ports.vectorStore,
      corpusId: input.corpusId,
      embeddingModel: input.embeddingModel,
      queryVector: vector,
      retrieveK: input.retrieveK,
    });
    if (receipt) {
      stages.retrieval.costUsd = receipt.costUsd;
      stages.retrieval.tokens = receipt.tokens;
      stages.retrieval.latencyMs += receipt.latencyMs;
    }
  }

  let keptChunkIds: string[];

  if (!stages.rerank && input.rerankModel) {
    const chunkMap = await ports.vectorStore.getChunksByIds(stages.retrieval!.chunkIds);
    const docs = stages.retrieval!.chunkIds.map((id) => chunkMap.get(id)?.content ?? "");
    const { stage, keptChunkIds: kept } = await rerankCandidates({
      gateway: ports.gateway,
      rerankModel: input.rerankModel,
      query: input.questionText,
      chunkIds: stages.retrieval!.chunkIds,
      chunkContents: docs,
      finalK: input.finalK,
      relevanceThreshold: input.relevanceThreshold,
      onCost: input.onCost,
    });
    stages.rerank = stage;
    keptChunkIds = kept;
  } else if (stages.rerank) {
    keptChunkIds = stages.rerank.keptChunkIds;
  } else {
    keptChunkIds = topKByScore(
      stages.retrieval!.chunkIds,
      stages.retrieval!.scores,
      input.finalK
    );
  }

  let answer = input.existingAnswer ?? "";

  if (!stages.generation) {
    const chunkMap = await ports.vectorStore.getChunksByIds(keptChunkIds);
    const gen = await generateAnswer({
      gateway: ports.gateway,
      genModel: input.genModel,
      question: input.questionText,
      keptChunkIds,
      chunkMap,
      onCost: input.onCost,
    });
    stages.generation = gen.stage;
    answer = gen.answer;
  } else {
    keptChunkIds = stages.generation.contextChunkIds;
  }

  if (!stages.judge) {
    const chunkMap = await ports.vectorStore.getChunksByIds(
      stages.generation?.contextChunkIds ?? keptChunkIds
    );
    const context = (stages.generation?.contextChunkIds ?? keptChunkIds)
      .map((id) => chunkMap.get(id)?.content ?? "")
      .join("\n\n");

    stages.judge = await judgeAnswer({
      scorer: ports.scorer,
      gateway: ports.gateway,
      judgeModel: input.judgeModel,
      context,
      question: input.questionText,
      referenceAnswer: input.referenceAnswer,
      candidate: answer,
      onCost: input.onCost,
    });
  }

  const weights = input.judgeWeights ?? {
    faithfulness: 0.4,
    correctness: 0.4,
    completeness: 0.2,
  };
  const overallScore = computeOverallScore(stages.judge!, weights);

  return { stages, answer, overallScore };
}

/** Same stages as runTrialPipeline, for the query inspector (no runId cache). */
export type InspectPipelineInput = Omit<
  RunTrialPipelineInput,
  "runId" | "questionId" | "referenceAnswer" | "existingStages" | "existingAnswer"
> & {
  query: string;
  referenceAnswer?: string;
  onStage?: (stage: string, data: unknown, receipt: unknown) => void;
};

export async function runInspectPipeline(input: InspectPipelineInput) {
  const fakeRunId = "inspect";
  const fakeQuestionId = "inspect-q";
  const result = await runTrialPipeline({
    ...input,
    runId: fakeRunId,
    questionId: fakeQuestionId,
    questionText: input.query,
    referenceAnswer: input.referenceAnswer ?? "",
    existingStages: {},
  });
  return result;
}
