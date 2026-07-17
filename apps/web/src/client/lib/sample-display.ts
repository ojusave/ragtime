import type { SampleQuestion } from "../hooks/types";

const FRIENDLY_STARTERS = [/vitamin b12/i];

/** Put the clearest demo question first without changing the source dataset. */
export function prioritizeSampleQuestions(samples: SampleQuestion[]): SampleQuestion[] {
  return samples
    .map((sample, index) => ({ sample, index }))
    .sort((a, b) => {
      const rank = (text: string) => {
        const found = FRIENDLY_STARTERS.findIndex((pattern) => pattern.test(text));
        return found === -1 ? FRIENDLY_STARTERS.length : found;
      };
      return rank(a.sample.text) - rank(b.sample.text) || a.index - b.index;
    })
    .map(({ sample }) => sample);
}
