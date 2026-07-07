import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import {
  CHUNK_OVERLAP_RATIO,
  CHUNK_TARGET_TOKENS,
  estimateTokens,
} from "../prompts.js";
import type { Chunker } from "../ports.js";

export const recursiveChunker: Chunker = {
  async chunk(text: string) {
    const chunkSize = CHUNK_TARGET_TOKENS * 4;
    const overlap = Math.floor(chunkSize * CHUNK_OVERLAP_RATIO);
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap: overlap,
    });
    const parts = await splitter.splitText(text);
    return parts.map((content, idx) => ({
      idx,
      content,
      tokenEstimate: estimateTokens(content),
    }));
  },
};
