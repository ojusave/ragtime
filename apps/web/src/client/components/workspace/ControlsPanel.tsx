import {
  Button,
  Checkbox,
  Collapse,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Stack,
  Text,
  Textarea,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { COPY } from "../../lib/copy";
import type { SampleQuestion } from "../../hooks/types";
import type { useModelMatrix } from "../../hooks/useModelMatrix";

const SUGGESTED_EMB = ["baai/bge-large-en-v1.5", "google/gemini-embedding-001"];
const SUGGESTED_GEN = ["mistralai/mistral-small-24b-instruct-2501", "qwen/qwen3.5-9b"];

type Matrix = ReturnType<typeof useModelMatrix>;

type Props = {
  samples: SampleQuestion[];
  prompt: string;
  onPromptChange: (value: string) => void;
  selectedSampleId: string | null;
  onSampleChange: (id: string | null) => void;
  matrix: Matrix;
  onRun: () => void;
  running: boolean;
  canRun: boolean;
};

function shortLabel(text: string, max = 64): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function toggleModel(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((m) => m !== id) : [...list, id];
}

export default function ControlsPanel({
  samples,
  prompt,
  onPromptChange,
  selectedSampleId,
  onSampleChange,
  matrix,
  onRun,
  running,
  canRun,
}: Props) {
  const [advancedOpen, { toggle: toggleAdvanced }] = useDisclosure(false);
  const {
    catalog,
    embModels,
    setEmbModels,
    rerModels,
    setRerModels,
    genModels,
    setGenModels,
    noRerank,
    setNoRerank,
    retrieveK,
    setRetrieveK,
    finalK,
    setFinalK,
    budget,
    setBudget,
    matrix: summary,
    applyStarterPreset,
  } = matrix;

  const embedCatalog = catalog?.embedding ?? [];
  const genCatalog = catalog?.chat ?? [];
  const suggestedEmb = SUGGESTED_EMB.map((id) => embedCatalog.find((m) => m.id === id)).filter(
    Boolean
  ) as Array<{ id: string; name: string }>;
  const suggestedGen = SUGGESTED_GEN.map((id) => genCatalog.find((m) => m.id === id)).filter(
    Boolean
  ) as Array<{ id: string; name: string }>;

  return (
    <Stack gap="md" className="controls-panel">
      <Paper className="pg-panel" p="md">
        <Stack gap="md">
          <Text className="pg-section-title">{COPY.app.questionSection}</Text>

          <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={500}>
              {COPY.app.sampleQuestions}
            </Text>
            <Group gap="xs">
              {samples.slice(0, 6).map((sample) => {
                const active = selectedSampleId === sample.id;
                return (
                  <UnstyledButton
                    key={sample.id}
                    className={`pg-sample-chip${active ? " pg-sample-chip--active" : ""}`}
                    onClick={() => {
                      onSampleChange(sample.id);
                      onPromptChange(sample.text);
                    }}
                  >
                    {shortLabel(sample.text)}
                  </UnstyledButton>
                );
              })}
            </Group>
          </Stack>

          <Textarea
            label={COPY.app.yourQuestion}
            placeholder={COPY.app.promptPlaceholder}
            value={prompt}
            onChange={(e) => onPromptChange(e.currentTarget.value)}
            minRows={3}
            autosize
          />
        </Stack>
      </Paper>

      <Paper className="pg-panel" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text className="pg-section-title">{COPY.app.modelsSection}</Text>
            <Button variant="light" size="compact-xs" onClick={applyStarterPreset}>
              {COPY.app.starterPreset}
            </Button>
          </Group>

          {suggestedEmb.length > 0 && (
            <Stack gap={6}>
              <Text size="xs" c="dimmed">
                {COPY.app.suggested} · embedding
              </Text>
              <Group gap="xs" grow preventGrowOverflow={false}>
                {suggestedEmb.map((model) => {
                  const active = embModels.includes(model.id);
                  return (
                    <UnstyledButton
                      key={model.id}
                      className={`pg-model-pick${active ? " pg-model-pick--active" : ""}`}
                      onClick={() => setEmbModels(toggleModel(embModels, model.id))}
                    >
                      <Text size="sm" fw={active ? 600 : 500} lineClamp={1}>
                        {model.name}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </Group>
            </Stack>
          )}

          <MultiSelect
            label={COPY.app.embedLabel}
            searchable
            data={embedCatalog.map((m) => ({ value: m.id, label: m.name }))}
            value={embModels}
            onChange={setEmbModels}
          />

          <Checkbox
            label={COPY.app.noRerankLabel}
            checked={noRerank}
            onChange={(e) => setNoRerank(e.currentTarget.checked)}
          />

          <MultiSelect
            label={COPY.app.rerankLabel}
            searchable
            data={catalog?.rerank.map((m) => ({ value: m.id, label: m.name })) ?? []}
            value={rerModels}
            onChange={setRerModels}
          />

          {suggestedGen.length > 0 && (
            <Stack gap={6}>
              <Text size="xs" c="dimmed">
                {COPY.app.suggested} · generation
              </Text>
              <Group gap="xs" grow preventGrowOverflow={false}>
                {suggestedGen.map((model) => {
                  const active = genModels.includes(model.id);
                  return (
                    <UnstyledButton
                      key={model.id}
                      className={`pg-model-pick${active ? " pg-model-pick--active" : ""}`}
                      onClick={() => setGenModels(toggleModel(genModels, model.id))}
                    >
                      <Text size="sm" fw={active ? 600 : 500} lineClamp={1}>
                        {model.name}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </Group>
            </Stack>
          )}

          <MultiSelect
            label={COPY.app.genLabel}
            searchable
            data={genCatalog.map((m) => ({ value: m.id, label: m.name }))}
            value={genModels}
            onChange={setGenModels}
          />
        </Stack>
      </Paper>

      <Button variant="subtle" size="compact-sm" onClick={toggleAdvanced} px={0}>
        {COPY.app.advanced} {advancedOpen ? "▾" : "▸"}
      </Button>
      <Collapse in={advancedOpen}>
        <Paper className="pg-panel pg-panel--dashed" p="md">
          <Stack gap="sm">
            <NumberInput
              label={COPY.app.retrieveLabel}
              value={retrieveK}
              onChange={(v) => setRetrieveK(Number(v))}
              min={1}
            />
            <NumberInput
              label={COPY.app.finalKLabel}
              value={finalK}
              onChange={(v) => setFinalK(Number(v))}
              min={1}
            />
            <NumberInput
              label={COPY.app.budgetLabel}
              value={budget}
              onChange={setBudget}
              min={0.1}
              step={0.5}
            />
          </Stack>
        </Paper>
      </Collapse>

      <Text size="sm" c={summary.overLimit ? "red" : "dimmed"} className="pg-matrix-hint">
        {summary.line}
      </Text>

      <Button
        className="pg-launch"
        size="md"
        onClick={onRun}
        loading={running}
        disabled={!canRun || running}
        fullWidth
      >
        {running ? COPY.app.runningButton : COPY.app.runButton}
      </Button>
    </Stack>
  );
}
