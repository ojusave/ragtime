import { createOpenRouterGateway } from "@ragtime/gateway-openrouter";
import { createFakeGateway } from "@ragtime/gateway-fake";
import {
  htmlTextExtractor,
  recursiveChunker,
  rubricScorer,
  type ModelGateway,
  type PipelinePorts,
} from "@ragtime/core";
import { getDb, createPgVectorStore } from "@ragtime/db";

export function createGateway(): ModelGateway {
  if (process.env.MODEL_GATEWAY === "fake") {
    return createFakeGateway();
  }
  return createOpenRouterGateway();
}

export function wirePorts(): PipelinePorts {
  const db = getDb();
  return {
    gateway: createGateway(),
    vectorStore: createPgVectorStore(db),
    extractor: htmlTextExtractor,
    chunker: recursiveChunker,
    scorer: rubricScorer,
  };
}
