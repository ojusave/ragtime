import type { Extractor } from "../ports.js";

export const htmlTextExtractor: Extractor = {
  async extract({ sourceType, rawText, sourceUri }) {
    if (sourceType === "upload") {
      if (!rawText?.trim()) throw new Error("No text content to ingest");
      return rawText;
    }
    if (!sourceUri) throw new Error("URL document missing source_uri");
    // REVIEW H1 (High, security): SSRF. This fetches an arbitrary caller-supplied URL
    // with default redirect-following — loopback, RFC1918, cloud metadata
    // (169.254.169.254), and public-URL→internal redirects all go through. There is no
    // scheme allowlist, no resolved-IP validation, no re-check after redirects, no body
    // size cap (res.text() buffers unbounded responses), and the raw URL (possibly with
    // query credentials) is embedded in the persisted error. Currently latent because the
    // corpora routes aren't registered (see H2), but must be fixed before they are
    // restored: validate scheme + resolved IPs (incl. after each redirect), stream with a
    // byte limit, and sanitize the URL in errors.
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
