import {
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
  Anchor,
} from "@mantine/core";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import FlowSteps from "../components/FlowSteps";
import QueryState from "../components/QueryState";
import { api } from "../lib/api";
import { COPY, FLOW_STEPS, friendlyError } from "../lib/copy";
import { notifyError, notifySuccess } from "../lib/notify";
import { renderSignupUrlWithUtms, GITHUB_REPO_URL, DEPLOY_TO_RENDER_URL } from "../lib/render-links";

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
    <Stack gap="lg">
      <Card withBorder p="lg">
        <Stack gap="sm">
          <Title order={2}>{COPY.home.title}</Title>
          <Text c="dimmed">{COPY.home.subtitle}</Text>
          <Text size="sm" c="dimmed">
            {COPY.home.platformNote}
          </Text>
          <Group>
            <Button component="a" href={DEPLOY_TO_RENDER_URL} target="_blank" rel="noreferrer">
              Deploy to Render
            </Button>
            <Button
              component="a"
              href={renderSignupUrlWithUtms("hero_cta")}
              target="_blank"
              rel="noreferrer"
              variant="outline"
            >
              Sign up on Render
            </Button>
          </Group>
        </Stack>
      </Card>

      <FlowSteps active={0} steps={[...FLOW_STEPS]} />

      <Title order={3}>{COPY.home.datasetsHeading}</Title>
      <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {!corpora.length && <Alert title="No datasets yet">{COPY.home.emptyDatasets}</Alert>}
        <Stack>
          {corpora.map((c) => (
            <Card
              key={c.id}
              withBorder
              component={Link}
              to={`/corpus/${c.id}`}
              style={{ textDecoration: "none" }}
            >
              <Text fw={600}>{c.name}</Text>
              {c.description && (
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {c.description}
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      </QueryState>

      <Group align="flex-end">
        <TextInput
          label={COPY.home.createLabel}
          description={COPY.home.createDescription}
          placeholder={COPY.home.createPlaceholder}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          style={{ flex: 1 }}
          disabled={create.isPending}
        />
        <Button onClick={handleCreate} loading={create.isPending} disabled={!name.trim()}>
          {COPY.home.createButton}
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        <Anchor href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
          View source on GitHub
        </Anchor>
      </Text>
    </Stack>
  );
}
