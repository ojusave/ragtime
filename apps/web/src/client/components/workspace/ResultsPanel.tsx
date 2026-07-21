import { Badge, Button, Card, Group, Stack, Table, Tabs, Text, Tooltip } from "@mantine/core";
import { ScatterChart } from "@mantine/charts";
import type { ComboResult } from "@ragtime/core";
import { COPY } from "../../lib/copy";
import { shortModelName } from "../../lib/combo-display";
import { scorePercent, scoreTone } from "../../lib/score-display";
import { downloadResultsCsv } from "../../lib/export-results";
import ProviderMark, { modelProvider } from "./ProviderMark";

function ModelCell({ modelId, muted }: { modelId: string | null; muted?: boolean }) {
  if (!modelId) return <Text size="sm" c="dimmed">Skipped</Text>;
  const provider = modelProvider(modelId);
  return (
    <Group gap={8} wrap="nowrap" className={muted ? "result-model--muted" : undefined}>
      <ProviderMark modelId={modelId} />
      <Stack gap={0} className="result-model-copy">
        <Text size="sm" fw={600} lineClamp={1}>{shortModelName(modelId)}</Text>
        <Text size="xs" c="dimmed" lineClamp={1}>{provider.label}</Text>
      </Stack>
    </Group>
  );
}

export default function ResultsPanel({
  runName,
  combos,
}: {
  runName: string;
  combos: ComboResult[];
}) {
  const sorted = [...combos].sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
  const scatterSeries = [
    {
      name: "Setups",
      color: "indigo.6",
      data: sorted
        .filter((combo) => combo.avgCostPerQuestion != null && combo.avgScore != null)
        .map((combo) => ({
          cost: combo.avgCostPerQuestion!,
          quality: scorePercent(combo.avgScore)!,
          label: combo.label ?? combo.genModel,
        })),
    },
  ];

  if (!sorted.length) return null;

  return (
    <Card withBorder p="md" className="results-panel">
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap={2}>
          <Text className="pg-section-title">Post-run analysis</Text>
          <Text size="sm" fw={650}>Compare quality, model choice, cost, and speed at a glance.</Text>
        </Stack>
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
          <Tabs.Tab value="table">Score grid</Tabs.Tab>
          {scatterSeries[0].data.length > 0 && (
            <Tabs.Tab value="chart">{COPY.results.chartTitle}</Tabs.Tab>
          )}
        </Tabs.List>
        <Tabs.Panel value="table">
          <Table.ScrollContainer minWidth={900}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th aria-label="Rank">#</Table.Th>
                  <Table.Th>
                    <Tooltip label={COPY.app.judgeScoreTooltip} multiline w={240} withArrow>
                      <span style={{ cursor: "help" }}>{COPY.app.judgeScore}</span>
                    </Tooltip>
                  </Table.Th>
                  <Table.Th>Search</Table.Th>
                  <Table.Th>Rerank</Table.Th>
                  <Table.Th>Answer</Table.Th>
                  <Table.Th>{COPY.results.columns.cost}</Table.Th>
                  <Table.Th>{COPY.results.columns.p50}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sorted.map((combo, index) => {
                  const score = scorePercent(combo.avgScore);
                  return (
                    <Table.Tr key={combo.comboId}>
                      <Table.Td>
                        <Text fw={700} c="dimmed">{index + 1}</Text>
                      </Table.Td>
                      <Table.Td>
                        <div
                          className={`result-score score-tone--${scoreTone(score)}`}
                          aria-label={score == null ? "Not scored" : `${score} out of 100`}
                        >
                          <Group gap={4} align="baseline" wrap="nowrap">
                            <span className="result-score__value">{score ?? "—"}</span>
                            <span className="result-score__scale">/100</span>
                          </Group>
                          <div className="result-score__track" aria-hidden="true">
                            <div className="result-score__bar" style={{ width: `${score ?? 0}%` }} />
                          </div>
                          <Text size="xs" c="dimmed">
                            {combo.completeCount} scored
                            {combo.failedCount ? ` · ${combo.failedCount} failed` : ""}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td><ModelCell modelId={combo.embeddingModel} /></Table.Td>
                      <Table.Td><ModelCell modelId={combo.rerankModel} muted={!combo.rerankModel} /></Table.Td>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <ModelCell modelId={combo.genModel} />
                          {combo.selfJudged && (
                            <Tooltip label={COPY.results.selfJudgedTooltip}>
                              <Badge size="xs" variant="light">{COPY.results.selfJudgedBadge}</Badge>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>${combo.avgCostPerQuestion?.toFixed(4) ?? "—"}</Table.Td>
                      <Table.Td>{combo.p50GenerationLatencyMs?.toFixed(0) ?? "—"} ms</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>
        {scatterSeries[0].data.length > 0 && (
          <Tabs.Panel value="chart">
            <ScatterChart
              h={300}
              data={scatterSeries}
              dataKey={{ x: "cost", y: "quality" }}
              xAxisLabel="Cost (USD)"
              yAxisLabel={COPY.app.judgeScoreAxis}
              withTooltip
            />
          </Tabs.Panel>
        )}
      </Tabs>
    </Card>
  );
}
