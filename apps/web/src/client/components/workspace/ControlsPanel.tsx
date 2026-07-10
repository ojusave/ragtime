import {
  Button,
  Checkbox,
  Collapse,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ReactNode } from "react";
import { COPY } from "../../lib/copy";
import type { SampleQuestion } from "../../hooks/types";
import type { useModelMatrix } from "../../hooks/useModelMatrix";

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

  return (
    <Stack gap="md" className="controls-panel">
      <Stack gap={4}>
        <Text className="rag-kicker">Inputs</Text>
        <Text fw={600}>{COPY.workspace.title}</Text>
        <Text size="sm" c="dimmed">
          {COPY.workspace.subtitle}
        </Text>
      </Stack>

      <Select
        label={COPY.workspace.sampleLabel}
        placeholder="Pick a sample question"
        data={samples.map((s) => ({
          value: s.id,
          label: s.text.length > 72 ? `${s.text.slice(0, 72)}…` : s.text,
        }))}
        value={selectedSampleId}
        onChange={onSampleChange}
        searchable
        clearable
      />

      <Textarea
        label={COPY.workspace.customPrompt}
        placeholder={COPY.workspace.promptPlaceholder}
        value={prompt}
        onChange={(e) => onPromptChange(e.currentTarget.value)}
        minRows={3}
      />

      <Stack gap="sm">
        <GroupBetween label={COPY.workspace.modelsHeading} action={
          <Button variant="light" size="compact-xs" onClick={applyStarterPreset}>
            {COPY.workspace.starterPreset}
          </Button>
        } />
        <MultiSelect
          label={COPY.workspace.embedLabel}
          searchable
          data={catalog?.embedding.map((m) => ({ value: m.id, label: m.name })) ?? []}
          value={embModels}
          onChange={setEmbModels}
        />
        <Checkbox
          label={COPY.workspace.noRerankLabel}
          checked={noRerank}
          onChange={(e) => setNoRerank(e.currentTarget.checked)}
        />
        <MultiSelect
          label={COPY.workspace.rerankLabel}
          searchable
          data={catalog?.rerank.map((m) => ({ value: m.id, label: m.name })) ?? []}
          value={rerModels}
          onChange={setRerModels}
        />
        <MultiSelect
          label={COPY.workspace.genLabel}
          searchable
          data={catalog?.chat.map((m) => ({ value: m.id, label: m.name })) ?? []}
          value={genModels}
          onChange={setGenModels}
        />
      </Stack>

      <Button variant="subtle" size="compact-sm" onClick={toggleAdvanced} px={0}>
        {COPY.workspace.advanced} {advancedOpen ? "▾" : "▸"}
      </Button>
      <Collapse in={advancedOpen}>
        <Stack gap="sm">
          <NumberInput
            label={COPY.workspace.retrieveLabel}
            value={retrieveK}
            onChange={(v) => setRetrieveK(Number(v))}
            min={1}
          />
          <NumberInput
            label={COPY.workspace.finalKLabel}
            value={finalK}
            onChange={(v) => setFinalK(Number(v))}
            min={1}
          />
          <NumberInput
            label={COPY.workspace.budgetLabel}
            value={budget}
            onChange={setBudget}
            min={0.1}
            step={0.5}
          />
        </Stack>
      </Collapse>

      <Text size="sm" c={summary.overLimit ? "red" : "dimmed"}>
        {summary.line}
      </Text>

      <Button onClick={onRun} loading={running} disabled={!canRun || running} fullWidth>
        {running ? COPY.workspace.runningButton : COPY.workspace.runButton}
      </Button>
    </Stack>
  );
}

function GroupBetween({ label, action }: { label: string; action: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <Text fw={600} size="sm">
        {label}
      </Text>
      {action}
    </div>
  );
}
