import { Badge, Button, Group, Table, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { COPY, runStatusLabel } from "../lib/copy";
import EmptyState from "./EmptyState";

type RunRow = {
  id: string;
  name: string;
  status: string;
  totalCostUsd: string;
  budgetUsd: string;
  createdAt: string;
  finishedAt: string | null;
};

type Props = {
  corpusId: string;
  /** When true, omit outer card chrome (parent provides container). */
  embedded?: boolean;
};

/** Recent comparisons for a dataset. */
export default function RunHistoryList({ corpusId, embedded }: Props) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["corpus-runs", corpusId],
    queryFn: () => api<RunRow[]>(`/api/corpora/${corpusId}/runs`),
  });

  if (isLoading) return <Text size="sm" c="dimmed" pt="sm">{COPY.common.loading}</Text>;
  if (runs.length === 0) {
    return (
      <EmptyState title={COPY.history.empty} hint={COPY.history.emptyHint} />
    );
  }

  const table = (
    <Table striped highlightOnHover mt={embedded ? "sm" : undefined}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>{COPY.history.spend}</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {runs.map((r) => {
          const done = r.status === "complete" || r.status === "budget_exceeded";
          return (
            <Table.Tr key={r.id}>
              <Table.Td>{r.name}</Table.Td>
              <Table.Td>
                <Badge size="sm">{runStatusLabel(r.status)}</Badge>
              </Table.Td>
              <Table.Td>
                ${Number(r.totalCostUsd).toFixed(2)} / ${Number(r.budgetUsd).toFixed(2)}
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <Button
                    component={Link}
                    to={done ? `/run/${r.id}/results` : `/run/${r.id}`}
                    variant="light"
                    size="compact-xs"
                  >
                    {done ? COPY.history.results : COPY.history.open}
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );

  if (embedded) return table;

  return (
    <>
      <Text fw={600} mb="sm">
        {COPY.corpus.recentRuns}
      </Text>
      {table}
    </>
  );
}
