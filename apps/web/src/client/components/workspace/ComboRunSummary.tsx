import { Group, RingProgress, SimpleGrid, Stack, Text } from "@mantine/core";
import { COPY, runStatusLabel } from "../../lib/copy";
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
  const total = run?.grid.length || run?.comboResults.length || 0;
  const complete = run?.grid.filter((g) => g.status === "complete").length ?? 0;
  const failed = run?.grid.filter((g) => g.status === "failed").length ?? 0;
  const best = run?.comboResults.reduce((max, c) => Math.max(max, c.avgScore ?? 0), 0);
  const status = run?.run.status ?? "idle";
  const statusColor =
    status === "complete"
      ? "green"
      : status === "failed"
        ? "red"
        : status === "running" || status === "ingesting"
          ? "indigo"
          : "gray";

  if (!run) return null;

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={0} className="run-summary pg-arena-card">
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
            {COPY.playground.elapsed(elapsedMs(run.run) / 1000)}
          </Text>
        </Stack>
      </Group>

      <Group gap="sm" className="run-summary-cell">
        <RingProgress
          size={36}
          thickness={4}
          sections={[
            {
              value: total ? (complete / total) * 100 : 0,
              color: failed ? "red" : "green",
            },
          ]}
          label={
            <Text ta="center" size="xs">
              {complete}/{total || 0}
            </Text>
          }
        />
        <Stack gap={1}>
          <Text size="sm" fw={600}>
            {COPY.playground.progress(complete, total)}
          </Text>
          <Text size="xs" c="dimmed">
            {failed ? `${failed} failed` : `${total} combos`}
          </Text>
        </Stack>
      </Group>

      <Stack gap={2} className="run-summary-cell" justify="center">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          Spend
        </Text>
        <Text size="sm" fw={600}>
          {COPY.playground.spend(
            Number(run.run.totalCostUsd).toFixed(2),
            Number(run.run.budgetUsd).toFixed(2)
          )}
        </Text>
      </Stack>

      <Stack gap={2} className="run-summary-cell" justify="center">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {COPY.playground.bestScore}
        </Text>
        <Text size="xl" fw={700}>
          {best > 0 ? best.toFixed(1) : "—"}
        </Text>
      </Stack>
    </SimpleGrid>
  );
}
