import { Alert, Button, Stack } from "@mantine/core";
import { COPY, runStatusLabel } from "../../lib/copy";
import type { RunPayload } from "../../hooks/types";
import ComboArenaList from "./ComboArenaList";
import ComboRunSummary from "./ComboRunSummary";
import PlaygroundIdle from "./PlaygroundIdle";
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
      {!runId && <PlaygroundIdle />}

      {run && (
        <>
          <ComboRunSummary run={run} />

          {isActive && (
            <Button
              color="red"
              variant="subtle"
              size="compact-sm"
              onClick={onCancel}
              loading={canceling}
              w="fit-content"
            >
              {COPY.app.cancel}
            </Button>
          )}

          {run.run.status === "failed" && (
            <Alert color="red" title={runStatusLabel("failed")}>
              {run.run.error ?? "The playground run did not finish."}
            </Alert>
          )}

          <ComboArenaList
            combos={run.comboResults}
            grid={run.grid}
            selectedTrialId={selectedTrialId}
            onSelect={onSelectTrial}
          />

          <RunTimeline runId={runId} runStatus={run.run.status} />
        </>
      )}

      {run && isComplete && (
        <>
          <ResultsPanel runName={run.run.name} combos={run.comboResults} />
          <Button variant="light" onClick={onRunAgain} w="fit-content">
            {COPY.app.runAgain}
          </Button>
        </>
      )}
    </Stack>
  );
}
