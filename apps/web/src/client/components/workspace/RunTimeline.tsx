import { Collapse, Loader, Stack, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { COPY } from "../../lib/copy";
import { formatActivityLine } from "../../lib/format-event";

type EventRow = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

const TERMINAL = new Set(["complete", "failed", "canceled", "budget_exceeded"]);

function eventTone(type: string): string {
  if (type.includes("failed") || type === "budget.tripped") return "failed";
  if (type.includes("complete") || type === "trial.stage") return "done";
  if (type.includes("running") || type === "doc.ingested" || type === "embed.batch") return "active";
  return "idle";
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

function dedupeFeed(
  events: Array<{ id: number; time: string; text: string; tone: string }>
) {
  const out: typeof events = [];
  for (const line of events) {
    const prev = out[out.length - 1];
    if (prev && prev.text === line.text && prev.time === line.time) continue;
    out.push(line);
  }
  return out;
}

export default function RunTimeline({
  runId,
  runStatus,
}: {
  runId: string | null;
  runStatus: string;
}) {
  const [open, { toggle }] = useDisclosure(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const cursorRef = useRef(0);

  useEffect(() => {
    setEvents([]);
    cursorRef.current = 0;
  }, [runId]);

  useQuery({
    queryKey: ["run-events", runId],
    queryFn: async () => {
      if (!runId) return [];
      const rows = await api<EventRow[]>(`/api/runs/${runId}/events?after=${cursorRef.current}`);
      if (rows.length > 0) {
        cursorRef.current = rows[rows.length - 1]!.id;
        setEvents((prev) => [...prev, ...rows].slice(-500));
      }
      return rows;
    },
    enabled: Boolean(runId),
    refetchInterval: TERMINAL.has(runStatus) ? false : 2000,
  });

  const lines = useMemo(() => {
    const mapped = [...events]
      .reverse()
      .map((e) => ({
        id: e.id,
        time: formatTime(e.at),
        text: formatActivityLine(e),
        tone: eventTone(e.type),
      }));
    return dedupeFeed(mapped).slice(0, 12);
  }, [events]);

  return (
    <Stack gap="sm" className="run-timeline pg-arena-card pg-arena-card--subtle">
      <UnstyledButton className="arena-feed-toggle" onClick={toggle}>
        <Text className="pg-section-title">{COPY.app.eventLog}</Text>
        <Text size="xs" c="dimmed">
          {open ? "Hide" : "Show"} ({lines.length})
        </Text>
      </UnstyledButton>

      <Collapse in={open}>
        {!runId ? (
          <Text size="sm" c="dimmed">
            No run yet.
          </Text>
        ) : lines.length === 0 ? (
          <Text size="sm" c="dimmed">
            Waiting for updates…
          </Text>
        ) : (
          <Stack gap={6} className="arena-feed">
            {lines.map((line) => (
              <div key={line.id} className={`arena-feed-row arena-feed-row--${line.tone}`}>
                <span className="arena-feed-dot" aria-hidden="true" />
                <Stack gap={2} className="arena-feed-copy">
                  <Text size="sm" fw={500} lh={1.35}>
                    {line.text}
                  </Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {line.time}
                  </Text>
                </Stack>
              </div>
            ))}
          </Stack>
        )}
      </Collapse>
    </Stack>
  );
}
