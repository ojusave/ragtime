import { Badge, Group, Progress, Stack, Table, Text } from "@mantine/core";
import type { ComboResult } from "@ragtime/core";
import { COPY } from "../../lib/copy";
import { comboModels } from "../../lib/combo-display";
import { scorePercent } from "../../lib/score-display";
import type { GridCell } from "../../hooks/types";

type Props = {
  combos: ComboResult[];
  grid: GridCell[];
  selectedTrialId: string | null;
  onSelect: (trialId: string) => void;
};

function comboStatus(cells: GridCell[]): { label: string; color: string } {
  if (cells.some((c) => c.status === "running")) return { label: "Running", color: "indigo" };
  if (cells.length > 0 && cells.every((c) => c.status === "complete"))
    return { label: "Complete", color: "green" };
  if (cells.some((c) => c.status === "failed")) return { label: "Some failed", color: "red" };
  return { label: "Pending", color: "gray" };
}

/** Per-setup progress across every question in a multi-question run. */
export default function ComboProgressGrid({ combos, grid, selectedTrialId, onSelect }: Props) {
  const byCombo = new Map<string, GridCell[]>();
  for (const cell of grid) {
    const list = byCombo.get(cell.comboId) ?? [];
    list.push(cell);
    byCombo.set(cell.comboId, list);
  }

  return (
    <Stack gap="sm" className="combo-progress-grid pg-arena-card">
      <Stack gap={0}>
        <Text className="pg-section-title">{COPY.app.progressTitle}</Text>
        <Text size="xs" c="dimmed">
          {COPY.app.progressHint}
        </Text>
      </Stack>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{COPY.results.columns.setup}</Table.Th>
            <Table.Th>Progress</Table.Th>
            <Table.Th>{COPY.app.judgeScore}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {combos.map((combo) => {
            const cells = byCombo.get(combo.comboId) ?? [];
            const total = cells.length;
            const done = cells.filter(
              (c) => c.status === "complete" || c.status === "failed"
            ).length;
            const status = comboStatus(cells);
            const models = comboModels(combo);
            const avgScore = scorePercent(combo.avgScore);
            const firstTrial = cells[0]?.trialId;
            const selected = cells.some((c) => c.trialId === selectedTrialId);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <Table.Tr
                key={combo.comboId}
                onClick={() => firstTrial && onSelect(firstTrial)}
                style={{
                  cursor: firstTrial ? "pointer" : "default",
                  background: selected ? "var(--pg-accent-soft)" : undefined,
                }}
              >
                <Table.Td>
                  <Group gap={4} wrap="wrap">
                    <Text size="sm" fw={600} lineClamp={1}>
                      {models.search} / {models.rerank ?? "no rerank"} / {models.answer}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Badge color={status.color} variant="light" size="sm">
                        {status.label}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {COPY.app.progressComplete(done, total)}
                      </Text>
                    </Group>
                    <Progress value={pct} size="sm" color={status.color} />
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {avgScore ?? "—"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
