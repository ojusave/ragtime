import { Badge, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import type { TrialStages } from "@ragtime/core";
import { COPY } from "../lib/copy";
import { formatReceipt } from "../lib/receipt";
import { scorePercent, scoreTone } from "../lib/score-display";

type ChunkRow = { id: string; content: string; idx?: number };

type Props = {
  stages: TrialStages;
  answer?: string | null;
  chunks?: Map<string, ChunkRow>;
  highlightChunkId?: string | null;
  onChunkHover?: (id: string | null) => void;
};

function receiptLine(
  r?: { latencyMs: number; costUsd: number; costUnknown?: boolean; provider?: string }
) {
  if (!r) return null;
  return (
    <Text size="xs" c="dimmed">
      {COPY.stages.costLatency}: {formatReceipt(r)}
    </Text>
  );
}

export default function TrialStagesPanel({
  stages,
  answer,
  chunks,
  highlightChunkId,
  onChunkHover,
}: Props) {
  const retrieval = stages.retrieval;
  const rerank = stages.rerank;
  const generation = stages.generation;
  const judge = stages.judge;

  const renderChunk = (id: string, score?: number, rank?: number) => {
    const chunk = chunks?.get(id);
    const label =
      chunk?.idx != null ? COPY.stages.passageLabel(chunk.idx) : id.slice(0, 8);
    const highlighted = highlightChunkId === id;
    return (
      <Box
        key={id}
        p="xs"
        mb={4}
        style={{
          borderRadius: 4,
          background: highlighted ? "var(--mantine-color-blue-0)" : "var(--mantine-color-gray-0)",
          border: highlighted ? "1px solid var(--mantine-color-blue-4)" : "1px solid transparent",
        }}
        onMouseEnter={() => onChunkHover?.(id)}
        onMouseLeave={() => onChunkHover?.(null)}
      >
        <GroupedMeta rank={rank} score={score} label={label} />
        <Text size="xs" lineClamp={3}>
          {chunk?.content ?? id}
        </Text>
      </Box>
    );
  };

  return (
    <Stack gap="md">
      {retrieval && (
        <section>
          <Text fw={600} size="sm">
            {COPY.stages.findPassages(retrieval.chunkIds.length)}
          </Text>
          {receiptLine(retrieval)}
          {retrieval.chunkIds.map((id, i) => renderChunk(id, retrieval.scores[i], i + 1))}
        </section>
      )}

      {rerank && (
        <section>
          <Text fw={600} size="sm">
            {COPY.stages.rerank}
          </Text>
          {receiptLine(rerank)}
          <Text size="xs" c="dimmed" mb="xs">
            {COPY.stages.kept(rerank.keptChunkIds.length)}
          </Text>
          {rerank.keptChunkIds.map((id, i) => {
            const origIdx = retrieval?.chunkIds.indexOf(id) ?? -1;
            const delta = origIdx >= 0 ? origIdx - i : null;
            return (
              <Box key={id} mb={4}>
                {delta != null && delta !== 0 && (
                  <Badge size="xs" variant="light" mr="xs">
                    {delta > 0 ? `+${delta}` : delta}
                  </Badge>
                )}
                {renderChunk(id, rerank.scores[rerank.order.indexOf(origIdx)] ?? undefined, i + 1)}
              </Box>
            );
          })}
        </section>
      )}

      {generation && (
        <section>
          <Text fw={600} size="sm">
            {COPY.stages.writeAnswer}
          </Text>
          {receiptLine(generation)}
          {answer && (
            <Text size="sm" mt="xs">
              {answer.split(/(\[chunk:\d+\])/g).map((part, i) =>
                /^\[chunk:(\d+)\]$/.test(part) ? (
                  <Badge key={i} size="sm" variant="light" mr={4}>
                    {COPY.stages.passageLabel(Number(part.match(/\d+/)?.[0] ?? 0))}
                  </Badge>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </Text>
          )}
        </section>
      )}

      {judge && (
        <section className="judge-section">
          <Group gap="xs" align="center">
            <Text fw={600} size="sm">
              {COPY.stages.rateAnswer(judge.judgeModel.split("/").pop() ?? judge.judgeModel)}
            </Text>
            {judge.correctness == null && (
              <Tooltip label={COPY.app.judgeOnlyTooltip} multiline w={240} withArrow>
                <Badge color="grape" variant="light" size="sm" style={{ cursor: "help" }}>
                  {COPY.app.judgeOnlyBadge}
                </Badge>
              </Tooltip>
            )}
          </Group>
          {receiptLine(judge)}
          <div className="judge-score-grid" role="list" aria-label="Judge dimension scores">
            {[
              [COPY.app.faithfulnessDimension, judge.faithfulness],
              ...(judge.correctness == null
                ? []
                : [[COPY.app.correctnessDimension, judge.correctness] as const]),
              [COPY.app.completenessDimension, judge.completeness],
            ].map(([label, value]) => {
              const score = scorePercent(value as number);
              return (
                <div
                  key={label}
                  className={`judge-score score-tone--${scoreTone(score)}`}
                  role="listitem"
                  aria-label={`${label}: ${score ?? 0} out of 100`}
                >
                  <span className="judge-score__value">{score ?? "—"}</span>
                  <span className="judge-score__scale">/100</span>
                  <span className="judge-score__label">{label}</span>
                </div>
              );
            })}
          </div>
          <Text size="xs" c="dimmed" className="judge-rationale">
            {judge.rationale}
          </Text>
        </section>
      )}
    </Stack>
  );
}

function GroupedMeta({
  rank,
  score,
  label,
}: {
  rank?: number;
  score?: number;
  label: string;
}) {
  return (
    <Text size="xs" fw={600} mb={2}>
      #{rank ?? "?"} {label}
      {score != null ? ` · ${score.toFixed(3)}` : ""}
    </Text>
  );
}
