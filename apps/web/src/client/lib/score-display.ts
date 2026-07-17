export type ScoreInput = number | string | null | undefined;

export type ScoreTone = "high" | "medium" | "low" | "neutral";

type TrialScore = {
  status: string;
  overallScore: ScoreInput;
};

export type RunScoreSummary = {
  overallPercent: number | null;
  earnedPoints: number;
  possiblePoints: number;
  scoredCount: number;
  completeCount: number;
  failedCount: number;
  totalCount: number;
};

export function scoreOnTen(value: ScoreInput): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(10, Math.max(0, numeric));
}

export function scorePercent(value: ScoreInput, digits = 0): number | null {
  const score = scoreOnTen(value);
  if (score == null) return null;
  return Number((score * 10).toFixed(digits));
}

export function scoreTone(value: number | null): ScoreTone {
  if (value == null) return "neutral";
  if (value >= 80) return "high";
  if (value >= 60) return "medium";
  return "low";
}

export function summarizeTrialScores(trials: TrialScore[]): RunScoreSummary {
  const completed = trials.filter((trial) => trial.status === "complete");
  const scores = completed
    .map((trial) => scoreOnTen(trial.overallScore))
    .filter((score): score is number => score != null);
  const earnedPoints = scores.reduce((sum, score) => sum + score, 0);

  return {
    overallPercent: scores.length ? (earnedPoints / scores.length) * 10 : null,
    earnedPoints,
    possiblePoints: scores.length * 10,
    scoredCount: scores.length,
    completeCount: completed.length,
    failedCount: trials.filter((trial) => trial.status === "failed").length,
    totalCount: trials.length,
  };
}

export function formatPoints(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}
