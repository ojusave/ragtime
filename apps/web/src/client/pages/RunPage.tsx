import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  Loader,
  Modal,
  Progress,
  Stack,
  Text,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ActivityFeed from "../components/ActivityFeed";
import FlowSteps from "../components/FlowSteps";
import PageHeader from "../components/PageHeader";
import QueryState from "../components/QueryState";
import TrialGrid from "../components/TrialGrid";
import TrialStagesPanel from "../components/TrialStagesPanel";
import { api } from "../lib/api";
import { friendlyError, runStatusLabel } from "../lib/copy";
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

  const { data: trialDetail, isLoading: trialLoading } = useQuery({
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
      notifySuccess("Run canceled");
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
            description="Live evaluation progress. Click any cell to inspect a single model stack on one question."
            crumbs={[
              { label: "Home", to: "/" },
              { label: "Corpus", to: `/corpus/${data.run.corpusId}` },
              { label: data.run.name },
            ]}
            actions={
              <Group gap="sm">
                <Badge size="lg" color={data.run.status === "failed" ? "red" : undefined}>
                  {runStatusLabel(data.run.status)}
                </Badge>
                <Button variant="outline" component={Link} to={`/run/${id}/results`}>
                  View results
                </Button>
                {ACTIVE.has(data.run.status) && (
                  <Button color="red" variant="outline" onClick={() => setCancelOpen(true)}>
                    Cancel run
                  </Button>
                )}
              </Group>
            }
          />

          <FlowSteps active={2} steps={[
            { label: "Dataset" },
            { label: "Configure" },
            { label: "Run" },
            { label: "Results" },
          ]} />

          {data.run.status === "failed" && (
            <Alert color="red" title="Run failed">
              {data.run.error ? friendlyError(data.run.error) : "Check Render workflow logs for details."}
            </Alert>
          )}

          {data.run.status === "complete" && !allTrialsDone && (
            <Alert color="orange" title="Run marked complete but evaluations are still finishing">
              {complete} of {total} evaluations finished. {pendingOrRunning} still pending or in
              progress. Results may be incomplete until all evaluations finish.
            </Alert>
          )}

          {(data.run.status === "complete" || data.run.status === "budget_exceeded") && (
            <Checkbox
              label="Stay on this page (don't auto-open results)"
              checked={stayOnPage}
              onChange={(e) => setStayOnPage(e.currentTarget.checked)}
            />
          )}

          <Text>
            Spend: ${Number(data.run.totalCostUsd).toFixed(2)} / $
            {Number(data.run.budgetUsd).toFixed(2)}
          </Text>
          <Progress value={total ? (complete / total) * 100 : 0} size="lg" aria-label="Evaluation progress" />
          <Text size="sm" c="dimmed">
            {complete} / {total} evaluations complete
          </Text>

          <Text size="sm" c="dimmed">
            Documents indexed: {data.phases?.documents.ready ?? 0} / {data.phases?.documents.total ?? 0}
          </Text>
          {(data.phases?.embeddings ?? []).map((e) => (
            <div key={e.model}>
              <Text size="xs" mb={4}>
                Embeddings ({e.model.split("/").pop()}): {e.done} / {e.total}
              </Text>
              <Progress value={e.total ? (e.done / e.total) * 100 : 0} size="sm" mb="sm" />
            </div>
          ))}

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
            title="Evaluation detail"
          >
            {trialLoading && (
              <Stack align="center" py="md">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">
                  Loading evaluation…
                </Text>
              </Stack>
            )}
            {trialDetail && (
              <Stack gap="sm">
                <Text size="sm" c="dimmed">
                  {trialDetail.combo.embeddingModel} / {trialDetail.combo.rerankModel ?? "no rerank"} /{" "}
                  {trialDetail.combo.genModel}
                </Text>
                <Text fw={600}>Question</Text>
                <Text size="sm">{trialDetail.question.text}</Text>
                <Text fw={600}>Reference answer</Text>
                <Text size="sm">{trialDetail.question.referenceAnswer}</Text>
                {trialDetail.trial.overallScore && (
                  <Badge>Quality score {Number(trialDetail.trial.overallScore).toFixed(1)}</Badge>
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

          <Modal opened={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this run?" centered>
            <Stack gap="md">
              <Text size="sm">In-progress evaluations will stop. Spend so far is not refunded.</Text>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setCancelOpen(false)}>
                  Keep running
                </Button>
                <Button color="red" loading={canceling} onClick={handleCancel}>
                  Cancel run
                </Button>
              </Group>
            </Stack>
          </Modal>
        </Stack>
      )}
    </QueryState>
  );
}
