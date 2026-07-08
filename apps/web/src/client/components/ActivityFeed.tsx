import { ScrollArea, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { formatActivityLine } from "../lib/format-event";

type EventRow = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

const TERMINAL = new Set(["complete", "failed", "canceled", "budget_exceeded"]);

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
        time: formatTime(e.at),
        text: formatActivityLine(e),
      })),
    [events]
  );

  return (
    <ScrollArea h={320} type="auto">
      <Stack gap={6}>
        {lines.map((l) => (
          <Text key={l.id} size="sm">
            <Text span size="xs" c="dimmed" mr={6}>
              {l.time}
            </Text>
            {l.text}
          </Text>
        ))}
        {lines.length === 0 && (
          <Text size="sm" c="dimmed">
            Waiting for updates…
          </Text>
        )}
      </Stack>
    </ScrollArea>
  );
}
