import { Group, RingProgress, SimpleGrid, Stack, Text } from "@mantine/core";
import { COPY, runStatusLabel } from "../../lib/copy";
import {
  formatPoints,
  scorePercent,
  scoreTone,
  summarizeTrialScores,
} from "../../lib/score-display";
import type { RunPayload } from "../../hooks/types";

function elapsedMs(run: RunPayload["run"] | undefined): number {
  if (!run?.startedAt && !run?.createdAt) return 0;
  const start = Date.parse(run.startedAt ?? run.createdAt);
  const end =
    run.status === "complete" || run.status === "failed" || run.status === "canceled"
      ? Date.parse(run.finishedAt ?? run.createdAt)
      : Date.now();
  return Math.max(0, end - start);
}

export default function ComboRunSummary({ run }: { run: RunPayload | undefined }) {
  if (!run) return null;

  const scores = summarizeTrialScores(run.grid);
  const best = run.comboResults.reduce<number | null>((max, combo) => {
    const score = scorePercent(combo.avgScore);
    if (score == null) return max;
    return max == null ? score : Math.max(max, score);
  }, null);
  const status = run.run.status;
  const statusColor =
    status === "complete"
      ? "green"
      : status === "failed"
        ? "red"
        : status === "running" || status === "ingesting"
          ? "indigo"
          : "gray";
  const roundedOverall =
    scores.overallPercent == null ? null : Math.round(scores.overallPercent);
  const tone = scoreTone(roundedOverall);

  return (
    <section className="run-summary pg-arena-card" aria-label="Run evaluation summary">
      <div className={`run-score-hero score-tone--${tone}`}>
        <Stack gap={2}>
          <Text className="run-score-label">Overall evaluation</Text>
          <Group gap={6} align="baseline" wrap="nowrap">
            <Text component="span" className="run-score-value">
              {roundedOverall ?? "—"}
            </Text>
            <Text component="span" className="run-score-scale">
              /100
            </Text>
          </Group>
        </Stack>
        <Stack gap={3} align="flex-end" className="run-score-proof">
          <Text fw={700} size="sm">
            {scores.scoredCount
              ? `${formatPoints(scores.earnedPoints)} / ${formatPoints(scores.possiblePoints)} points`
              : COPY.app.awaitingScores}
          </Text>
          <Text size="xs" c="dimmed">
            {COPY.app.setupsScored(scores.scoredCount, scores.totalCount)}
          </Text>
        </Stack>
      </div>

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing={0} className="run-summary-details">
        <Group gap="sm" className="run-summary-cell">
          <RingProgress
            size={36}
            thickness={4}
            sections={[{ value: 100, color: statusColor }]}
            label={
              <Text ta="center" size="xs">
                {status === "complete" ? "✓" : status === "running" || status === "ingesting" ? "…" : "·"}
              </Text>
            }
          />
          <Stack gap={1}>
            <Text size="sm" fw={600}>
              {runStatusLabel(status)}
            </Text>
            <Text size="xs" c="dimmed">
              {COPY.app.elapsed(elapsedMs(run.run) / 1000)}
            </Text>
          </Stack>
        </Group>

        <Group gap="sm" className="run-summary-cell">
          <RingProgress
            size={36}
            thickness={4}
            sections={[
              {
                value: scores.totalCount ? (scores.completeCount / scores.totalCount) * 100 : 0,
                color: scores.failedCount ? "red" : "green",
              },
            ]}
            label={
              <Text ta="center" size="xs">
                {scores.completeCount}/{scores.totalCount}
              </Text>
            }
          />
          <Stack gap={1}>
            <Text size="sm" fw={600}>
              {COPY.app.progress(scores.completeCount, scores.totalCount)}
            </Text>
            <Text size="xs" c="dimmed">
              {scores.failedCount
                ? `${scores.failedCount} failed`
                : COPY.app.setupCount(scores.totalCount)}
            </Text>
          </Stack>
        </Group>

        <Stack gap={2} className="run-summary-cell" justify="center">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Spend
          </Text>
          <Text size="sm" fw={600}>
            {COPY.app.spend(
              Number(run.run.totalCostUsd).toFixed(2),
              Number(run.run.budgetUsd).toFixed(2)
            )}
          </Text>
        </Stack>

        <Stack gap={2} className="run-summary-cell" justify="center">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {COPY.app.bestScore}
          </Text>
          <Group gap={3} align="baseline">
            <Text size="lg" fw={750}>
              {best ?? "—"}
            </Text>
            <Text size="xs" c="dimmed">
              /100
            </Text>
          </Group>
        </Stack>
      </SimpleGrid>
    </section>
  );
}
