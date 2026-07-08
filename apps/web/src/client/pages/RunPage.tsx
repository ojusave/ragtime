import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  Grid,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ActivityFeed from "../components/ActivityFeed";
import PageHeader from "../components/PageHeader";
import QueryState from "../components/QueryState";
import RunSummaryBar from "../components/RunSummaryBar";
import TrialGrid from "../components/TrialGrid";
import TrialStagesPanel from "../components/TrialStagesPanel";
import { api } from "../lib/api";
import { COPY, friendlyError, runStatusLabel } from "../lib/copy";
import { notifyError, notifySuccess } from "../lib/notify";
import type { ComboResult, TrialStages } from "@ragtime/core";

type Run = {
  id: string;
  corpusId: string;
  status: string;
  name: string;
  budgetUsd: string;
  totalCostUsd: string;
  startedAt: string | null;
  error: string | null;
};

type Phases = {
  documents: { total: number; ready: number };
  embeddings: { model: string; total: number; done: number }[];
  trials: Record<string, number>;
};

type GridCell = {
  trialId: string;
  comboId: string;
  questionId: string;
  status: string;
  overallScore: string | null;
  attempts: number;
};

const ACTIVE = new Set(["ingesting", "running", "aggregating"]);
const TERMINAL = new Set(["complete", "failed", "canceled", "budget_exceeded"]);

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [drillTrial, setDrillTrial] = useState<string | null>(null);
  const [stayOnPage, setStayOnPage] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [indexingOpen, { toggle: toggleIndexing }] = useDisclosure(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["run", id],
    queryFn: () =>
      api<{
        run: Run;
        comboResults: ComboResult[];
        grid: GridCell[];
        questions: { id: string; text: string }[];
        phases: Phases;
      }>(`/api/runs/${id}`),
    enabled: Boolean(id),
    refetchInterval: (q) =>
      ACTIVE.has(q.state.data?.run.status ?? "") ? 2000 : false,
  });

  const { data: trialDetail, isLoading: trialLoading, isError: trialError, error: trialDetailError } = useQuery({
    queryKey: ["trial", drillTrial],
    queryFn: () =>
      api<{
        trial: { answer: string | null; stages: TrialStages; overallScore: string | null };
        question: { text: string; referenceAnswer: string };
        combo: { embeddingModel: string; rerankModel: string | null; genModel: string };
        chunks: { id: string; idx: number; content: string }[];
      }>(`/api/trials/${drillTrial}`),
    enabled: Boolean(drillTrial),
  });

  const complete = data?.grid.filter((g) => g.status === "complete").length ?? 0;
  const total = data?.grid.length ?? 0;
  const pendingOrRunning =
    data?.grid.filter((g) => g.status === "pending" || g.status === "running").length ?? 0;
  const allTrialsDone = total > 0 && complete === total;
  const embeddings = data?.phases?.embeddings ?? [];
  const indexingDone = embeddings.every((e) => e.done >= e.total);
  const indexingSummary =
    embeddings.length === 0
      ? null
      : indexingDone
        ? `Indexed for ${embeddings.length} search models`
        : `Indexing ${embeddings.filter((e) => e.done < e.total).length} of ${embeddings.length} search models`;

  useEffect(() => {
    const status = data?.run.status;
    if (!status || stayOnPage) return;
    if (!TERMINAL.has(status)) return;
    if (status === "complete" && !allTrialsDone) return;
    if (status === "complete" || status === "budget_exceeded") {
      nav(`/run/${id}/results`, { replace: true });
    }
  }, [data?.run.status, id, nav, allTrialsDone, stayOnPage]);

  async function handleCancel() {
    if (!id) return;
    setCanceling(true);
    try {
      await api(`/api/runs/${id}/cancel`, { method: "POST" });
      notifySuccess(COPY.notify.comparisonStopped);
      setCancelOpen(false);
      refetch();
    } catch (e) {
      notifyError(
        "Could not cancel run",
        e instanceof Error ? friendlyError(e.message) : undefined
      );
    } finally {
      setCanceling(false);
    }
  }

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
            title={data.run.name}
            crumbs={[
              { label: "Home", to: "/" },
              { label: "Dataset", to: `/corpus/${data.run.corpusId}` },
              { label: data.run.name },
            ]}
            actions={
              ACTIVE.has(data.run.status) ? (
                <Group gap="sm">
                  <Badge size="lg">{runStatusLabel(data.run.status)}</Badge>
                  <Button color="red" variant="outline" onClick={() => setCancelOpen(true)}>
                    {COPY.run.cancel}
                  </Button>
                </Group>
              ) : (
                <Badge size="lg" color={data.run.status === "failed" ? "red" : undefined}>
                  {runStatusLabel(data.run.status)}
                </Badge>
              )
            }
          />

          {data.run.status === "failed" && (
            <Alert color="red" title={COPY.run.failedTitle}>
              {data.run.error ? friendlyError(data.run.error) : COPY.run.failedBody}
            </Alert>
          )}

          {data.run.status === "complete" && !allTrialsDone && (
            <Alert color="orange" title={COPY.run.incompleteTitle}>
              {COPY.run.incompleteBody(complete, total, pendingOrRunning)}
            </Alert>
          )}

          {(data.run.status === "complete" || data.run.status === "budget_exceeded") && (
            <Checkbox
              label={COPY.run.stayOnPage}
              checked={stayOnPage}
              onChange={(e) => setStayOnPage(e.currentTarget.checked)}
            />
          )}

          <RunSummaryBar
            spent={Number(data.run.totalCostUsd).toFixed(2)}
            budget={Number(data.run.budgetUsd).toFixed(2)}
            complete={complete}
            total={total}
            docsReady={data.phases?.documents.ready}
            docsTotal={data.phases?.documents.total}
          />

          {indexingSummary && (
            <>
              <Button variant="subtle" size="compact-sm" onClick={toggleIndexing} px={0}>
                {indexingSummary} {indexingOpen ? "▾" : "▸"}
              </Button>
              <Collapse in={indexingOpen}>
                <Stack gap={4}>
                  {embeddings.map((e) => (
                    <Text key={e.model} size="xs" c="dimmed">
                      {COPY.run.embeddings(e.model, e.done, e.total)}
                    </Text>
                  ))}
                </Stack>
              </Collapse>
            </>
          )}

          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Card withBorder p="md">
                <TrialGrid
                  combos={data.comboResults.map((c) => ({
                    comboId: c.comboId,
                    label: c.label ?? c.genModel,
                  }))}
                  questions={
                    data.questions.length
                      ? data.questions
                      : [...new Set(data.grid.map((g) => g.questionId))].map((qid) => ({
                          id: qid,
                          text: qid.slice(0, 8),
                        }))
                  }
                  grid={data.grid}
                  onCellClick={setDrillTrial}
                />
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card withBorder p="md">
                <Text fw={600} mb="sm">
                  Activity
                </Text>
                <ActivityFeed runId={data.run.id} runStatus={data.run.status} />
              </Card>
            </Grid.Col>
          </Grid>

          <Modal
            opened={Boolean(drillTrial)}
            onClose={() => setDrillTrial(null)}
            size="xl"
            title={COPY.run.detailTitle}
          >
            {trialLoading && (
              <Stack align="center" py="md">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">
                  {COPY.common.loading}
                </Text>
              </Stack>
            )}
            {trialError && (
              <Alert color="red" title={COPY.common.loadFailed}>
                {friendlyError(trialDetailError?.message ?? "Could not load test detail")}
              </Alert>
            )}
            {trialDetail && !trialLoading && (
              <Stack gap="sm">
                <Text size="sm" c="dimmed">
                  {trialDetail.combo.embeddingModel} / {trialDetail.combo.rerankModel ?? "no rerank"} /{" "}
                  {trialDetail.combo.genModel}
                </Text>
                <Text fw={600}>{COPY.corpus.questionLabel}</Text>
                <Text size="sm">{trialDetail.question.text}</Text>
                <Text fw={600}>{COPY.corpus.expectedAnswerLabel}</Text>
                <Text size="sm">{trialDetail.question.referenceAnswer}</Text>
                {trialDetail.trial.overallScore && (
                  <Badge>
                    {COPY.results.columns.quality} {Number(trialDetail.trial.overallScore).toFixed(1)}
                  </Badge>
                )}
                <TrialStagesPanel
                  stages={trialDetail.trial.stages}
                  answer={trialDetail.trial.answer}
                  chunks={
                    new Map(
                      trialDetail.chunks.map((c) => [
                        c.id,
                        { id: c.id, idx: c.idx, content: c.content },
                      ])
                    )
                  }
                />
              </Stack>
            )}
          </Modal>

          <Modal opened={cancelOpen} onClose={() => setCancelOpen(false)} title={COPY.run.cancelTitle} centered>
            <Stack gap="md">
              <Text size="sm">{COPY.run.cancelBody}</Text>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setCancelOpen(false)}>
                  {COPY.run.cancelKeep}
                </Button>
                <Button color="red" loading={canceling} onClick={handleCancel}>
                  {COPY.run.cancelConfirm}
                </Button>
              </Group>
            </Stack>
          </Modal>
        </Stack>
      )}
    </QueryState>
  );
}
