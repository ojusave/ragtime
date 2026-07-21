import { Badge, Group, Loader, Stack, Text } from "@mantine/core";
import type { ComboResult } from "@ragtime/core";
import { COPY, TEST_STATUS_LABEL } from "../../lib/copy";
import { comboModels } from "../../lib/combo-display";
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

/** Renders the generated answer for each setup, with scores kept to a small footer. */
export default function AnswerCards({ combos, grid, selectedTrialId, onSelect }: Props) {
  const lookup = new Map(grid.map((g) => [g.comboId, g]));

  return (
    <Stack gap="sm" className="answer-cards pg-arena-card">
      <Stack gap={0}>
        <Text className="pg-section-title">{COPY.app.answersTitle}</Text>
        <Text size="xs" c="dimmed">
          {COPY.app.answersHint}
        </Text>
      </Stack>

      <div className="answer-cards-grid">
        {combos.map((combo) => {
          const cell = lookup.get(combo.comboId);
          const status = cell?.status ?? "pending";
          const statusLabel = TEST_STATUS_LABEL[status] ?? "Pending";
          const selected = cell?.trialId === selectedTrialId;
          const models = comboModels(combo);
          const score = scorePercent(cell?.overallScore);
          const tone = scoreTone(score);
          const answer = cell?.answer?.trim();

          return (
            <button
              key={combo.comboId}
              type="button"
              className={`answer-card${selected ? " answer-card--selected" : ""}`}
              disabled={!cell}
              onClick={() => cell && onSelect(cell.trialId)}
            >
              <Group gap={6} wrap="wrap" className="answer-card-models">
                <ModelPill role="Search" name={models.search} modelId={combo.embeddingModel} />
                <ModelPill
                  role="Rerank"
                  name={models.rerank ?? "skip"}
                  modelId={combo.rerankModel ?? undefined}
                  muted={!models.rerank}
                />
                <ModelPill role="Answer" name={models.answer} modelId={combo.genModel} />
              </Group>

              <div className="answer-card-body">
                {status === "running" && !answer ? (
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="sm" c="dimmed">
                      {COPY.app.answerRunning}
                    </Text>
                  </Group>
                ) : status === "pending" ? (
                  <Text size="sm" c="dimmed">
                    {COPY.app.answerPending}
                  </Text>
                ) : status === "failed" && !answer ? (
                  <Text size="sm" c="red">
                    {COPY.app.answerFailed}
                  </Text>
                ) : answer ? (
                  <Text size="sm" className="answer-card-text">
                    {answer}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    {COPY.app.answerEmpty}
                  </Text>
                )}
              </div>

              <Group justify="space-between" align="center" className="answer-card-footer">
                <Badge color={statusColor(status)} variant="light" size="sm">
                  {statusLabel}
                </Badge>
                <span className={`answer-card-score score-tone--${tone}`}>
                  <span className="answer-card-score-label">{COPY.app.judgeScore}</span>
                  <span className="answer-card-score-number">{score ?? "—"}</span>
                  <span className="answer-card-score-scale">/100</span>
                </span>
              </Group>
            </button>
          );
        })}
      </div>
    </Stack>
  );
}
