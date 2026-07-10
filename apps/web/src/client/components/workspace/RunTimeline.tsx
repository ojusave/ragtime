import { ScrollArea, Stack, Text, Timeline } from "@mantine/core";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formatActivityLine } from "../../lib/format-event";

type EventRow = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

const TERMINAL = new Set(["complete", "failed", "canceled", "budget_exceeded"]);

function eventColor(type: string): string {
  if (type.includes("failed") || type === "budget.tripped") return "red";
  if (type.includes("complete") || type === "trial.stage") return "green";
  if (type.includes("running") || type === "doc.ingested") return "indigo";
  return "gray";
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function RunTimeline({
  runId,
  runStatus,
}: {
  runId: string | null;
  runStatus: string;
}) {
  const [cursor, setCursor] = useState(0);
  const [events, setEvents] = useState<EventRow[]>([]);

  useQuery({
    queryKey: ["run-events", runId, cursor],
    queryFn: async () => {
      if (!runId) return [];
      const rows = await api<EventRow[]>(`/api/runs/${runId}/events?after=${cursor}`);
      if (rows.length > 0) {
        setEvents((prev) => [...prev, ...rows].slice(-500));
        setCursor(rows[rows.length - 1]!.id);
      }
      return rows;
    },
    enabled: Boolean(runId),
    refetchInterval: TERMINAL.has(runStatus) ? false : 2000,
  });

  const lines = useMemo(
    () =>
      [...events].reverse().map((e) => ({
        id: e.id,
        time: formatTime(e.at),
        text: formatActivityLine(e),
        color: eventColor(e.type),
      })),
    [events]
  );

  return (
    <Stack gap="sm" className="run-timeline">
      <Text className="rag-kicker">Event log</Text>
      <ScrollArea.Autosize mah={280} type="auto">
        {!runId ? (
          <Text size="sm" c="dimmed">
            No run yet.
          </Text>
        ) : lines.length === 0 ? (
          <Text size="sm" c="dimmed">
            Waiting for updates…
          </Text>
        ) : (
          <Timeline active={lines.length} bulletSize={16} lineWidth={2}>
            {lines.map((line) => (
              <Timeline.Item key={line.id} title={line.text} color={line.color}>
                <Text size="xs" c="dimmed">
                  {line.time}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </ScrollArea.Autosize>
    </Stack>
  );
}
