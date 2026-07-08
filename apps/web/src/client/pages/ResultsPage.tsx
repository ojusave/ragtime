import { Alert, Badge, Button, Card, Group, Stack, Table, Text, Tooltip } from "@mantine/core";
import { ScatterChart } from "@mantine/charts";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import FlowSteps from "../components/FlowSteps";
import PageHeader from "../components/PageHeader";
import QueryState from "../components/QueryState";
import { api } from "../lib/api";
import { COPY, FLOW_STEPS, runStatusLabel } from "../lib/copy";
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
    queryKey: ["run", id],
    queryFn: () =>
      api<{ run: Run; comboResults: ComboResult[] }>(`/api/runs/${id}`),
    enabled: Boolean(id),
  });

  const sorted = [...(data?.comboResults ?? [])].sort(
    (a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0)
  );

  const chartData = sorted
    .filter((c) => c.avgCostPerQuestion != null && c.avgScore != null)
    .map((c) => ({
      label: c.label ?? c.genModel,
      cost: c.avgCostPerQuestion!,
      quality: c.avgScore!,
    }));

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      notFound={!isLoading && !isError && !data}
    >
      {data && (
        <Stack gap="lg">
          <PageHeader
            title={`${data.run.name}: ${COPY.results.titleSuffix}`}
            description={COPY.results.description}
            crumbs={[
              { label: "Home", to: "/" },
              { label: "Dataset", to: `/corpus/${data.run.corpusId}` },
              { label: "Compare", to: `/run/${id}` },
              { label: "Review" },
            ]}
            actions={
              <Group gap="sm">
                <Badge size="lg">{runStatusLabel(data.run.status)}</Badge>
                <Button
                  variant="light"
                  onClick={() => downloadResultsCsv(data.run.name, sorted)}
                  disabled={sorted.length === 0}
                >
                  {COPY.results.exportCsv}
                </Button>
                <Button component={Link} to={`/run/${id}`} variant="outline">
                  {COPY.results.backToRun}
                </Button>
                <Button component={Link} to={`/corpus/${data.run.corpusId}`}>
                  {COPY.results.backToDataset}
                </Button>
              </Group>
            }
          />

          <FlowSteps active={3} steps={[...FLOW_STEPS]} />

          {data.run.status === "failed" && (
            <Alert color="red" title={COPY.results.failedTitle}>
              {COPY.results.failedBody}
            </Alert>
          )}

          <Text>
            {COPY.run.spend(
              Number(data.run.totalCostUsd).toFixed(2),
              Number(data.run.budgetUsd).toFixed(2)
            )}
          </Text>

          <Card withBorder>
            <Text fw={600} mb="md">
              {COPY.results.leaderboard}
            </Text>
            {sorted.length === 0 ? (
              <EmptyState title={COPY.results.empty} hint={COPY.results.emptyHint} />
            ) : (
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
            )}
          </Card>

          {chartData.length > 0 && (
            <Card withBorder>
              <Text fw={600} mb="md">
                {COPY.results.chartTitle}
              </Text>
              <ScatterChart
                h={360}
                data={chartData}
                dataKey={{ x: "cost", y: "quality" }}
                xAxisLabel="Cost per question (USD)"
                yAxisLabel="Quality score"
                withTooltip
                tooltipProps={{
                  content: ({ payload }) => {
                    const row = payload?.[0]?.payload as
                      | { label: string; cost: number; quality: number }
                      | undefined;
                    if (!row) return null;
                    return (
                      <Stack gap={2} p="xs">
                        <Text size="xs" fw={600}>
                          {row.label}
                        </Text>
                        <Text size="xs">Quality: {row.quality.toFixed(2)}</Text>
                        <Text size="xs">Cost: ${row.cost.toFixed(4)}</Text>
                      </Stack>
                    );
                  },
                }}
              />
            </Card>
          )}
        </Stack>
      )}
    </QueryState>
  );
}
