import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ActivityFeed from "../components/ActivityFeed";
import TrialGrid from "../components/TrialGrid";
import TrialStagesPanel from "../components/TrialStagesPanel";
import { api } from "../lib/api";
import { runStatusLabel } from "../lib/copy";
import type { ComboResult, TrialStages } from "@ragtime/core";

type Run = {
  id: string;
  status: string;
  name: string;
  budgetUsd: string;
  totalCostUsd: string;
  startedAt: string | null;
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

  const { data, refetch } = useQuery({
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

  const { data: trialDetail } = useQuery({
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
    if (!status || !TERMINAL.has(status)) return;
    if (status === "complete" && !allTrialsDone) return;
    if (status === "complete" || status === "budget_exceeded") {
      nav(`/run/${id}/results`, { replace: true });
    }
  }, [data?.run.status, id, nav, allTrialsDone]);

  if (!data) return <Text c="dimmed">Loading run…</Text>;

  const { run, comboResults, grid, questions: questionRows = [], phases } = data;
  const pct = total ? (complete / total) * 100 : 0;
  const incompleteRun = run.status === "complete" && !allTrialsDone;

  const combos = comboResults.map((c) => ({
    comboId: c.comboId,
    label: c.label ?? c.genModel,
  }));

  const questions = questionRows.length
    ? questionRows
    : [...new Set(grid.map((g) => g.questionId))].map((qid) => ({
        id: qid,
        text: qid.slice(0, 8),
      }));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>{run.name}</Title>
          <Badge color={run.status === "failed" ? "red" : undefined}>
            {runStatusLabel(run.status)}
          </Badge>
        </div>
        <Group>
          <Button variant="outline" component={Link} to={`/run/${id}/results`}>
            View results
          </Button>
          {ACTIVE.has(run.status) && (
            <Button
              color="red"
              variant="outline"
              onClick={async () => {
                await api(`/api/runs/${id}/cancel`, { method: "POST" });
                refetch();
              }}
            >
              Cancel run
            </Button>
          )}
        </Group>
      </Group>

      {incompleteRun && (
        <Alert color="orange" title="Run marked complete but evaluations are still finishing">
          {complete} of {total} evaluations finished. {pendingOrRunning} still pending or in
          progress. Results may be incomplete until all evaluations finish.
        </Alert>
      )}

      <Text>
        Spend: ${Number(run.totalCostUsd).toFixed(2)} / ${Number(run.budgetUsd).toFixed(2)}
      </Text>
      <Progress value={pct} size="lg" />
      <Text size="sm" c="dimmed">
        {complete} / {total} evaluations complete
      </Text>

      <Text size="sm" c="dimmed">
        Documents indexed: {phases?.documents.ready ?? 0} / {phases?.documents.total ?? 0}
      </Text>
      {(phases?.embeddings ?? []).map((e) => (
        <div key={e.model}>
          <Text size="xs" mb={4}>
            Embeddings ({e.model.split("/").pop()}): {e.done} / {e.total}
          </Text>
          <Progress value={e.total ? (e.done / e.total) * 100 : 0} size="sm" mb="sm" />
        </div>
      ))}

      <Grid>
        <Grid.Col span={8}>
          <Card withBorder p="md">
            <Text size="sm" c="dimmed" mb="sm">
              Each cell is one model stack on one question. Darker blue means higher quality score.
            </Text>
            <TrialGrid
              combos={combos}
              questions={questions}
              grid={grid}
              onCellClick={setDrillTrial}
            />
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card withBorder p="md">
            <Title order={5} mb="sm">
              Activity
            </Title>
            <ActivityFeed runId={run.id} runStatus={run.status} />
          </Card>
        </Grid.Col>
      </Grid>

      <Modal
        opened={Boolean(drillTrial)}
        onClose={() => setDrillTrial(null)}
        size="xl"
        title="Evaluation detail"
      >
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
                new Map(trialDetail.chunks.map((c) => [c.id, { id: c.id, idx: c.idx, content: c.content }]))
              }
            />
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
