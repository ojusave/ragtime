import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatMatrixSummary } from "../lib/copy";
import type { Catalog } from "./types";

// REVIEW L2 (Low): README claims "no hardcoded model slugs in app code", but these
// presets are hardcoded (and duplicated in CorpusPage). Not a security issue since they
// are filtered against the live catalog, but fix the README claim, centralize the IDs in
// one config module, and handle the empty-starter case when these slugs leave the
// catalog.
const SUGGESTED_EMB = ["baai/bge-large-en-v1.5", "google/gemini-embedding-001"];
const SUGGESTED_GEN = ["mistralai/mistral-small-24b-instruct-2501", "qwen/qwen3.5-9b"];

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
    const emb = catalog?.embedding.map((m) => m.id) ?? [];
    const gen = catalog?.chat.map((m) => m.id) ?? [];
    setEmbModels(SUGGESTED_EMB.filter((mid) => emb.includes(mid)));
    setGenModels(SUGGESTED_GEN.filter((mid) => gen.includes(mid)));
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
