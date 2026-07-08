import { Badge, Card, Stack, Table, Text, Title } from "@mantine/core";
import { ScatterChart } from "@mantine/charts";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { runStatusLabel } from "../lib/copy";
import type { ComboResult } from "@ragtime/core";

type Run = { name: string; status: string; totalCostUsd: string; budgetUsd: string };

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();

  const { data } = useQuery({
    queryKey: ["run", id],
    queryFn: () =>
      api<{ run: Run; comboResults: ComboResult[] }>(`/api/runs/${id}`),
    enabled: Boolean(id),
  });

  if (!data) return <Text c="dimmed">Loading results…</Text>;

  const chartData = data.comboResults
    .filter((c) => c.avgCostPerQuestion != null && c.avgScore != null)
    .map((c) => ({
      label: c.label ?? c.genModel,
      cost: c.avgCostPerQuestion!,
      quality: c.avgScore!,
    }));

  return (
    <Stack gap="lg">
      <Title order={2}>{data.run.name}: results</Title>
      <Badge size="lg">{runStatusLabel(data.run.status)}</Badge>
      <Text>
        Total spend: ${Number(data.run.totalCostUsd).toFixed(2)} / $
        {Number(data.run.budgetUsd).toFixed(2)}
      </Text>

      <Card withBorder>
        <Title order={4} mb="md">
          Model stack leaderboard
        </Title>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Model stack</Table.Th>
              <Table.Th>Quality</Table.Th>
              <Table.Th>Cost / question</Table.Th>
              <Table.Th>P50 latency</Table.Th>
              <Table.Th>P95 latency</Table.Th>
              <Table.Th>Failures</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.comboResults
              .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
              .map((c) => (
                <Table.Tr key={c.comboId}>
                  <Table.Td>
                    {c.label}
                    {c.selfJudged && (
                      <Badge size="xs" ml={4}>
                        self-judged
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{c.avgScore?.toFixed(2) ?? "—"}</Table.Td>
                  <Table.Td>${c.avgCostPerQuestion?.toFixed(4) ?? "—"}</Table.Td>
                  <Table.Td>{c.p50GenerationLatencyMs?.toFixed(0) ?? "—"} ms</Table.Td>
                  <Table.Td>{c.p95GenerationLatencyMs?.toFixed(0) ?? "—"} ms</Table.Td>
                  <Table.Td>{c.failedCount}</Table.Td>
                </Table.Tr>
              ))}
          </Table.Tbody>
        </Table>
      </Card>

      {chartData.length > 0 && (
        <Card withBorder>
          <Title order={4} mb="md">
            Cost vs quality
          </Title>
          <ScatterChart
            h={360}
            data={chartData}
            dataKey={{ x: "cost", y: "quality" }}
            xAxisLabel="Cost per question (USD)"
            yAxisLabel="Quality score"
            withTooltip
            tooltipProps={{
              content: ({ payload }) =>
                payload?.[0] ? (
                  <Text size="xs">{(payload[0].payload as { label: string }).label}</Text>
                ) : null,
            }}
          />
        </Card>
      )}
    </Stack>
  );
}
