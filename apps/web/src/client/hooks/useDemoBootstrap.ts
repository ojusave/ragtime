import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { COPY } from "../lib/copy";
import { notifyError, notifySuccess } from "../lib/notify";
import { prioritizeSampleQuestions } from "../lib/sample-display";
import type { DemoInfo, SampleQuestion } from "./types";

export function useDemoBootstrap() {
  const qc = useQueryClient();

  const demo = useQuery({
    queryKey: ["demo"],
    queryFn: () => api<DemoInfo>("/api/demo"),
  });

  const samples = useQuery({
    queryKey: ["samples"],
    queryFn: () => api<SampleQuestion[]>("/api/samples"),
    select: prioritizeSampleQuestions,
    enabled: Boolean(demo.data?.ready),
  });

  const seed = useMutation({
    mutationFn: () =>
      api<{ corpusId: string; name: string }>("/api/seed-demo", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demo"] });
      qc.invalidateQueries({ queryKey: ["samples"] });
      notifySuccess(COPY.notify.demoLoaded);
    },
    onError: (e) =>
      notifyError("Could not load sample data", e instanceof Error ? e.message : undefined),
  });

  const needsSeed = Boolean(demo.data && !demo.data.ready);

  useEffect(() => {
    if (needsSeed && !seed.isPending && !seed.isSuccess && !seed.isError) {
      seed.mutate();
    }
  }, [needsSeed, seed.isPending, seed.isSuccess, seed.isError, seed.mutate]);

  return {
    demo: demo.data,
    samples: samples.data ?? [],
    isLoading: demo.isLoading,
    isBootstrapping: needsSeed && seed.isPending,
    isError: demo.isError,
    error: demo.error,
    refetch: demo.refetch,
    seedDemo: seed.mutate,
    seeding: seed.isPending,
    seedFailed: seed.isError,
    seedError: seed.error instanceof Error ? seed.error.message : undefined,
  };
}
