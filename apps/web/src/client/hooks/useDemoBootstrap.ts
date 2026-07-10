import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { COPY } from "../lib/copy";
import { notifyError, notifySuccess } from "../lib/notify";
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
    enabled: Boolean(demo.data?.ready),
  });

  const seed = useMutation({
    mutationFn: () => api<{ corpusId: string; name: string }>("/api/seed-demo", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demo"] });
      qc.invalidateQueries({ queryKey: ["samples"] });
      notifySuccess(COPY.notify.demoLoaded);
    },
    onError: (e) =>
      notifyError("Could not load sample data", e instanceof Error ? e.message : undefined),
  });

  return {
    demo: demo.data,
    samples: samples.data ?? [],
    isLoading: demo.isLoading || seed.isPending,
    isError: demo.isError,
    error: demo.error,
    refetch: demo.refetch,
    seedDemo: seed.mutate,
    seeding: seed.isPending,
  };
}
