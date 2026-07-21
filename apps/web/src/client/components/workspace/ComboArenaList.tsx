import { Badge, Box, Group, Stack, Text } from "@mantine/core";
import type { ComboResult } from "@ragtime/core";
import { COPY, TEST_STATUS_LABEL } from "../../lib/copy";
import { comboDurationMs, comboModels } from "../../lib/combo-display";
import { scorePercent, scoreTone } from "../../lib/score-display";
import type { GridCell } from "../../hooks/types";
import ProviderMark from "./ProviderMark";

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

function ModelPill({
  role,
  name,
  modelId,
  muted,
}: {
  role: string;
  name: string;
  modelId?: string;
  muted?: boolean;
}) {
  return (
    <span className={`arena-model-pill${muted ? " arena-model-pill--muted" : ""}`}>
      {modelId && <ProviderMark modelId={modelId} />}
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
        <Stack gap={0}>
          <Text className="pg-section-title">{COPY.app.setups}</Text>
          <Text size="xs" c="dimmed">
            {COPY.app.arenaHint}
          </Text>
        </Stack>
        <Text size="xs" c="dimmed">
          {COPY.app.setupCount(combos.length)}
        </Text>
      </Group>

      <Stack gap={8}>
        {combos.map((combo) => {
          const cell = lookup.get(combo.comboId);
          const status = cell?.status ?? "pending";
          const statusLabel = TEST_STATUS_LABEL[status] ?? "Pending";
          const selected = cell?.trialId === selectedTrialId;
          const models = comboModels(combo);
          const ms = comboDurationMs(combo, status);
          const width =
            status === "pending" ? 0 : Math.max(8, Math.round((ms / maxMs) * 100));
          const score = scorePercent(cell?.overallScore);
          const tone = scoreTone(score);
          const scoreLabel = score == null ? "not scored" : `${score} out of 100`;

          return (
            <button
              key={combo.comboId}
              type="button"
              className={`arena-combo-row${selected ? " arena-combo-row--selected" : ""}`}
              disabled={!cell}
              onClick={() => cell && onSelect(cell.trialId)}
              aria-label={`${models.search}, ${models.rerank ?? "no rerank"}, ${models.answer}. ${statusLabel}. ${COPY.app.judgeScore} ${scoreLabel}.`}
            >
              <div className="arena-combo-layout">
                <Group gap={8} wrap="nowrap" align="flex-start" className="arena-combo-models">
                  <span
                    className={`arena-status-dot arena-status-dot--${status}`}
                    aria-hidden="true"
                  />
                  <Stack gap={8} align="flex-start" className="arena-combo-model-stack">
                    <Group gap={6} wrap="wrap">
                      <ModelPill role="Search" name={models.search} modelId={combo.embeddingModel} />
                      <ModelPill
                        role="Rerank"
                        name={models.rerank ?? "skip"}
                        modelId={combo.rerankModel ?? undefined}
                        muted={!models.rerank}
                      />
                      <ModelPill role="Answer" name={models.answer} modelId={combo.genModel} />
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
                    {statusLabel}
                  </Badge>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {status === "pending" ? "—" : `${(ms / 1000).toFixed(1)}s`}
                  </Text>
                </Stack>

                <div className={`arena-score-card score-tone--${tone}`}>
                  <span className="arena-score-label">{COPY.app.judgeScore}</span>
                  <span className="arena-score-number">{score ?? "—"}</span>
                  <span className="arena-score-scale">/100</span>
                </div>
              </div>
            </button>
          );
        })}
      </Stack>

      <Group gap="md" className="arena-legend">
        {[
          ["pending", COPY.grid.legendPending],
          ["running", COPY.grid.legendRunning],
          ["complete", COPY.grid.legendHigh],
          ["failed", COPY.grid.legendFailed],
        ].map(([status, label]) => (
          <Group gap={6} key={label}>
            <Box className={`arena-status-dot arena-status-dot--${status}`} aria-hidden="true" />
            <Text size="xs" c="dimmed">
              {label}
            </Text>
          </Group>
        ))}
      </Group>
    </Stack>
  );
}
