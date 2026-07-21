import type { Catalog, CatalogModel, Setup } from "../hooks/types";

let setupSeq = 0;
/** Stable client-only id for a setup card; never sent to the server. */
export function newSetupId(): string {
  setupSeq += 1;
  return `setup-${Date.now().toString(36)}-${setupSeq}`;
}

/** Numeric price for sorting; missing or invalid prices sort last. */
export function priceNumber(value?: string): number {
  if (value == null || value === "") return Number.POSITIVE_INFINITY;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

/** Sort by a pricing field ascending with a deterministic alphabetical tiebreak. */
export function sortByPrice(
  models: CatalogModel[],
  key: "prompt" | "completion"
): CatalogModel[] {
  return [...models].sort((a, b) => {
    const pa = priceNumber(a.pricing?.[key]);
    const pb = priceNumber(b.pricing?.[key]);
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
  });
}

export type StarterPreset = {
  embeddingModel: string;
  budgetGenModel: string;
  midGenModel: string;
  premiumGenModel: string;
};

/**
 * Derives a starter preset from live catalog data only (no hardcoded slugs):
 * cheapest embedding by prompt price, plus budget, mid, and premium chat models
 * by completion price. Ties break alphabetically for determinism.
 */
export function deriveStarterPreset(
  catalog: Catalog | undefined
): StarterPreset | null {
  if (!catalog) return null;
  const embeddings = sortByPrice(catalog.embedding, "prompt");
  const chats = sortByPrice(catalog.chat, "completion");
  if (embeddings.length === 0 || chats.length === 0) return null;

  const n = chats.length;
  return {
    embeddingModel: embeddings[0]!.id,
    budgetGenModel: chats[0]!.id,
    midGenModel: chats[Math.floor(n / 2)]!.id,
    premiumGenModel: chats[n - 1]!.id,
  };
}

/**
 * Two starter setups the user can run immediately: the cheapest embedding paired
 * with a budget answer model and a mid-tier answer model, both without reranking.
 */
export function deriveStarterSetups(catalog: Catalog | undefined): Setup[] {
  const preset = deriveStarterPreset(catalog);
  if (!preset) return [];
  const genModels = [...new Set([preset.budgetGenModel, preset.midGenModel])];
  return genModels.map((genModel) => ({
    id: newSetupId(),
    embeddingModel: preset.embeddingModel,
    rerankModel: null,
    genModel,
  }));
}

/** A blank setup seeded from the first available model of each kind. */
export function blankSetup(catalog: Catalog | undefined): Setup {
  return {
    id: newSetupId(),
    embeddingModel: catalog?.embedding[0]?.id ?? "",
    rerankModel: null,
    genModel: catalog?.chat[0]?.id ?? "",
  };
}
