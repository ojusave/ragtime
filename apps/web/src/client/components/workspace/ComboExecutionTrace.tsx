import { Stack, Text } from "@mantine/core";
import type { ComboResult } from "@ragtime/core";
import type { GridCell } from "../../hooks/types";

function durationMs(combo: ComboResult, grid: GridCell[]): number {
  const cell = grid.find((g) => g.comboId === combo.comboId);
  if (!cell) return 0;
  if (cell.status === "pending") return 0;
  if (cell.status === "running") return combo.p50GenerationLatencyMs ?? 4000;
  return combo.p50GenerationLatencyMs ?? 8000;
}

export default function ComboExecutionTrace({
  combos,
  grid,
}: {
  combos: ComboResult[];
  grid: GridCell[];
}) {
  const max = Math.max(...combos.map((c) => durationMs(c, grid)), 1);

  return (
    <Stack gap="xs" className="execution-trace">
      <Text className="rag-kicker">Timing</Text>
      {!combos.length ? (
        <Text size="sm" c="dimmed">
          Bars appear after the run starts.
        </Text>
      ) : (
        combos.map((combo) => {
          const cell = grid.find((g) => g.comboId === combo.comboId);
          const status = cell?.status ?? "pending";
          const ms = durationMs(combo, grid);
          const width = status === "pending" ? 2 : Math.max(4, (ms / max) * 100);
          return (
            <div className="trace-row" key={combo.comboId}>
              <Text size="xs" className="trace-label" lineClamp={1}>
                {combo.label ?? combo.genModel}
              </Text>
              <div className="trace-track">
                <div className={`trace-bar trace-bar--${status}`} style={{ width: `${width}%` }}>
                  {status !== "pending" && <span>{(ms / 1000).toFixed(1)}s</span>}
                </div>
              </div>
            </div>
          );
        })
      )}
    </Stack>
  );
}
