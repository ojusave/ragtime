import { Box, Text, Tooltip } from "@mantine/core";
import { Fragment, memo, useMemo } from "react";
import { TRIAL_STATUS_LABEL } from "../lib/copy";

type Cell = {
  trialId: string;
  comboId: string;
  questionId: string;
  status: string;
  overallScore: string | null;
  attempts: number;
};

type Props = {
  combos: { comboId: string; label: string }[];
  questions: { id: string; text: string }[];
  grid: Cell[];
  onCellClick?: (trialId: string) => void;
};

function cellColor(cell: Cell | undefined) {
  if (!cell || cell.status === "pending") return "var(--mantine-color-gray-2)";
  if (cell.status === "running") return "var(--mantine-color-blue-2)";
  if (cell.status === "failed") return "var(--mantine-color-red-3)";
  if (cell.status === "skipped") return "var(--mantine-color-gray-4)";
  const score = cell.overallScore ? Number(cell.overallScore) : 0;
  const intensity = Math.min(10, Math.max(0, score)) / 10;
  return `rgba(34, 139, 230, ${0.15 + intensity * 0.75})`;
}

const GridCell = memo(function GridCell({
  cell,
  onCellClick,
}: {
  cell: Cell | undefined;
  onCellClick?: (trialId: string) => void;
}) {
  return (
    <Box
      onClick={() => cell && onCellClick?.(cell.trialId)}
      style={{
        height: 36,
        background: cellColor(cell),
        borderRadius: 4,
        cursor: cell ? "pointer" : "default",
        animation: cell?.status === "running" ? "pulse 1.5s ease-in-out infinite" : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
      }}
      title={
        cell
          ? `${TRIAL_STATUS_LABEL[cell.status] ?? cell.status}${cell.overallScore ? ` (${Number(cell.overallScore).toFixed(1)})` : ""}${cell.attempts > 1 ? ` · ${cell.attempts} attempts` : ""}`
          : ""
      }
    >
      {cell?.status === "failed" && cell.attempts > 0 ? cell.attempts : ""}
      {cell?.status === "complete" && cell.overallScore
        ? Number(cell.overallScore).toFixed(0)
        : ""}
    </Box>
  );
});

export default function TrialGrid({ combos, questions, grid, onCellClick }: Props) {
  const lookup = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const c of grid) {
      m.set(`${c.comboId}:${c.questionId}`, c);
    }
    return m;
  }, [grid]);

  return (
    <Box
      style={{
        display: "grid",
        gridTemplateColumns: `180px repeat(${questions.length}, minmax(48px, 1fr))`,
        gap: 4,
        overflowX: "auto",
      }}
    >
      <Box />
      {questions.map((q) => (
        <Tooltip key={q.id} label={q.text}>
          <Text size="xs" ta="center" lineClamp={2} fw={500}>
            {q.text.slice(0, 24)}...
          </Text>
        </Tooltip>
      ))}

      {combos.map((combo) => (
        <Fragment key={combo.comboId}>
          <Text size="xs" fw={600} style={{ alignSelf: "center" }}>
            {combo.label}
          </Text>
          {questions.map((q) => (
            <GridCell
              key={`${combo.comboId}-${q.id}`}
              cell={lookup.get(`${combo.comboId}:${q.id}`)}
              onCellClick={onCellClick}
            />
          ))}
        </Fragment>
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </Box>
  );
}
