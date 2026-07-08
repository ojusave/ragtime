import { Alert, Badge, Button, Card, Group, Stack, Table, Tabs, Text, Tooltip } from "@mantine/core";
import { ScatterChart } from "@mantine/charts";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import QueryState from "../components/QueryState";
import RunSummaryBar from "../components/RunSummaryBar";
import { api } from "../lib/api";
import { COPY, runStatusLabel } from "../lib/copy";
import { downloadResultsCsv } from "../lib/export-results";
import type { ComboResult } from "@ragtime/core";

type Run = {
  name: string;
  corpusId: string;
  status: string;
  totalCostUsd: string;
  budgetUsd: string;
};

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["run-results", id],
    queryFn: () =>
      api<{ run: Run; comboResults: ComboResult[] }>(`/api/runs/${id}`),
    enabled: Boolean(id),
  });

  const sorted = [...(data?.comboResults ?? [])].sort(
    (a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0)
  );

  const scatterSeries = [
    {
      name: "Model setups",
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

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      notFound={!isLoading && !isError && !data}
    >
      {data && (
        <Stack gap="md">
          <PageHeader
            title={`${data.run.name}: ${COPY.results.titleSuffix}`}
            crumbs={[
              { label: "Home", to: "/" },
              { label: "Dataset", to: `/corpus/${data.run.corpusId}` },
              { label: data.run.name, to: `/run/${id}` },
              { label: "Results" },
            ]}
            actions={
              <Group gap="sm">
                {data.run.status !== "complete" && (
                  <Badge>{runStatusLabel(data.run.status)}</Badge>
                )}
                <Button
                  variant="light"
                  onClick={() => downloadResultsCsv(data.run.name, sorted)}
                  disabled={sorted.length === 0}
                >
                  {COPY.results.exportCsv}
                </Button>
              </Group>
            }
          />

          {data.run.status === "failed" && (
            <Alert color="red" title={COPY.results.failedTitle}>
              {COPY.results.failedBody}
            </Alert>
          )}

          <RunSummaryBar
            spent={Number(data.run.totalCostUsd).toFixed(2)}
            budget={Number(data.run.budgetUsd).toFixed(2)}
            complete={sorted.reduce((n, c) => n + c.completeCount, 0)}
            total={sorted.reduce((n, c) => n + c.completeCount + c.failedCount, 0)}
          />

          {sorted.length === 0 ? (
            <EmptyState title={COPY.results.empty} hint={COPY.results.emptyHint} />
          ) : (
            <Card withBorder p="md">
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
                        <Table.Th>{COPY.results.columns.p95}</Table.Th>
                        <Table.Th>{COPY.results.columns.failures}</Table.Th>
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
                          <Table.Td>{c.p95GenerationLatencyMs?.toFixed(0) ?? "—"} ms</Table.Td>
                          <Table.Td>{c.failedCount}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Tabs.Panel>

                {scatterSeries[0].data.length > 0 && (
                  <Tabs.Panel value="chart">
                    <ScatterChart
                      h={360}
                      data={scatterSeries}
                      dataKey={{ x: "cost", y: "quality" }}
                      xAxisLabel="Cost per question (USD)"
                      yAxisLabel="Quality score"
                      labels={{ x: "Cost (USD)", y: "Quality" }}
                      withTooltip
                      tooltipProps={{
                        content: ({ payload }) => {
                          const row = payload?.[0]?.payload as
                            | { label?: string; cost: number; quality: number }
                            | undefined;
                          if (!row) return null;
                          return (
                            <Stack gap={2} p="xs">
                              {row.label && (
                                <Text size="xs" fw={600}>
                                  {row.label}
                                </Text>
                              )}
                              <Text size="xs">Quality: {row.quality.toFixed(2)}</Text>
                              <Text size="xs">Cost: ${row.cost.toFixed(4)}</Text>
                            </Stack>
                          );
                        },
                      }}
                    />
                  </Tabs.Panel>
                )}
              </Tabs>
            </Card>
          )}
        </Stack>
      )}
    </QueryState>
  );
}
