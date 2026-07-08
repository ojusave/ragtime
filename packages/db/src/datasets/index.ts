import scifactSeed from "./scifact-seed.json" with { type: "json" };
import { PIGEON_DOCS, PIGEON_QUESTIONS } from "../seed-data.js";
import type { SeedCorpus } from "./types.js";

export type { SeedDoc, SeedQuestion, SeedCorpus } from "./types.js";

/** Primary demo: BEIR SciFact subset (100 abstracts, 13 claims). */
export const SCIFACT_CORPUS: SeedCorpus = scifactSeed as SeedCorpus;

/** Legacy tiny corpus for offline / fake-gateway smoke tests. */
export const PIGEON_CORPUS: SeedCorpus = {
  corpusName: "Pigeon docs",
  description:
    "Fictional Pigeon message-delivery API docs (12 short pages). Fine for smoke tests; retrieval overlap is high.",
  documents: PIGEON_DOCS,
  questions: PIGEON_QUESTIONS,
};

/** Corpora inserted by `pnpm seed` (SciFact first = default bake-off target). */
export const SEED_CORPORA: SeedCorpus[] = [SCIFACT_CORPUS, PIGEON_CORPUS];
