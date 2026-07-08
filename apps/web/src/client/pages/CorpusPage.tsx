import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
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

type Doc = { id: string; title: string; status: string; sourceType: string };
type Q = { id: string; text: string; referenceAnswer: string; origin: string };
type Catalog = {
  embedding: { id: string; name: string; pricing?: { prompt?: string } }[];
  rerank: { id: string; name: string }[];
  chat: { id: string; name: string; pricing?: { prompt?: string; completion?: string } }[];
};

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
  const [runName, setRunName] = useState("Bake-off");

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
      const rerankModels = [
        ...(noRerank ? [null] : []),
        ...rerModels,
      ];
      return api<{ runId: string }>("/api/runs", {
        method: "POST",
        body: JSON.stringify({
          corpusId: id,
          name: runName,
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
    onSuccess: (r) => nav(`/run/${r.runId}`),
  });

  const matrixSummary = useMemo(() => {
    const e = embModels.length || 0;
    const r = (noRerank ? 1 : 0) + rerModels.length;
    const g = genModels.length || 0;
    const combos = e * r * g;
    const q = data?.questions.length ?? 0;
    return `${e} x ${r} x ${g} = ${combos} combos, ${combos * q} trials (estimate: bounded by $${budget} budget)`;
  }, [embModels, rerModels, genModels, noRerank, data, budget]);

  if (!data) return <Text>Loading...</Text>;

  return (
    <Stack gap="xl">
      <Title order={2}>{data.corpus.name}</Title>

      <Card withBorder>
        <Title order={4} mb="sm">Documents</Title>
        <Dropzone
          onDrop={(files) => files[0] && upload.mutate(files[0])}
          accept={["text/plain", "text/markdown"]}
          mb="md"
        >
          <Text ta="center">Drop .txt or .md files</Text>
        </Dropzone>
        <Group mb="md">
          <TextInput placeholder="https://..." value={url} onChange={(e) => setUrl(e.currentTarget.value)} style={{ flex: 1 }} />
          <Button onClick={() => addUrl.mutate()} disabled={!url}>Add URL</Button>
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
                <Table.Td><Badge>{d.status}</Badge></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder>
        <Title order={4} mb="sm">Questions ({data.questions.length})</Title>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Question</Table.Th>
              <Table.Th>Origin</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.questions.map((q) => (
              <Table.Tr key={q.id}>
                <Table.Td>{q.text}</Table.Td>
                <Table.Td>{q.origin}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder>
        <Title order={4} mb="sm">New bake-off</Title>
        <Stack gap="sm">
          <TextInput label="Run name" value={runName} onChange={(e) => setRunName(e.currentTarget.value)} />
          <MultiSelect
            label="Embedding models"
            searchable
            data={catalog?.embedding.map((m) => ({ value: m.id, label: m.name })) ?? []}
            value={embModels}
            onChange={setEmbModels}
          />
          <Checkbox label="Include no rerank option" checked={noRerank} onChange={(e) => setNoRerank(e.currentTarget.checked)} />
          <MultiSelect
            label="Rerank models"
            searchable
            data={catalog?.rerank.map((m) => ({ value: m.id, label: m.name })) ?? []}
            value={rerModels}
            onChange={setRerModels}
          />
          <MultiSelect
            label="Generation models"
            searchable
            data={catalog?.chat.map((m) => ({ value: m.id, label: m.name })) ?? []}
            value={genModels}
            onChange={setGenModels}
          />
          <Group grow>
            <NumberInput label="Retrieve K" value={retrieveK} onChange={(v) => setRetrieveK(Number(v))} min={1} />
            <NumberInput label="Final K" value={finalK} onChange={(v) => setFinalK(Number(v))} min={1} />
            <NumberInput label="Relevance threshold" value={threshold} onChange={setThreshold} min={0} max={1} step={0.05} decimalScale={2} />
            <NumberInput label="Budget USD" value={budget} onChange={setBudget} min={0.1} step={0.5} />
          </Group>
          <Text size="sm" c="dimmed">{matrixSummary}</Text>
          {launch.isError && (
            <Alert color="red" title="Could not start bake-off">
              {launch.error instanceof Error ? launch.error.message : "Unknown error"}
            </Alert>
          )}
          <Button component={Link} to={`/corpus/${id}/inspect`} variant="light">
            Inspect a single query
          </Button>
          <Button
            onClick={() => launch.mutate()}
            loading={launch.isPending}
            disabled={!embModels.length || !genModels.length}
          >
            Launch bake-off
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
