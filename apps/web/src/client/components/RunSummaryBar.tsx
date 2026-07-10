import { Box, Progress, SimpleGrid, Text } from "@mantine/core";
import { COPY } from "../lib/copy";

type Props = {
  spent: string;
  budget: string;
  complete: number;
  total: number;
  docsReady?: number;
  docsTotal?: number;
};

/** Compact spend + test progress for run/results pages. */
export default function RunSummaryBar({
  spent,
  budget,
  complete,
  total,
  docsReady,
  docsTotal,
}: Props) {
  const pct = total ? (complete / total) * 100 : 0;
  return (
    <SimpleGrid
      cols={{ base: 1, sm: docsTotal != null && docsTotal > 0 ? 3 : 2 }}
      spacing={0}
      className="run-summary"
    >
      <Box className="run-summary-cell">
        <Text className="rag-kicker">Spend</Text>
        <Text size="sm" fw={600} mt={5}>
          ${spent} of ${budget}
        </Text>
      </Box>
      <Box className="run-summary-cell">
        <Text className="rag-kicker">Test progress</Text>
        <Text size="sm" fw={600} mt={5}>
          {total > 0 ? COPY.run.progress(complete, total) : "Waiting to start"}
        </Text>
        {total > 0 && <Progress value={pct} size={5} mt={8} aria-label="Test progress" />}
      </Box>
      {docsTotal != null && docsTotal > 0 && (
        <Box className="run-summary-cell">
          <Text className="rag-kicker">Documents</Text>
          <Text size="sm" fw={600} mt={5}>
            {COPY.run.docsIndexed(docsReady ?? 0, docsTotal)}
          </Text>
        </Box>
      )}
    </SimpleGrid>
  );
}
