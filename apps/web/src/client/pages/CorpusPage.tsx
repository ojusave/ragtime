import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Alert,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { DOC_STATUS_LABEL, formatMatrixSummary, friendlyError } from "../lib/copy";

type Doc = { id: string; title: string; status: string; sourceType: string };
type Q = { id: string; text: string; referenceAnswer: string; origin: string };
type Catalog = {
  embedding: { id: string; name: string; pricing?: { prompt?: string } }[];
  rerank: { id: string; name: string }[];
  chat: { id: string; name: string; pricing?: { prompt?: string; completion?: string } }[];
};

const SUGGESTED_EMB = ["baai/bge-large-en-v1.5", "google/gemini-embedding-001"];
const SUGGESTED_GEN = ["mistralai/mistral-small-24b-instruct-2501", "qwen/qwen3.5-9b"];

export default function CorpusPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [noRerank, setNoRerank] = useState(true);
  const [embModels, setEmbModels] = useState<string[]>([]);
  const [rerModels, setRerModels] = useState<string[]>([]);
  const [genModels, setGenModels] = useState<string[]>([]);
  const [retrieveK, setRetrieveK] = useState(20);
  const [finalK, setFinalK] = useState(5);
  const [threshold, setThreshold] = useState<number | string>("");
  const [budget, setBudget] = useState<number | string>(5);
  const [runName, setRunName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: appConfig } = useQuery({
    queryKey: ["config"],
    queryFn: () => api<{ maxTrialsPerRun: number; maxRunBudgetUsd: number }>("/api/config"),
  });

  const { data } = useQuery({
    queryKey: ["corpus", id],
    queryFn: () =>
      api<{ corpus: { name: string }; documents: Doc[]; questions: Q[] }>(
        `/api/corpora/${id}`
      ),
    enabled: Boolean(id),
  });

  const { data: catalog } = useQuery({
    queryKey: ["models"],
    queryFn: () => api<Catalog>("/api/models"),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch(`/api/corpora/${id}/documents`, { method: "POST", body: fd });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["corpus", id] }),
  });

  const addUrl = useMutation({
    mutationFn: () =>
      api(`/api/corpora/${id}/documents`, {
        method: "POST",
        body: JSON.stringify({ url, title: url }),
      }),
    onSuccess: () => {
      setUrl("");
      qc.invalidateQueries({ queryKey: ["corpus", id] });
    },
  });

  const launch = useMutation({
    mutationFn: () => {
      const rerankModels = [...(noRerank ? [null] : []), ...rerModels];
      return api<{ runId: string }>("/api/runs", {
        method: "POST",
        body: JSON.stringify({
          corpusId: id,
          name: runName || `${data?.corpus.name ?? "Run"} comparison`,
          embeddingModels: embModels,
          rerankModels,
          genModels,
          questionIds: "all",
          retrieveK,
          finalK,
          relevanceThreshold: threshold === "" ? undefined : Number(threshold),
          budgetUsd: Number(budget),
        }),
      });
    },
    onSuccess: (r) => {
      setConfirmOpen(false);
      nav(`/run/${r.runId}`);
    },
  });

  const matrix = useMemo(() => {
    const maxTrials = appConfig?.maxTrialsPerRun ?? 324;
    const e = embModels.length || 0;
    const r = (noRerank ? 1 : 0) + rerModels.length;
    const g = genModels.length || 0;
    const q = data?.questions.length ?? 0;
    return formatMatrixSummary({
      embedCount: e,
      rerankCount: r,
      genCount: g,
      questionCount: q,
      budgetUsd: Number(budget) || 0,
      maxTrials,
    });
  }, [embModels, rerModels, genModels, noRerank, data, budget, appConfig]);

  function applySuggestedMatrix() {
    const emb = catalog?.embedding.map((m) => m.id) ?? [];
    const gen = catalog?.chat.map((m) => m.id) ?? [];
    setEmbModels(SUGGESTED_EMB.filter((id) => emb.includes(id)));
    setGenModels(SUGGESTED_GEN.filter((id) => gen.includes(id)));
    setRerModels([]);
    setNoRerank(true);
    setRetrieveK(20);
    setFinalK(5);
  }

  if (!data) return <Text c="dimmed">Loading corpus…</Text>;

  const canLaunch = embModels.length > 0 && genModels.length > 0 && !matrix.overLimit;

  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>{data.corpus.name}</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Upload documents, pick model stacks, then start a comparison run. One run tests every
          stack on every evaluation question.
        </Text>
      </div>

      <Card withBorder>
        <Title order={4} mb="sm">
          Documents
        </Title>
        <Dropzone
          onDrop={(files) => files[0] && upload.mutate(files[0])}
          accept={["text/plain", "text/markdown"]}
          mb="md"
        >
          <Text ta="center">Drop .txt or .md files to add to this corpus</Text>
        </Dropzone>
        <Group mb="md">
          <TextInput
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            style={{ flex: 1 }}
            aria-label="Document URL"
          />
          <Button onClick={() => addUrl.mutate()} disabled={!url}>
            Add URL
          </Button>
        </Group>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.documents.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>{d.title}</Table.Td>
                <Table.Td>{d.sourceType}</Table.Td>
                <Table.Td>
                  <Badge>{DOC_STATUS_LABEL[d.status] ?? d.status}</Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder>
        <Title order={4} mb="sm">
          Evaluation questions ({data.questions.length})
        </Title>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Question</Table.Th>
              <Table.Th>Source</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.questions.map((q) => (
              <Table.Tr key={q.id}>
                <Table.Td>{q.text}</Table.Td>
                <Table.Td>{q.origin === "manual" ? "Golden" : q.origin}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={4}>Configure comparison run</Title>
          <Button variant="light" size="compact-sm" onClick={applySuggestedMatrix}>
            Use suggested 2×2 smoke matrix
          </Button>
        </Group>
        <Stack gap="sm">
          <TextInput
            label="Run name"
            description="Shown on the live run and results pages."
            placeholder={`${data.corpus.name} comparison`}
            value={runName}
            onChange={(e) => setRunName(e.currentTarget.value)}
          />
          <MultiSelect
            label="Embedding models"
            description="Turn text into vectors for retrieval."
            searchable
            data={catalog?.embedding.map((m) => ({ value: m.id, label: m.name })) ?? []}
            value={embModels}
            onChange={setEmbModels}
          />
          <Checkbox
            label="Include a baseline without reranking"
            checked={noRerank}
            onChange={(e) => setNoRerank(e.currentTarget.checked)}
          />
          <MultiSelect
            label="Rerank models"
            description="Optional second pass to reorder retrieved chunks."
            searchable
            data={catalog?.rerank.map((m) => ({ value: m.id, label: m.name })) ?? []}
            value={rerModels}
            onChange={setRerModels}
          />
          <MultiSelect
            label="Generation models"
            description="Chat models that produce answers from retrieved context."
            searchable
            data={catalog?.chat.map((m) => ({ value: m.id, label: m.name })) ?? []}
            value={genModels}
            onChange={setGenModels}
          />
          <Group grow>
            <NumberInput
              label="Chunks to retrieve (top-K)"
              value={retrieveK}
              onChange={(v) => setRetrieveK(Number(v))}
              min={1}
            />
            <NumberInput
              label="Chunks after rerank"
              value={finalK}
              onChange={(v) => setFinalK(Number(v))}
              min={1}
            />
            <NumberInput
              label="Min. rerank score (optional)"
              value={threshold}
              onChange={setThreshold}
              min={0}
              max={1}
              step={0.05}
              decimalScale={2}
            />
            <NumberInput
              label="Max spend for this run (USD)"
              value={budget}
              onChange={setBudget}
              min={0.1}
              step={0.5}
            />
          </Group>
          <Text size="sm" c={matrix.overLimit ? "red" : "dimmed"}>
            {matrix.line}
          </Text>
          {matrix.overLimit && (
            <Alert color="red" title="Too many evaluations">
              Reduce embedding, rerank, or generation models, or pick fewer questions. Large
              matrices can overload the database on starter plans.
            </Alert>
          )}
          {launch.isError && (
            <Alert color="red" title="Could not start run">
              {launch.error instanceof Error
                ? friendlyError(launch.error.message)
                : "Something went wrong."}
            </Alert>
          )}
          <Group>
            <Button component={Link} to={`/corpus/${id}/inspect`} variant="light">
              Pipeline inspector (one question)
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              loading={launch.isPending}
              disabled={!canLaunch}
            >
              Start comparison run
            </Button>
          </Group>
        </Stack>
      </Card>

      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Start comparison run?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">{matrix.line}</Text>
          <Text size="sm" c="dimmed">
            OpenRouter charges apply. The run executes on Render Workflows and may take several
            minutes.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => launch.mutate()} loading={launch.isPending}>
              Confirm and start
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
