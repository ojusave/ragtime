import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatSetupSummary } from "../lib/copy";
import {
  blankSetup,
  deriveStarterSetups,
  newSetupId,
} from "../lib/model-preset";
import type { Catalog, Setup } from "./types";

export function useModelMatrix(questionCount: number) {
  // Explicit setups are the source of truth for a run.
  const [setups, setSetups] = useState<Setup[]>([]);
  // Matrix-mode selectors only feed the "expand into setups" helper.
  const [embModels, setEmbModels] = useState<string[]>([]);
  const [rerModels, setRerModels] = useState<string[]>([]);
  const [genModels, setGenModels] = useState<string[]>([]);
  const [noRerank, setNoRerank] = useState(true);
  const [retrieveK, setRetrieveK] = useState(20);
  const [finalK, setFinalK] = useState(5);
  const [budget, setBudget] = useState<number | string>(5);
  const [presetApplied, setPresetApplied] = useState(false);

  const { data: catalog } = useQuery({
    queryKey: ["models"],
    queryFn: () => api<Catalog>("/api/models"),
  });

  const { data: appConfig } = useQuery({
    queryKey: ["config"],
    queryFn: () => api<{ maxTrialsPerRun: number; maxRunBudgetUsd: number }>("/api/config"),
  });

  const matrix = useMemo(() => {
    const maxTrials = appConfig?.maxTrialsPerRun ?? 324;
    return formatSetupSummary({
      setupCount: setups.length,
      questionCount,
      budgetUsd: Number(budget) || 0,
      maxTrials,
    });
  }, [setups, questionCount, budget, appConfig]);

  function addSetup() {
    setSetups((prev) => [...prev, blankSetup(catalog)]);
  }

  function updateSetup(id: string, patch: Partial<Omit<Setup, "id">>) {
    setSetups((prev) =>
      prev.map((setup) => (setup.id === id ? { ...setup, ...patch } : setup))
    );
  }

  function removeSetup(id: string) {
    setSetups((prev) => prev.filter((setup) => setup.id !== id));
  }

  function applyStarterPreset() {
    const starter = deriveStarterSetups(catalog);
    if (starter.length === 0) return;
    setSetups(starter);
    setPresetApplied(true);
  }

  /** Cross every selected model and append the results as explicit setups. */
  function expandMatrixToSetups() {
    const rerankChoices = [
      ...(noRerank ? [null] : []),
      ...rerModels,
    ];
    if (embModels.length === 0 || genModels.length === 0 || rerankChoices.length === 0) {
      return;
    }
    const expanded: Setup[] = [];
    for (const embeddingModel of embModels) {
      for (const rerankModel of rerankChoices) {
        for (const genModel of genModels) {
          expanded.push({
            id: newSetupId(),
            embeddingModel,
            rerankModel,
            genModel,
          });
        }
      }
    }
    setSetups((prev) => {
      const seen = new Set(
        prev.map((s) => `${s.embeddingModel}|${s.rerankModel ?? ""}|${s.genModel}`)
      );
      const additions = expanded.filter(
        (s) => !seen.has(`${s.embeddingModel}|${s.rerankModel ?? ""}|${s.genModel}`)
      );
      return [...prev, ...additions];
    });
  }

  const setupsValid = setups.every(
    (setup) => setup.embeddingModel && setup.genModel
  );
  const canRun =
    questionCount > 0 && setups.length > 0 && setupsValid && !matrix.overLimit;

  return {
    catalog,
    setups,
    addSetup,
    updateSetup,
    removeSetup,
    embModels,
    setEmbModels,
    rerModels,
    setRerModels,
    genModels,
    setGenModels,
    noRerank,
    setNoRerank,
    expandMatrixToSetups,
    retrieveK,
    setRetrieveK,
    finalK,
    setFinalK,
    budget,
    setBudget,
    matrix,
    canRun,
    applyStarterPreset,
    presetApplied,
    setPresetApplied,
  };
}
