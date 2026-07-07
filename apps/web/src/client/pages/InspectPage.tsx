import {
  Badge,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import TrialStagesPanel from "../components/TrialStagesPanel";
import { api } from "../lib/api";
import { formatReceipt } from "../lib/receipt";
import type { TrialStages } from "@ragtime/core";

type Catalog = {
  embedding: { id: string; name: string }[];
  rerank: { id: string; name: string }[];
  chat: { id: string; name: string }[];
};

type StageState = {
  stage: string;
  data?: Record<string, unknown>;
  receipt?: { latencyMs: number; costUsd: number; costUnknown?: boolean; provider?: string };
};

const STAGES = ["embed", "retrieve", "rerank", "generate", "judge"];

export default function InspectPage() {
  const { id: corpusId } = useParams<{ id: string }>();
  const [query, setQuery] = useState("");
  const [emb, setEmb] = useState<string | null>(null);
  const [rer, setRer] = useState<string | null>(null);
  const [gen, setGen] = useState<string | null>(null);
  const [useRerank, setUseRerank] = useState(false);
  const [retrieveK, setRetrieveK] = useState(20);
  const [finalK, setFinalK] = useState(5);
  const [running, setRunning] = useState(false);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [completed, setCompleted] = useState<StageState[]>([]);
  const [totals, setTotals] = useState<{ cost: number; latency: number } | null>(null);
  const [highlightChunkId, setHighlightChunkId] = useState<string | null>(null);

  const { data: catalog } = useQuery({
    queryKey: ["models"],
    queryFn: () => api<Catalog>("/api/models"),
    staleTime: 10 * 60 * 1000,
  });

  const stageMap = useMemo(() => new Map(completed.map((s) => [s.stage, s])), [completed]);

  const chunkMap = useMemo(() => {
    const m = new Map<string, { id: string; content: string; idx?: number }>();
    const retrieve = stageMap.get("retrieve")?.data as
      | { chunkIds?: string[]; chunks?: { id: string; content: string; idx?: number }[] }
      | undefined;
    for (const c of retrieve?.chunks ?? []) {
      m.set(c.id, c);
    }
    return m;
  }, [stageMap]);

  const trialStages = useMemo((): TrialStages => {
    const retrieve = stageMap.get("retrieve")?.data as TrialStages["retrieval"];
    const rerank = stageMap.get("rerank")?.data as TrialStages["rerank"] & { skipped?: boolean };
    const generate = stageMap.get("generate")?.data as TrialStages["generation"] & {
      answer?: string;
    };
    const judge = stageMap.get("judge")?.data as TrialStages["judge"] & { skipped?: boolean };
    return {
      retrieval: retrieve,
      rerank: rerank?.skipped ? undefined : rerank,
      generation: generate,
      judge: judge?.skipped ? undefined : judge,
    };
  }, [stageMap]);

  const answer = (stageMap.get("generate")?.data as { answer?: string })?.answer;

  async function runInspect() {
    if (!corpusId || !query || !emb || !gen) return;
    setRunning(true);
    setCompleted([]);
    setTotals(null);
    setActiveStage("embed");
    setSelectedStage("embed");

    const { inspectId } = await api<{ inspectId: string }>("/api/inspect", {
      method: "POST",
      body: JSON.stringify({
        corpusId,
        query,
        embeddingModel: emb,
        rerankModel: useRerank ? rer : null,
        genModel: gen,
        retrieveK,
        finalK,
      }),
    });

    const es = new EventSource(`/api/inspect/${inspectId}/stream`);
    es.addEventListener("stage", (ev) => {
      const payload = JSON.parse(ev.data) as StageState;
      setActiveStage(payload.stage);
      setSelectedStage(payload.stage);
      setCompleted((prev) => [...prev.filter((s) => s.stage !== payload.stage), payload]);
    });
    es.addEventListener("done", (ev) => {
      const data = JSON.parse(ev.data) as { totalCostUsd: number; totalLatencyMs: number };
      setTotals({ cost: data.totalCostUsd, latency: data.totalLatencyMs });
      setActiveStage(null);
      setRunning(false);
      es.close();
    });
    es.addEventListener("error", () => {
      setRunning(false);
      setActiveStage(null);
      es.close();
    });
  }

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Query inspector</Title>
        <Button component={Link} to={`/corpus/${corpusId}`} variant="subtle">
          Back to corpus
        </Button>
      </Group>

      <Card withBorder>
        <Stack gap="sm">
          <TextInput label="Query" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
          <Grid>
            <Grid.Col span={4}>
              <Select
                label="Embedding"
                searchable
                data={catalog?.embedding.map((m) => ({ value: m.id, label: m.name })) ?? []}
                value={emb}
                onChange={setEmb}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Generation"
                searchable
                data={catalog?.chat.map((m) => ({ value: m.id, label: m.name })) ?? []}
                value={gen}
                onChange={setGen}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Checkbox mt={28} label="Use rerank" checked={useRerank} onChange={(e) => setUseRerank(e.currentTarget.checked)} />
              {useRerank && (
                <Select
                  mt="xs"
                  label="Rerank"
                  searchable
                  data={catalog?.rerank.map((m) => ({ value: m.id, label: m.name })) ?? []}
                  value={rer}
                  onChange={setRer}
                />
              )}
            </Grid.Col>
          </Grid>
          <Group grow>
            <NumberInput label="Retrieve K" value={retrieveK} onChange={(v) => setRetrieveK(Number(v))} />
            <NumberInput label="Final K" value={finalK} onChange={(v) => setFinalK(Number(v))} />
          </Group>
          <Button onClick={runInspect} loading={running} disabled={!query || !emb || !gen}>
            Run pipeline
          </Button>
        </Stack>
      </Card>

      <Group grow align="stretch" wrap="nowrap">
        {STAGES.map((name, i) => {
          const done = stageMap.get(name);
          const active = activeStage === name;
          const selected = selectedStage === name;
          const skipped = Boolean(done?.data && (done.data as { skipped?: boolean }).skipped);
          return (
            <Paper
              key={name}
              withBorder
              p="sm"
              onClick={() => done && setSelectedStage(name)}
              style={{
                opacity: done || active ? 1 : 0.45,
                cursor: done ? "pointer" : "default",
                outline: selected ? "2px solid var(--mantine-color-blue-5)" : undefined,
                transition: reducedMotion ? "opacity 0.2s" : "transform 0.25s, opacity 0.2s",
                transform: active && !reducedMotion ? "scale(1.02)" : "scale(1)",
              }}
            >
              <Text fw={600} size="sm">
                {i + 1}. {name}
              </Text>
              {active && (
                <Badge size="xs" variant="light">
                  running
                </Badge>
              )}
              {skipped && (
                <Badge size="xs" color="gray">
                  skipped
                </Badge>
              )}
              {done?.receipt && (
                <Text size="xs" c="dimmed">
                  {formatReceipt(done.receipt)}
                </Text>
              )}
            </Paper>
          );
        })}
        {totals && (
          <Paper withBorder p="sm" miw={140}>
            <Text fw={600} size="sm">
              Total
            </Text>
            <Text size="xs">{formatReceipt({ latencyMs: totals.latency, costUsd: totals.cost })}</Text>
          </Paper>
        )}
      </Group>

      <Card withBorder>
        <ScrollArea h={420}>
          {selectedStage === "embed" && stageMap.get("embed") && (
            <Stack gap="xs">
              <Text fw={600}>Query embedding</Text>
              <Text size="sm">Dimensions: {(stageMap.get("embed")?.data as { dims?: number })?.dims}</Text>
            </Stack>
          )}
          {(selectedStage === "retrieve" ||
            selectedStage === "rerank" ||
            selectedStage === "generate" ||
            selectedStage === "judge") && (
            <TrialStagesPanel
              stages={
                selectedStage === "retrieve"
                  ? { retrieval: trialStages.retrieval }
                  : selectedStage === "rerank"
                    ? { retrieval: trialStages.retrieval, rerank: trialStages.rerank }
                    : trialStages
              }
              answer={answer}
              chunks={chunkMap}
              highlightChunkId={highlightChunkId}
              onChunkHover={setHighlightChunkId}
            />
          )}
          {!selectedStage && <Text c="dimmed">Run a query to inspect each stage.</Text>}
        </ScrollArea>
      </Card>
    </Stack>
  );
}
