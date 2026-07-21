import scifactSeed from "./scifact-seed.json" with { type: "json" };
import type { SeedCorpus } from "./types.js";

export type { SeedDoc, SeedQuestion, SeedCorpus } from "./types.js";

/** Primary demo: BEIR SciFact subset (100 abstracts, 13 claims). */
export const SCIFACT_CORPUS: SeedCorpus = scifactSeed as SeedCorpus;

/** Corpora inserted by `pnpm seed`. */
export const SEED_CORPORA: SeedCorpus[] = [SCIFACT_CORPUS];
