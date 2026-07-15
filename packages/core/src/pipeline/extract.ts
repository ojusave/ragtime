import type { Extractor } from "../ports.js";

const SAFE_FETCH_MODULE = "./safe-fetch.js";

export const htmlTextExtractor: Extractor = {
  async extract({ sourceType, rawText, sourceUri }) {
    if (sourceType === "upload") {
      if (!rawText?.trim()) throw new Error("No text content to ingest");
      return rawText;
    }
    if (!sourceUri) throw new Error("URL document missing source_uri");
    // This adapter is also re-exported from the browser-facing core entry point.
    // Keep Node's networking modules behind the server-only execution path.
    const { fetchPublicUrlText } = (await import(
      /* @vite-ignore */ SAFE_FETCH_MODULE
    )) as typeof import("./safe-fetch.js");
    const html = await fetchPublicUrlText(sourceUri);
    const { convert } = await import("html-to-text");
    return convert(html, { wordwrap: false });
  },
};
