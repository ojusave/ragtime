import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { COPY, friendlyError } from "../lib/copy";
import { notifyError, notifySuccess } from "../lib/notify";
import type { RunPayload, TrialDetail } from "./types";

const ACTIVE = new Set(["ingesting", "running", "aggregating", "draft"]);

type StartArgs = {
  corpusId: string;
  questionId: string;
  name: string;
  embeddingModels: string[];
  rerankModels: (string | null)[];
  genModels: string[];
  retrieveK: number;
  finalK: number;
  budgetUsd: number;
};

export function useWorkspaceRun() {
  const qc = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);

  const runQuery = useQuery({
    queryKey: ["workspace-run", runId],
    queryFn: () => api<RunPayload>(`/api/runs/${runId}`),
    enabled: Boolean(runId),
    refetchInterval: (q) =>
      ACTIVE.has(q.state.data?.run.status ?? "") ? 2000 : false,
  });

  const trialQuery = useQuery({
    queryKey: ["workspace-trial", selectedTrialId],
    queryFn: () => api<TrialDetail>(`/api/trials/${selectedTrialId}`),
    enabled: Boolean(selectedTrialId),
  });

  const start = useMutation({
    mutationFn: async (args: StartArgs) => {
      const rerankModels = args.rerankModels;
      return api<{ runId: string }>("/api/runs", {
        method: "POST",
        body: JSON.stringify({
          corpusId: args.corpusId,
          name: args.name,
          embeddingModels: args.embeddingModels,
          rerankModels,
          genModels: args.genModels,
          questionIds: [args.questionId],
          retrieveK: args.retrieveK,
          finalK: args.finalK,
          budgetUsd: args.budgetUsd,
        }),
      });
    },
    onSuccess: (data) => {
      setRunId(data.runId);
      setSelectedTrialId(null);
      notifySuccess(COPY.notify.comparisonStarted);
      qc.invalidateQueries({ queryKey: ["workspace-run", data.runId] });
    },
    onError: (e) =>
      notifyError(
        "Could not start comparison",
        e instanceof Error ? friendlyError(e.message) : undefined
      ),
  });

  const cancel = useMutation({
    mutationFn: () => api(`/api/runs/${runId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      notifySuccess(COPY.notify.comparisonStopped);
      qc.invalidateQueries({ queryKey: ["workspace-run", runId] });
    },
    onError: (e) =>
      notifyError(
        "Could not stop run",
        e instanceof Error ? friendlyError(e.message) : undefined
      ),
  });

  const reset = useCallback(() => {
    setRunId(null);
    setSelectedTrialId(null);
  }, []);

  const running = Boolean(runId && ACTIVE.has(runQuery.data?.run.status ?? ""));

  return {
    runId,
    run: runQuery.data,
    isLoadingRun: runQuery.isLoading,
    running,
    start,
    cancel,
    reset,
    selectedTrialId,
    setSelectedTrialId,
    trial: trialQuery.data,
    trialLoading: trialQuery.isLoading,
  };
}
