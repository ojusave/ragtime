import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatMatrixSummary } from "../lib/copy";
import { deriveStarterPreset } from "../lib/model-preset";
import type { Catalog } from "./types";

export function useModelMatrix(questionCount: number) {
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
    const e = embModels.length || 0;
    const r = (noRerank ? 1 : 0) + rerModels.length;
    const g = genModels.length || 0;
    return formatMatrixSummary({
      embedCount: e,
      rerankCount: r,
      genCount: g,
      questionCount,
      budgetUsd: Number(budget) || 0,
      maxTrials,
    });
  }, [embModels, rerModels, genModels, noRerank, questionCount, budget, appConfig]);

  function applyStarterPreset() {
    const preset = deriveStarterPreset(catalog);
    if (!preset) return;
    const genModelIds = [...new Set([preset.budgetGenModel, preset.midGenModel])];
    setEmbModels([preset.embeddingModel]);
    setGenModels(genModelIds);
    setRerModels([]);
    setNoRerank(true);
    setPresetApplied(true);
  }

  const canRun =
    questionCount > 0 &&
    embModels.length > 0 &&
    genModels.length > 0 &&
    !matrix.overLimit;

  return {
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
    matrix,
    canRun,
    applyStarterPreset,
    presetApplied,
    setPresetApplied,
  };
}
