import { Alert, Button, Stack, Text } from "@mantine/core";
import { COPY, runStatusLabel } from "../../lib/copy";
import type { RunPayload } from "../../hooks/types";
import ComboExecutionTrace from "./ComboExecutionTrace";
import ComboProgressGrid from "./ComboProgressGrid";
import ComboRunSummary from "./ComboRunSummary";
import ResultsPanel from "./ResultsPanel";
import RunTimeline from "./RunTimeline";

type Props = {
  run: RunPayload | undefined;
  runId: string | null;
  selectedTrialId: string | null;
  onSelectTrial: (trialId: string) => void;
  onCancel: () => void;
  canceling: boolean;
  onRunAgain: () => void;
};

export default function CanvasPanel({
  run,
  runId,
  selectedTrialId,
  onSelectTrial,
  onCancel,
  canceling,
  onRunAgain,
}: Props) {
  const status = run?.run.status;
  const isActive = status === "ingesting" || status === "running" || status === "aggregating";
  const isComplete = status === "complete" || status === "budget_exceeded";

  return (
    <Stack gap="md" className="canvas-panel">
      {!runId && (
        <Text size="sm" c="dimmed">
          {COPY.workspace.canvasIdle}
        </Text>
      )}

      <ComboRunSummary run={run} />

      {run && isActive && (
        <Button color="red" variant="outline" size="compact-sm" onClick={onCancel} loading={canceling} w="fit-content">
          {COPY.workspace.cancel}
        </Button>
      )}

      {run?.run.status === "failed" && (
        <Alert color="red" title={runStatusLabel("failed")}>
          {run.run.error ?? "The comparison did not finish."}
        </Alert>
      )}

      {run && (
        <>
          <ComboProgressGrid
            combos={run.comboResults}
            grid={run.grid}
            selectedTrialId={selectedTrialId}
            onSelect={onSelectTrial}
          />
          <ComboExecutionTrace combos={run.comboResults} grid={run.grid} />
          <RunTimeline runId={runId} runStatus={run.run.status} />
        </>
      )}

      {run && isComplete && (
        <>
          <ResultsPanel runName={run.run.name} combos={run.comboResults} />
          <Button variant="light" onClick={onRunAgain} w="fit-content">
            {COPY.workspace.runAgain}
          </Button>
        </>
      )}
    </Stack>
  );
}
