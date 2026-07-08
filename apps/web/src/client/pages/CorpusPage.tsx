import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  ScrollArea,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import FlowSteps from "../components/FlowSteps";
import PageHeader from "../components/PageHeader";
import QueryState from "../components/QueryState";
import RunHistoryList from "../components/RunHistoryList";
import { api } from "../lib/api";
import { DOC_STATUS_LABEL, formatMatrixSummary, friendlyError, COPY, FLOW_STEPS, QUESTION_SOURCE_LABEL } from "../lib/copy";
import { notifyError, notifySuccess } from "../lib/notify";

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
  const [qText, setQText] = useState("");
  const [qAnswer, setQAnswer] = useState("");

  const { data: appConfig } = useQuery({
    queryKey: ["config"],
    queryFn: () => api<{ maxTrialsPerRun: number; maxRunBudgetUsd: number }>("/api/config"),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["corpus", id],
    queryFn: () =>
      api<{ corpus: { id: string; name: string }; documents: Doc[]; questions: Q[] }>(
        `/api/corpora/${id}`
      ),
    enabled: Boolean(id),
  });

  const { data: catalog } = useQuery({
    queryKey: ["models"],
    queryFn: () => api<Catalog>("/api/models"),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/corpora/${id}/documents`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corpus", id] });
      notifySuccess(COPY.notify.docUploaded);
    },
    onError: (e) =>
      notifyError("Upload failed", e instanceof Error ? friendlyError(e.message) : undefined),
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
      notifySuccess(COPY.notify.urlAdded);
    },
    onError: (e) =>
      notifyError("Could not add URL", e instanceof Error ? friendlyError(e.message) : undefined),
  });

  const addQuestion = useMutation({
    mutationFn: () =>
      api(`/api/corpora/${id}/questions`, {
        method: "POST",
        body: JSON.stringify({ text: qText.trim(), referenceAnswer: qAnswer.trim() }),
      }),
    onSuccess: () => {
      setQText("");
      setQAnswer("");
      qc.invalidateQueries({ queryKey: ["corpus", id] });
      notifySuccess(COPY.notify.questionAdded);
    },
    onError: (e) =>
      notifyError("Could not add question", e instanceof Error ? friendlyError(e.message) : undefined),
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
      notifySuccess(COPY.notify.comparisonStarted);
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
    setEmbModels(SUGGESTED_EMB.filter((mid) => emb.includes(mid)));
    setGenModels(SUGGESTED_GEN.filter((mid) => gen.includes(mid)));
    setRerModels([]);
    setNoRerank(true);
    setRetrieveK(20);
    setFinalK(5);
  }

  const readyDocs = data?.documents.filter((d) => d.status === "ready").length ?? 0;
  const canLaunch =
    Boolean(data?.questions.length) &&
    embModels.length > 0 &&
    genModels.length > 0 &&
    !matrix.overLimit;

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      notFound={!isLoading && !isError && !data}
    >
      {data && (
        <Stack gap="xl">
          <PageHeader
            title={data.corpus.name}
            description={COPY.corpus.description}
            crumbs={[{ label: "Home", to: "/" }, { label: data.corpus.name }]}
            actions={
              <Button component={Link} to={`/corpus/${id}/inspect`} variant="light">
                {COPY.corpus.tryOneQuestion}
              </Button>
            }
          />

          <FlowSteps
            active={1}
            steps={[
              { ...FLOW_STEPS[0], description: `${readyDocs} docs · ${data.questions.length} questions` },
              FLOW_STEPS[1],
              FLOW_STEPS[2],
              FLOW_STEPS[3],
            ]}
          />

          {id && <RunHistoryList corpusId={id} />}

          <Card withBorder>
            <Text fw={600} mb="sm">
              {COPY.corpus.documentsHeading}
            </Text>
            <Dropzone
              onDrop={(files) => files[0] && upload.mutate(files[0])}
              accept={["text/plain", "text/markdown"]}
              mb="md"
              disabled={upload.isPending}
            >
              <Text ta="center">
                {upload.isPending ? COPY.corpus.dropzoneLoading : COPY.corpus.dropzone}
              </Text>
            </Dropzone>
            <Group mb="md">
              <TextInput
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.currentTarget.value)}
                style={{ flex: 1 }}
                aria-label="Document URL"
              />
              <Button onClick={() => addUrl.mutate()} disabled={!url} loading={addUrl.isPending}>
                Add URL
              </Button>
            </Group>
            <ScrollArea>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Title</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.documents.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={3}>
                        <EmptyState
                          title={COPY.corpus.emptyDocs}
                          hint={COPY.corpus.emptyDocsHint}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    data.documents.map((d) => (
                      <Table.Tr key={d.id}>
                        <Table.Td>{d.title}</Table.Td>
                        <Table.Td>{d.sourceType}</Table.Td>
                        <Table.Td>
                          <Badge>{DOC_STATUS_LABEL[d.status] ?? d.status}</Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>

          <Card withBorder>
            <Text fw={600} mb="sm">
              {COPY.corpus.questionsHeading(data.questions.length)}
            </Text>
            <Stack gap="sm" mb="md">
              <Textarea
                label={COPY.corpus.questionLabel}
                placeholder={COPY.corpus.questionPlaceholder}
                value={qText}
                onChange={(e) => setQText(e.currentTarget.value)}
                minRows={2}
              />
              <Textarea
                label={COPY.corpus.expectedAnswerLabel}
                placeholder={COPY.corpus.expectedAnswerPlaceholder}
                value={qAnswer}
                onChange={(e) => setQAnswer(e.currentTarget.value)}
                minRows={2}
              />
              <Button
                onClick={() => addQuestion.mutate()}
                loading={addQuestion.isPending}
                disabled={!qText.trim() || !qAnswer.trim()}
                w="fit-content"
              >
                {COPY.corpus.addQuestion}
              </Button>
            </Stack>
            <ScrollArea>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Question</Table.Th>
                    <Table.Th>Source</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.questions.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={2}>
                        <EmptyState
                          title={COPY.corpus.emptyQuestions}
                          hint={COPY.corpus.emptyQuestionsHint}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    data.questions.map((q) => (
                      <Table.Tr key={q.id}>
                        <Table.Td>{q.text}</Table.Td>
                        <Table.Td>{QUESTION_SOURCE_LABEL[q.origin] ?? q.origin}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>

          <Card withBorder>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>{COPY.corpus.configureHeading}</Text>
              <Button variant="light" size="compact-sm" onClick={applySuggestedMatrix}>
                {COPY.corpus.suggestedPreset}
              </Button>
            </Group>
            <Stack gap="sm">
              <TextInput
                label={COPY.corpus.runNameLabel}
                description={COPY.corpus.runNameDescription}
                placeholder={`${data.corpus.name} comparison`}
                value={runName}
                onChange={(e) => setRunName(e.currentTarget.value)}
              />
              <MultiSelect
                label={COPY.corpus.embedLabel}
                description={COPY.corpus.embedDescription}
                searchable
                data={catalog?.embedding.map((m) => ({ value: m.id, label: m.name })) ?? []}
                value={embModels}
                onChange={setEmbModels}
              />
              <Checkbox
                label={COPY.corpus.noRerankLabel}
                checked={noRerank}
                onChange={(e) => setNoRerank(e.currentTarget.checked)}
              />
              <MultiSelect
                label={COPY.corpus.rerankLabel}
                description={COPY.corpus.rerankDescription}
                searchable
                data={catalog?.rerank.map((m) => ({ value: m.id, label: m.name })) ?? []}
                value={rerModels}
                onChange={setRerModels}
              />
              <MultiSelect
                label={COPY.corpus.genLabel}
                description={COPY.corpus.genDescription}
                searchable
                data={catalog?.chat.map((m) => ({ value: m.id, label: m.name })) ?? []}
                value={genModels}
                onChange={setGenModels}
              />
              <Group grow wrap="wrap">
                <NumberInput
                  label={COPY.corpus.retrieveLabel}
                  value={retrieveK}
                  onChange={(v) => setRetrieveK(Number(v))}
                  min={1}
                />
                <NumberInput
                  label={COPY.corpus.finalKLabel}
                  value={finalK}
                  onChange={(v) => setFinalK(Number(v))}
                  min={1}
                />
                <NumberInput
                  label={COPY.corpus.thresholdLabel}
                  value={threshold}
                  onChange={setThreshold}
                  min={0}
                  max={1}
                  step={0.05}
                  decimalScale={2}
                />
                <NumberInput
                  label={COPY.corpus.budgetLabel}
                  value={budget}
                  onChange={setBudget}
                  min={0.1}
                  step={0.5}
                />
              </Group>
              <Text size="sm" c={matrix.overLimit ? "red" : "dimmed"}>
                {matrix.line}
              </Text>
              {!data.questions.length && (
                <Alert color="yellow" title={COPY.corpus.needQuestionsTitle}>
                  {COPY.corpus.needQuestions}
                </Alert>
              )}
              {matrix.overLimit && (
                <Alert color="red" title={COPY.corpus.tooManyTests}>
                  {COPY.corpus.tooManyTestsBody}
                </Alert>
              )}
              {launch.isError && (
                <Alert color="red" title="Could not start comparison">
                  {launch.error instanceof Error
                    ? friendlyError(launch.error.message)
                    : "Something went wrong."}
                </Alert>
              )}
              <Group>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  loading={launch.isPending}
                  disabled={!canLaunch}
                >
                  {COPY.corpus.startButton}
                </Button>
              </Group>
            </Stack>
          </Card>

          <Modal
            opened={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title={COPY.corpus.confirmTitle}
            centered
          >
            <Stack gap="md">
              <Text size="sm">{matrix.line}</Text>
              <Text size="sm" c="dimmed">
                {COPY.corpus.confirmNote}
              </Text>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setConfirmOpen(false)}>
                  {COPY.common.cancel}
                </Button>
                <Button onClick={() => launch.mutate()} loading={launch.isPending}>
                  {COPY.common.confirm}
                </Button>
              </Group>
            </Stack>
          </Modal>
        </Stack>
      )}
    </QueryState>
  );
}
