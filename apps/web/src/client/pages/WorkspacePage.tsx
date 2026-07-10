import { Alert, Button, Stack, Tabs, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { COPY } from "../lib/copy";
import { useDemoBootstrap } from "../hooks/useDemoBootstrap";
import { useModelMatrix } from "../hooks/useModelMatrix";
import { useWorkspaceRun } from "../hooks/useWorkspaceRun";
import CanvasPanel from "../components/workspace/CanvasPanel";
import ComboInspector from "../components/workspace/ComboInspector";
import ControlsPanel from "../components/workspace/ControlsPanel";
import ResizableWorkspace from "../components/workspace/ResizableWorkspace";

export default function WorkspacePage() {
  const mobile = useMediaQuery("(max-width: 70em)");
  const { demo, samples, isLoading, seedDemo, seeding, isError, refetch } = useDemoBootstrap();
  const matrix = useModelMatrix(1);
  const workspace = useWorkspaceRun();

  const [prompt, setPrompt] = useState("");
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);

  useEffect(() => {
    if (samples.length && !selectedSampleId) {
      setSelectedSampleId(samples[0]!.id);
      setPrompt(samples[0]!.text);
    }
  }, [samples, selectedSampleId]);

  useEffect(() => {
    if (matrix.catalog && !matrix.presetApplied && matrix.embModels.length === 0) {
      matrix.applyStarterPreset();
      matrix.setPresetApplied(true);
    }
  }, [matrix.catalog, matrix.presetApplied, matrix.embModels.length, matrix]);

  const selectedSample = useMemo(
    () => samples.find((s) => s.id === selectedSampleId) ?? null,
    [samples, selectedSampleId]
  );

  function handleSampleChange(id: string | null) {
    setSelectedSampleId(id);
    const sample = samples.find((s) => s.id === id);
    if (sample) setPrompt(sample.text);
  }

  async function handleRun() {
    if (!demo?.corpusId || !prompt.trim()) return;

    let questionId = selectedSampleId;
    const usingCustom =
      !selectedSample || prompt.trim() !== selectedSample.text.trim();

    if (usingCustom) {
      const created = await api<{ id: string }>("/api/questions", {
        method: "POST",
        body: JSON.stringify({
          text: prompt.trim(),
          referenceAnswer: selectedSample?.referenceAnswer ?? "No reference answer provided.",
        }),
      });
      questionId = created.id;
    }

    if (!questionId) return;

    const rerankModels = [...(matrix.noRerank ? [null] : []), ...matrix.rerModels];
    workspace.start.mutate({
      corpusId: demo.corpusId,
      questionId,
      name: `Comparison ${new Date().toLocaleTimeString()}`,
      embeddingModels: matrix.embModels,
      rerankModels,
      genModels: matrix.genModels,
      retrieveK: matrix.retrieveK,
      finalK: matrix.finalK,
      budgetUsd: Number(matrix.budget) || 5,
    });
  }

  if (isLoading) {
    return (
      <Text size="sm" c="dimmed" py="xl">
        {COPY.common.loading}
      </Text>
    );
  }

  if (isError) {
    return (
      <Alert color="red" title="Could not load workspace">
        <Button size="compact-sm" variant="light" onClick={() => refetch()}>
          {COPY.common.tryAgain}
        </Button>
      </Alert>
    );
  }

  if (!demo?.ready || !demo.corpusId) {
    return (
      <Stack gap="md" maw={480} py="xl">
        <Text fw={600}>{COPY.workspace.demoMissing}</Text>
        <Text size="sm" c="dimmed">
          Load the SciFact sample corpus to try the comparison demo.
        </Text>
        <Button onClick={() => seedDemo()} loading={seeding}>
          {seeding ? COPY.workspace.loadingDemo : COPY.workspace.loadDemo}
        </Button>
      </Stack>
    );
  }

  const controls = (
    <ControlsPanel
      samples={samples}
      prompt={prompt}
      onPromptChange={setPrompt}
      selectedSampleId={selectedSampleId}
      onSampleChange={handleSampleChange}
      matrix={matrix}
      onRun={() => void handleRun()}
      running={workspace.running || workspace.start.isPending}
      canRun={matrix.canRun && Boolean(prompt.trim())}
    />
  );

  const canvas = (
    <CanvasPanel
      run={workspace.run}
      runId={workspace.runId}
      onCancel={() => workspace.cancel.mutate()}
      canceling={workspace.cancel.isPending}
      onRunAgain={workspace.reset}
      onSelectTrial={workspace.setSelectedTrialId}
      selectedTrialId={workspace.selectedTrialId}
    />
  );

  const inspector = (
    <ComboInspector trial={workspace.trial} loading={workspace.trialLoading} />
  );

  if (mobile) {
    return (
      <Tabs defaultValue="inputs">
        <Tabs.List grow>
          <Tabs.Tab value="inputs">Inputs</Tabs.Tab>
          <Tabs.Tab value="canvas">Live run</Tabs.Tab>
          <Tabs.Tab value="details">Details</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="inputs" pt="md">
          {controls}
        </Tabs.Panel>
        <Tabs.Panel value="canvas" pt="md">
          {canvas}
        </Tabs.Panel>
        <Tabs.Panel value="details" pt="md">
          {inspector}
        </Tabs.Panel>
      </Tabs>
    );
  }

  return <ResizableWorkspace controls={controls} canvas={canvas} inspector={inspector} />;
}
