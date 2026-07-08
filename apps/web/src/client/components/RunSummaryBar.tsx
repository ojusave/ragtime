import { Group, Progress, Text } from "@mantine/core";
import { COPY } from "../lib/copy";

type Props = {
  spent: string;
  budget: string;
  complete: number;
  total: number;
  docsReady?: number;
  docsTotal?: number;
};

/** Compact spend + test progress for run/results pages. */
export default function RunSummaryBar({
  spent,
  budget,
  complete,
  total,
  docsReady,
  docsTotal,
}: Props) {
  const pct = total ? (complete / total) * 100 : 0;
  return (
    <Group gap="lg" wrap="wrap" align="center">
      <Text size="sm">{COPY.run.spend(spent, budget)}</Text>
      {total > 0 && (
        <Group gap="xs" style={{ flex: 1, minWidth: 200 }}>
          <Progress value={pct} size="sm" style={{ flex: 1 }} aria-label="Test progress" />
          <Text size="xs" c="dimmed">
            {COPY.run.progress(complete, total)}
          </Text>
        </Group>
      )}
      {docsTotal != null && docsTotal > 0 && (
        <Text size="xs" c="dimmed">
          {COPY.run.docsIndexed(docsReady ?? 0, docsTotal)}
        </Text>
      )}
    </Group>
  );
}
