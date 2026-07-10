import type { ComboResult } from "@ragtime/core";

export type SampleQuestion = {
  id: string;
  text: string;
  referenceAnswer: string;
};

export type DemoInfo = {
  ready: boolean;
  corpusId: string | null;
  documentCount: number;
  readyDocumentCount?: number;
  questionCount: number;
  name?: string;
};

export type Catalog = {
  embedding: { id: string; name: string }[];
  rerank: { id: string; name: string }[];
  chat: { id: string; name: string }[];
};

export type GridCell = {
  trialId: string;
  comboId: string;
  questionId: string;
  status: string;
  overallScore: string | null;
  attempts: number;
};

export type RunPayload = {
  run: {
    id: string;
    corpusId: string;
    status: string;
    name: string;
    budgetUsd: string;
    totalCostUsd: string;
    startedAt: string | null;
    finishedAt?: string | null;
    createdAt: string;
    error: string | null;
  };
  comboResults: ComboResult[];
  grid: GridCell[];
  questions: { id: string; text: string }[];
  phases: {
    documents: { total: number; ready: number };
    embeddings: { model: string; total: number; done: number }[];
    trials: Record<string, number>;
  };
};

export type TrialDetail = {
  trial: {
    answer: string | null;
    stages: import("@ragtime/core").TrialStages;
    overallScore: string | null;
    status: string;
  };
  question: { text: string; referenceAnswer: string };
  combo: { embeddingModel: string; rerankModel: string | null; genModel: string };
  chunks: { id: string; idx: number; content: string }[];
};
