import { Alert, Button, Loader, Stack, Text } from "@mantine/core";
import { COPY, runStatusLabel } from "../../lib/copy";
import type { RunPayload } from "../../hooks/types";
import AnswerCards from "./AnswerCards";
import ComboRunSummary from "./ComboRunSummary";
import PlaygroundIdle from "./PlaygroundIdle";
import ResultsPanel from "./ResultsPanel";
import RunTimeline from "./RunTimeline";

type Props = {
  run: RunPayload | undefined;
  runId: string | null;
  runLoading: boolean;
  runError: boolean;
  selectedTrialId: string | null;
  onSelectTrial: (trialId: string) => void;
  onCancel: () => void;
  canceling: boolean;
  onRunAgain: () => void;
};

export default function CanvasPanel({
  run,
  runId,
  runLoading,
  runError,
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

      {runId && runLoading && !run && (
        <Stack align="center" gap="sm" py="xl">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading run…
          </Text>
        </Stack>
      )}

      {runId && runError && !run && (
        <Alert color="red" title="Run load failed">
          Could not load run status. Refresh the page and try again.
        </Alert>
      )}

      {run && (
        <>
          <ComboRunSummary run={run} />

          {isActive && (
            <Button
              type="button"
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
              {run.run.error ?? "Run did not finish."}
            </Alert>
          )}

          <AnswerCards
            combos={run.comboResults ?? []}
            grid={run.grid ?? []}
            selectedTrialId={selectedTrialId}
            onSelect={onSelectTrial}
          />

          <RunTimeline runId={runId} runStatus={run.run.status} />
        </>
      )}

      {run && isComplete && (
        <>
          <ResultsPanel runName={run.run.name} combos={run.comboResults} />
          <Button type="button" variant="light" onClick={onRunAgain} w="fit-content">
            {COPY.app.runAgain}
          </Button>
        </>
      )}
    </Stack>
  );
}
