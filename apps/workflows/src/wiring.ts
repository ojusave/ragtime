import { createOpenRouterGateway } from "@ragtime/gateway-openrouter";
import {
  htmlTextExtractor,
  recursiveChunker,
  rubricScorer,
  type ModelGateway,
  type PipelinePorts,
} from "@ragtime/core";
import { getDb, createPgVectorStore } from "@ragtime/db";

/**
 * Provider swap seam. To use another platform, add an adapter package that
 * implements ModelGateway and return it from a new case here. Selection is
 * driven by MODEL_GATEWAY and defaults to OpenRouter. Unknown values fail fast
 * so a misconfigured deploy never silently serves the wrong provider.
 */
export function createGateway(): ModelGateway {
  const provider = process.env.MODEL_GATEWAY ?? "openrouter";
  switch (provider) {
    case "openrouter":
      return createOpenRouterGateway();
    default:
      throw new Error(`Unknown MODEL_GATEWAY: ${provider}`);
  }
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
