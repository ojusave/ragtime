import { Badge, Box, Group, ScrollArea, Stack, Text } from "@mantine/core";
import type { ComboResult } from "@ragtime/core";
import { COPY, TEST_STATUS_LABEL } from "../../lib/copy";
import { comboDurationMs, comboModels } from "../../lib/combo-display";
import type { GridCell } from "../../hooks/types";

type Props = {
  combos: ComboResult[];
  grid: GridCell[];
  selectedTrialId: string | null;
  onSelect: (trialId: string) => void;
};

function statusColor(status: string): string {
  if (status === "complete") return "green";
  if (status === "failed") return "red";
  if (status === "running") return "indigo";
  return "gray";
}

function ModelPill({ role, name, muted }: { role: string; name: string; muted?: boolean }) {
  return (
    <span className={`arena-model-pill${muted ? " arena-model-pill--muted" : ""}`}>
      <span className="arena-model-pill__role">{role}</span>
      <span className="arena-model-pill__name">{name}</span>
    </span>
  );
}

export default function ComboArenaList({ combos, grid, selectedTrialId, onSelect }: Props) {
  const lookup = new Map(grid.map((g) => [g.comboId, g]));
  const maxMs = Math.max(
    ...combos.map((combo) => {
      const status = lookup.get(combo.comboId)?.status ?? "pending";
      return comboDurationMs(combo, status);
    }),
    1
  );

  return (
    <Stack gap="sm" className="combo-arena-list pg-arena-card">
      <Group justify="space-between" align="center">
        <Text className="pg-section-title">{COPY.playground.combos}</Text>
        <Text size="xs" c="dimmed">
          {combos.length} total
        </Text>
      </Group>

      <ScrollArea.Autosize mah={420} type="auto" offsetScrollbars>
        <Stack gap={8}>
          {combos.map((combo) => {
            const cell = lookup.get(combo.comboId);
            const status = cell?.status ?? "pending";
            const selected = cell?.trialId === selectedTrialId;
            const models = comboModels(combo);
            const ms = comboDurationMs(combo, status);
            const width =
              status === "pending" ? 0 : Math.max(8, Math.round((ms / maxMs) * 100));
            const score = cell?.overallScore ? Number(cell.overallScore).toFixed(1) : null;

            return (
              <button
                key={combo.comboId}
                type="button"
                className={`arena-combo-row${selected ? " arena-combo-row--selected" : ""}`}
                disabled={!cell}
                onClick={() => cell && onSelect(cell.trialId)}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                  <Group gap={8} wrap="nowrap">
                    <span className={`arena-status-dot arena-status-dot--${status}`} />
                    <Stack gap={6} align="flex-start">
                      <Group gap={6} wrap="wrap">
                        <ModelPill role="Search" name={models.search} />
                        <ModelPill
                          role="Rerank"
                          name={models.rerank ?? "skip"}
                          muted={!models.rerank}
                        />
                        <ModelPill role="Answer" name={models.answer} />
                      </Group>
                      <div className="arena-combo-track" aria-hidden="true">
                        <div
                          className={`arena-combo-bar arena-combo-bar--${status}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </Stack>
                  </Group>

                  <Stack gap={4} align="flex-end" className="arena-combo-meta">
                    <Badge color={statusColor(status)} variant="light" size="sm">
                      {TEST_STATUS_LABEL[status] ?? "Waiting"}
                    </Badge>
                    <Text size="xs" c="dimmed" ff="monospace">
                      {status === "pending" ? "—" : `${(ms / 1000).toFixed(1)}s`}
                    </Text>
                    <Text size="sm" fw={700} className="arena-combo-score">
                      {score ?? "—"}
                    </Text>
                  </Stack>
                </Group>
              </button>
            );
          })}
        </Stack>
        </ScrollArea.Autosize>

      <Group gap="md" className="arena-legend">
        {[
          ["pending", COPY.grid.legendPending],
          ["running", COPY.grid.legendRunning],
          ["complete", COPY.grid.legendHigh],
          ["failed", COPY.grid.legendFailed],
        ].map(([status, label]) => (
          <Group gap={6} key={label}>
            <Box className={`arena-status-dot arena-status-dot--${status}`} />
            <Text size="xs" c="dimmed">
              {label}
            </Text>
          </Group>
        ))}
      </Group>
    </Stack>
  );
}
