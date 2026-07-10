import { Badge, Button, Card, Group, Stack, Table, Tabs, Text, Tooltip } from "@mantine/core";
import { ScatterChart } from "@mantine/charts";
import type { ComboResult } from "@ragtime/core";
import { COPY } from "../../lib/copy";
import { downloadResultsCsv } from "../../lib/export-results";

export default function ResultsPanel({
  runName,
  combos,
}: {
  runName: string;
  combos: ComboResult[];
}) {
  const sorted = [...combos].sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  const scatterSeries = [
    {
      name: "Setups",
      color: "blue.6",
      data: sorted
        .filter((c) => c.avgCostPerQuestion != null && c.avgScore != null)
        .map((c) => ({
          cost: c.avgCostPerQuestion!,
          quality: c.avgScore!,
          label: c.label ?? c.genModel,
        })),
    },
  ];

  if (!sorted.length) return null;

  return (
    <Card withBorder p="md" className="results-panel">
      <Group justify="space-between" mb="md">
        <Text className="rag-kicker">{COPY.results.leaderboard}</Text>
        <Button
          variant="light"
          size="compact-sm"
          onClick={() => downloadResultsCsv(runName, sorted)}
        >
          {COPY.results.exportCsv}
        </Button>
      </Group>
      <Tabs defaultValue="table">
        <Tabs.List mb="md">
          <Tabs.Tab value="table">{COPY.results.leaderboard}</Tabs.Tab>
          {scatterSeries[0].data.length > 0 && (
            <Tabs.Tab value="chart">{COPY.results.chartTitle}</Tabs.Tab>
          )}
        </Tabs.List>
        <Tabs.Panel value="table">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{COPY.results.columns.setup}</Table.Th>
                <Table.Th>{COPY.results.columns.quality}</Table.Th>
                <Table.Th>{COPY.results.columns.cost}</Table.Th>
                <Table.Th>{COPY.results.columns.p50}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sorted.map((c) => (
                <Table.Tr key={c.comboId}>
                  <Table.Td>
                    {c.label}
                    {c.selfJudged && (
                      <Tooltip label={COPY.results.selfJudgedTooltip}>
                        <Badge size="xs" ml={4}>
                          {COPY.results.selfJudgedBadge}
                        </Badge>
                      </Tooltip>
                    )}
                  </Table.Td>
                  <Table.Td>{c.avgScore?.toFixed(2) ?? "—"}</Table.Td>
                  <Table.Td>${c.avgCostPerQuestion?.toFixed(4) ?? "—"}</Table.Td>
                  <Table.Td>{c.p50GenerationLatencyMs?.toFixed(0) ?? "—"} ms</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>
        {scatterSeries[0].data.length > 0 && (
          <Tabs.Panel value="chart">
            <ScatterChart
              h={300}
              data={scatterSeries}
              dataKey={{ x: "cost", y: "quality" }}
              xAxisLabel="Cost (USD)"
              yAxisLabel="Quality"
              withTooltip
            />
          </Tabs.Panel>
        )}
      </Tabs>
    </Card>
  );
}
