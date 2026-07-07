import type { Extractor, Chunker } from "../ports.js";

export type IngestInput = {
  extractor: Extractor;
  chunker: Chunker;
  sourceType: "upload" | "url";
  rawText?: string | null;
  sourceUri?: string | null;
};

export async function extractAndChunk(input: IngestInput) {
  const text = await input.extractor.extract({
    sourceType: input.sourceType,
    rawText: input.rawText,
    sourceUri: input.sourceUri,
  });
  const chunks = await input.chunker.chunk(text);
  return { text, chunks };
}
