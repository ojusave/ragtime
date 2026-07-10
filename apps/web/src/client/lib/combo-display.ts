import type { ComboResult } from "@ragtime/core";

export type ComboModels = {
  search: string;
  rerank: string | null;
  answer: string;
};

/** Short display name from an OpenRouter-style model id. */
export function shortModelName(id: string): string {
  const slug = id.split("/").pop() ?? id;
  return slug
    .replace(/-instruct.*$/i, "")
    .replace(/:free$/i, "")
    .replace(/-v\d+(\.\d+)?$/i, "");
}

export function comboModels(combo: ComboResult): ComboModels {
  return {
    search: shortModelName(combo.embeddingModel),
    rerank: combo.rerankModel ? shortModelName(combo.rerankModel) : null,
    answer: shortModelName(combo.genModel),
  };
}

export function comboDurationMs(
  combo: ComboResult,
  status: string
): number {
  if (status === "pending") return 0;
  if (status === "running") return combo.p50GenerationLatencyMs ?? 3000;
  return combo.p50GenerationLatencyMs ?? 6000;
}
