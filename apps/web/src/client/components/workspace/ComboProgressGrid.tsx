import { Badge, Box, Group, Stack, Table, Text } from "@mantine/core";
import type { ComboResult } from "@ragtime/core";
import { COPY, TEST_STATUS_LABEL } from "../../lib/copy";
import type { GridCell } from "../../hooks/types";

type Props = {
  combos: ComboResult[];
  grid: GridCell[];
  selectedTrialId: string | null;
  onSelect: (trialId: string) => void;
};

export default function ComboProgressGrid({ combos, grid, selectedTrialId, onSelect }: Props) {
  const lookup = new Map(grid.map((g) => [g.comboId, g]));

  return (
    <Stack gap="sm" className="combo-progress-grid">
      <Text className="pg-section-title">{COPY.playground.combos}</Text>
      <Table highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{COPY.results.columns.setup}</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>{COPY.results.columns.quality}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {combos.map((combo) => {
            const cell = lookup.get(combo.comboId);
            const selected = cell?.trialId === selectedTrialId;
            return (
              <Table.Tr
                key={combo.comboId}
                onClick={() => cell && onSelect(cell.trialId)}
                style={{
                  cursor: cell ? "pointer" : "default",
                  background: selected ? "var(--rag-subtle)" : undefined,
                }}
              >
                <Table.Td>
                  <Text size="sm" fw={600} lineClamp={2}>
                    {combo.label}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={
                      cell?.status === "complete"
                        ? "green"
                        : cell?.status === "failed"
                          ? "red"
                          : cell?.status === "running"
                            ? "blue"
                            : "gray"
                    }
                    variant="light"
                  >
                    {TEST_STATUS_LABEL[cell?.status ?? "pending"] ?? "Waiting"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {cell?.overallScore ? Number(cell.overallScore).toFixed(1) : "—"}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      <Group gap="md">
        {[
          ["gray", COPY.grid.legendPending],
          ["blue", COPY.grid.legendRunning],
          ["indigo", COPY.grid.legendHigh],
          ["red", COPY.grid.legendFailed],
        ].map(([color, label]) => (
          <Group gap={6} key={label}>
            <Box
              w={12}
              h={12}
              style={{
                borderRadius: 2,
                background:
                  color === "gray"
                    ? "var(--mantine-color-gray-3)"
                    : color === "blue"
                      ? "var(--mantine-color-blue-3)"
                      : color === "indigo"
                        ? "var(--mantine-color-indigo-5)"
                        : "var(--mantine-color-red-4)",
              }}
            />
            <Text size="xs" c="dimmed">
              {label}
            </Text>
          </Group>
        ))}
      </Group>
    </Stack>
  );
}
