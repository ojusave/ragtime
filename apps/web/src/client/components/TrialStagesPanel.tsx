import { Badge, Box, Stack, Text } from "@mantine/core";
import type { TrialStages } from "@ragtime/core";
import { formatReceipt } from "../lib/receipt";

type ChunkRow = { id: string; content: string; idx?: number };

type Props = {
  stages: TrialStages;
  answer?: string | null;
  chunks?: Map<string, ChunkRow>;
  highlightChunkId?: string | null;
  onChunkHover?: (id: string | null) => void;
};

function receiptLine(
  label: string,
  r?: { latencyMs: number; costUsd: number; costUnknown?: boolean; provider?: string }
) {
  if (!r) return null;
  return (
    <Text size="xs" c="dimmed">
      {label}: {formatReceipt(r)}
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
    const label = chunk?.idx != null ? `chunk:${chunk.idx}` : id.slice(0, 8);
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
            Retrieve ({retrieval.chunkIds.length} candidates)
          </Text>
          {receiptLine("Receipt", retrieval)}
          {retrieval.chunkIds.map((id, i) => renderChunk(id, retrieval.scores[i], i + 1))}
        </section>
      )}

      {rerank && (
        <section>
          <Text fw={600} size="sm">
            Rerank
          </Text>
          {receiptLine("Receipt", rerank)}
          <Text size="xs" c="dimmed" mb="xs">
            Kept {rerank.keptChunkIds.length} chunks
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
            Generate
          </Text>
          {receiptLine("Receipt", generation)}
          {answer && (
            <Text size="sm" mt="xs">
              {answer.split(/(\[chunk:\d+\])/g).map((part, i) =>
                /^\[chunk:\d+\]$/.test(part) ? (
                  <Badge key={i} size="sm" variant="light" mr={4}>
                    {part}
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
        <section>
          <Text fw={600} size="sm">
            Judge ({judge.judgeModel})
          </Text>
          {receiptLine("Receipt", judge)}
          <Text size="sm">
            Faithfulness {judge.faithfulness} · Correctness {judge.correctness} · Completeness{" "}
            {judge.completeness}
          </Text>
          <Text size="xs" c="dimmed">
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
