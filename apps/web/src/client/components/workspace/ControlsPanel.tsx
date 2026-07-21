import {
  Button,
  Checkbox,
  Collapse,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { COPY } from "../../lib/copy";
import type { SampleQuestion } from "../../hooks/types";
import type { useModelMatrix } from "../../hooks/useModelMatrix";
import ProviderMark from "./ProviderMark";

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

function shortLabel(text: string, max = 72): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const fieldProps = { size: "sm" as const };
const selectFieldProps = {
  ...fieldProps,
  comboboxProps: { withinPortal: true },
  classNames: { input: "rag-select-input" },
};

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

  function handleSamplePick(id: string | null) {
    onSampleChange(id);
    const sample = samples.find((s) => s.id === id);
    if (sample) onPromptChange(sample.text);
  }

  return (
    <Stack gap="sm" className="controls-panel">
      <Select
        {...selectFieldProps}
        label={COPY.app.sampleQuestions}
        placeholder="Choose a sample"
        searchable
        clearable
        data={samples.map((s) => ({
          value: s.id,
          label: shortLabel(s.text),
        }))}
        value={selectedSampleId}
        onChange={handleSamplePick}
      />

      <Textarea
        {...fieldProps}
        label={COPY.app.yourQuestion}
        placeholder={COPY.app.promptPlaceholder}
        value={prompt}
        onChange={(e) => onPromptChange(e.currentTarget.value)}
        minRows={2}
        maxRows={5}
        autosize
      />

      <Group justify="space-between" align="center" mt={4}>
        <Text className="pg-section-title">{COPY.app.modelsSection}</Text>
        <Button variant="subtle" size="compact-xs" onClick={applyStarterPreset}>
          {COPY.app.starterPreset}
        </Button>
      </Group>

      <MultiSelect
        {...selectFieldProps}
        label={COPY.app.embedLabel}
        description={COPY.app.embedHint}
        searchable
        data={catalog?.embedding.map((m) => ({ value: m.id, label: m.name })) ?? []}
        renderOption={({ option }) => (
          <Group gap="xs" wrap="nowrap">
            <ProviderMark modelId={option.value} />
            <Text size="sm" lineClamp={1}>{option.label}</Text>
          </Group>
        )}
        value={embModels}
        onChange={setEmbModels}
      />

      <Checkbox
        size="xs"
        label={COPY.app.noRerankLabel}
        checked={noRerank}
        onChange={(e) => setNoRerank(e.currentTarget.checked)}
      />

      <MultiSelect
        {...selectFieldProps}
        label={COPY.app.rerankLabel}
        description={COPY.app.rerankHint}
        searchable
        data={catalog?.rerank.map((m) => ({ value: m.id, label: m.name })) ?? []}
        renderOption={({ option }) => (
          <Group gap="xs" wrap="nowrap">
            <ProviderMark modelId={option.value} />
            <Text size="sm" lineClamp={1}>{option.label}</Text>
          </Group>
        )}
        value={rerModels}
        onChange={setRerModels}
      />

      <MultiSelect
        {...selectFieldProps}
        label={COPY.app.genLabel}
        description={COPY.app.genHint}
        searchable
        data={catalog?.chat.map((m) => ({ value: m.id, label: m.name })) ?? []}
        renderOption={({ option }) => (
          <Group gap="xs" wrap="nowrap">
            <ProviderMark modelId={option.value} />
            <Text size="sm" lineClamp={1}>{option.label}</Text>
          </Group>
        )}
        value={genModels}
        onChange={setGenModels}
      />

      <Button variant="subtle" size="compact-xs" onClick={toggleAdvanced} px={0}>
        {COPY.app.advanced} {advancedOpen ? "▾" : "▸"}
      </Button>

      <Collapse in={advancedOpen}>
        <Stack gap="xs">
          <NumberInput
            {...fieldProps}
            label={COPY.app.retrieveLabel}
            value={retrieveK}
            onChange={(v) => setRetrieveK(Number(v))}
            min={1}
          />
          <NumberInput
            {...fieldProps}
            label={COPY.app.finalKLabel}
            value={finalK}
            onChange={(v) => setFinalK(Number(v))}
            min={1}
          />
          <NumberInput
            {...fieldProps}
            label={COPY.app.budgetLabel}
            value={budget}
            onChange={setBudget}
            min={0.1}
            step={0.5}
          />
        </Stack>
      </Collapse>

      <Text size="xs" c={summary.overLimit ? "red" : "dimmed"}>
        {summary.line}
      </Text>

      <Button type="button" size="sm" onClick={onRun} loading={running} disabled={!canRun || running} fullWidth>
        {running ? COPY.app.runningButton : COPY.app.runButton}
      </Button>
    </Stack>
  );
}
