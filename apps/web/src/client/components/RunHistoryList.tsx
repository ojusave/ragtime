import { Badge, Button, Card, Group, Stack, Table, Text } from "@mantine/core";
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

/** Recent comparisons for a dataset. */
export default function RunHistoryList({ corpusId }: { corpusId: string }) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["corpus-runs", corpusId],
    queryFn: () => api<RunRow[]>(`/api/corpora/${corpusId}/runs`),
  });

  if (isLoading) return <Text size="sm" c="dimmed">{COPY.common.loading}</Text>;
  if (runs.length === 0) {
    return <EmptyState title={COPY.history.empty} hint={COPY.history.emptyHint} />;
  }

  return (
    <Card withBorder>
      <Text fw={600} mb="sm">
        {COPY.corpus.recentRuns}
      </Text>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>{COPY.history.spend}</Table.Th>
            <Table.Th>{COPY.history.started}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {runs.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>{r.name}</Table.Td>
              <Table.Td>
                <Badge size="sm">{runStatusLabel(r.status)}</Badge>
              </Table.Td>
              <Table.Td>
                ${Number(r.totalCostUsd).toFixed(2)} / ${Number(r.budgetUsd).toFixed(2)}
              </Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed">
                  {new Date(r.createdAt).toLocaleString()}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <Button
                    component={Link}
                    to={`/run/${r.id}`}
                    variant="subtle"
                    size="compact-xs"
                  >
                    {COPY.history.open}
                  </Button>
                  {(r.status === "complete" || r.status === "budget_exceeded") && (
                    <Button
                      component={Link}
                      to={`/run/${r.id}/results`}
                      variant="light"
                      size="compact-xs"
                    >
                      {COPY.history.results}
                    </Button>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
