export type SeedDoc = { title: string; filename: string; content: string };

export type SeedQuestion = { text: string; referenceAnswer: string };

export type SeedCorpus = {
  corpusName: string;
  description: string;
  source?: string;
  documents: SeedDoc[];
  questions: SeedQuestion[];
};
