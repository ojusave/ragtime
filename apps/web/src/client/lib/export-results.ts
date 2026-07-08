import type { ComboResult } from "@ragtime/core";

/** Download combo leaderboard as CSV. */
export function downloadResultsCsv(runName: string, rows: ComboResult[]) {
  const header = [
    "model_setup",
    "quality_score",
    "cost_per_question_usd",
    "typical_speed_ms",
    "slowest_5_percent_ms",
    "failed_tests",
    "self_scored",
  ];
  const lines = rows.map((c) =>
    [
      c.label ?? c.genModel,
      c.avgScore?.toFixed(4) ?? "",
      c.avgCostPerQuestion?.toFixed(6) ?? "",
      c.p50GenerationLatencyMs?.toFixed(0) ?? "",
      c.p95GenerationLatencyMs?.toFixed(0) ?? "",
      String(c.failedCount),
      c.selfJudged ? "yes" : "no",
    ].join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${runName.replace(/[^\w.-]+/g, "_")}-results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
