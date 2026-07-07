import type { Extractor } from "../ports.js";

export const htmlTextExtractor: Extractor = {
  async extract({ sourceType, rawText, sourceUri }) {
    if (sourceType === "upload") {
      if (!rawText?.trim()) throw new Error("No text content to ingest");
      return rawText;
    }
    if (!sourceUri) throw new Error("URL document missing source_uri");
    const { convert } = await import("html-to-text");
    const res = await fetch(sourceUri, {
      headers: { "User-Agent": "RAGtime/1.0 (document ingestion)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${sourceUri}`);
    const html = await res.text();
    return convert(html, { wordwrap: false });
  },
};
