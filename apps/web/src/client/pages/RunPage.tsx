import {
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

  useEffect(() => {
    if (data?.run.status === "complete" || data?.run.status === "budget_exceeded") {
      nav(`/run/${id}/results`, { replace: true });
    }
  }, [data?.run.status, id, nav]);

  if (!data) return <Text>Loading...</Text>;

  const { run, comboResults, grid, questions: questionRows = [], phases } = data;
  const complete = grid.filter((g) => g.status === "complete").length;
  const total = grid.length;
  const pct = total ? (complete / total) * 100 : 0;

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
          <Badge>{run.status}</Badge>
        </div>
        <Group>
          <Button variant="outline" component={Link} to={`/run/${id}/results`}>
            Results
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

      <Text>
        Spend: ${Number(run.totalCostUsd).toFixed(2)} / ${Number(run.budgetUsd).toFixed(2)}
      </Text>
      <Progress value={pct} size="lg" />
      <Text size="sm" c="dimmed">
        {complete} / {total} trials complete
      </Text>

      <Text size="sm" c="dimmed">
        Documents: {phases?.documents.ready ?? 0} / {phases?.documents.total ?? 0} ready
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
              Activity feed
            </Title>
            <ActivityFeed runId={run.id} runStatus={run.status} />
          </Card>
        </Grid.Col>
      </Grid>

      <Modal opened={Boolean(drillTrial)} onClose={() => setDrillTrial(null)} size="xl" title="Trial detail">
        {trialDetail && (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {trialDetail.combo.embeddingModel} / {trialDetail.combo.rerankModel ?? "no rerank"} /{" "}
              {trialDetail.combo.genModel}
            </Text>
            <Text fw={600}>Question</Text>
            <Text size="sm">{trialDetail.question.text}</Text>
            <Text fw={600}>Reference</Text>
            <Text size="sm">{trialDetail.question.referenceAnswer}</Text>
            {trialDetail.trial.overallScore && (
              <Badge>Score {Number(trialDetail.trial.overallScore).toFixed(1)}</Badge>
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
