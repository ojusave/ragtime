import { Badge, ScrollArea, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../lib/api";

type EventRow = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

const TERMINAL = new Set(["complete", "failed", "canceled", "budget_exceeded"]);

export default function ActivityFeed({
  runId,
  runStatus,
}: {
  runId: string;
  runStatus: string;
}) {
  const [cursor, setCursor] = useState(0);
  const [events, setEvents] = useState<EventRow[]>([]);

  useQuery({
    queryKey: ["run-events", runId, cursor],
    queryFn: async () => {
      const rows = await api<EventRow[]>(`/api/runs/${runId}/events?after=${cursor}`);
      if (rows.length > 0) {
        setEvents((prev) => [...prev, ...rows].slice(-500));
        setCursor(rows[rows.length - 1]!.id);
      }
      return rows;
    },
    refetchInterval: TERMINAL.has(runStatus) ? false : 2000,
  });

  const lines = useMemo(
    () =>
      [...events].reverse().map((e) => ({
        id: e.id,
        type: e.type,
        text: formatEvent(e),
      })),
    [events]
  );

  return (
    <ScrollArea h={320} type="auto">
      <Stack gap={6}>
        {lines.map((l) => (
          <Text key={l.id} size="sm">
            <Badge size="xs" variant="light" mr={6}>
              {l.type}
            </Badge>
            {l.text}
          </Text>
        ))}
        {lines.length === 0 && (
          <Text size="sm" c="dimmed">
            Waiting for activity...
          </Text>
        )}
      </Stack>
    </ScrollArea>
  );
}

function formatEvent(e: EventRow): string {
  const p = e.payload;
  if (e.type === "embed.batch") {
    const r = p.receipt as { costUsd?: number; provider?: string } | undefined;
    const cost = r?.costUnknown ? "n/a" : `$${Number(r?.costUsd ?? 0).toFixed(4)}`;
    return `Embedded ${p.embedded} chunks (${p.model}) ${cost}`;
  }
  if (e.type === "trial.stage") {
    return `Trial ${String(p.trialId).slice(0, 8)} finished ${p.stage}`;
  }
  if (e.type === "trial.retry") {
    return `Trial ${String(p.trialId).slice(0, 8)} attempt ${p.attempt} retrying`;
  }
  if (e.type === "chaos.injected") return "Chaos injection triggered retry";
  if (e.type === "budget.tripped") return "Budget exceeded";
  if (e.type === "run.status") return `Run status: ${p.status}`;
  if (e.type === "doc.ingested") return `Document ingested (${p.chunkCount} chunks)`;
  return JSON.stringify(p);
}
