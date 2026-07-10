import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import QueryState from "../components/QueryState";
import { api } from "../lib/api";
import { COPY, FLOW_STEPS, friendlyError } from "../lib/copy";
import { notifyError, notifySuccess } from "../lib/notify";

type Corpus = { id: string; name: string; description: string | null };

export default function HomePage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState("");

  const { data: corpora = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["corpora"],
    queryFn: () => api<Corpus[]>("/api/corpora"),
  });

  const create = useMutation({
    mutationFn: (corpusName: string) =>
      api<Corpus>("/api/corpora", {
        method: "POST",
        body: JSON.stringify({ name: corpusName }),
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["corpora"] });
      notifySuccess(COPY.notify.datasetCreated, c.name);
      nav(`/corpus/${c.id}`);
    },
    onError: (e) => {
      notifyError(
        "Could not create dataset",
        e instanceof Error ? friendlyError(e.message) : undefined
      );
    },
  });

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed);
  }

  return (
    <Stack gap="xl" className="home-page">
      <Box className="home-hero">
        <Box className="home-hero-copy">
          <Text className="rag-kicker">Render × OpenRouter</Text>
          <Title order={1} className="home-title">
            {COPY.home.title}
          </Title>
          <Text className="home-subtitle">{COPY.home.subtitle}</Text>
          <Group gap="xs" mt="lg">
            <Badge variant="light" color="indigo">
              Render Workflows
            </Badge>
            <Badge variant="light" color="gray">
              OpenRouter models
            </Badge>
          </Group>
        </Box>
      </Box>

      <Box className="flow-strip" aria-label="Evaluation workflow">
        {FLOW_STEPS.map((step, index) => (
          <Box className="flow-step" key={step.label}>
            <Text className="flow-number">0{index + 1}</Text>
            <Text size="sm" fw={600} mt={4}>
              {step.label}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {step.description}
            </Text>
          </Box>
        ))}
      </Box>

      <Box className="home-section-heading">
        <Box>
          <Text className="rag-kicker">Workspace</Text>
          <Title order={2} mt={4}>
            {COPY.home.datasetsHeading}
          </Title>
        </Box>
        <Text size="sm" c="dimmed">
          Documents and test questions stay grouped for repeatable comparisons.
        </Text>
      </Box>

      <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Card withBorder p="lg" className="create-card">
            <Stack gap="md">
              <Box>
                <Text className="rag-kicker">New dataset</Text>
                <Text fw={600} mt={4}>
                  Start with your own documents
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  {COPY.home.createDescription}
                </Text>
              </Box>
              <TextInput
                label={COPY.home.createLabel}
                placeholder={COPY.home.createPlaceholder}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                disabled={create.isPending}
              />
              <Button
                fullWidth
                onClick={handleCreate}
                loading={create.isPending}
                disabled={!name.trim()}
              >
                {COPY.home.createButton}
              </Button>
            </Stack>
          </Card>

          {corpora.map((c) => (
            <Card
              key={c.id}
              withBorder
              p="lg"
              component={Link}
              to={`/corpus/${c.id}`}
              className="dataset-card"
            >
              <Stack h="100%" justify="space-between" gap="xl">
                <Box>
                  <Text className="rag-kicker">Dataset</Text>
                  <Text fw={600} size="lg" mt={5}>
                    {c.name}
                  </Text>
                  <Text size="sm" c="dimmed" lineClamp={2} mt={5}>
                    {c.description || "Open this dataset to review documents and compare models."}
                  </Text>
                </Box>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Open workspace
                  </Text>
                  <span className="dataset-arrow" aria-hidden="true">
                    →
                  </span>
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
        {!corpora.length && (
          <Text size="sm" c="dimmed" mt="sm">
            {COPY.home.emptyDatasets}
          </Text>
        )}
      </QueryState>
    </Stack>
  );
}
