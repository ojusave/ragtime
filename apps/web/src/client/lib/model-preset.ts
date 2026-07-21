import type { Catalog, CatalogModel } from "../hooks/types";

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
