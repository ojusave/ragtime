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
import { type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { renderSignupUrlWithUtms, GITHUB_REPO_URL, DEPLOY_TO_RENDER_URL } from "../lib/render-links";

type Corpus = { id: string; name: string; description: string | null };

export default function HomePage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: corpora = [], isLoading } = useQuery({
    queryKey: ["corpora"],
    queryFn: () => api<Corpus[]>("/api/corpora"),
  });

  const create = useMutation({
    mutationFn: (name: string) =>
      api<Corpus>("/api/corpora", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["corpora"] });
      nav(`/corpus/${c.id}`);
    },
  });

  return (
    <Stack gap="lg">
      <Card withBorder p="lg">
        <Stack gap="sm">
          <Title order={2}>Compare RAG model stacks</Title>
          <Text c="dimmed">
            Run the same questions across embedding, rerank, and chat models. See quality, cost,
            and latency in one leaderboard.
          </Text>
          <Text size="sm" c="dimmed">
            Runs on Render · Models via OpenRouter
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

      <Title order={3}>Your datasets</Title>
      {isLoading && <Text c="dimmed">Loading datasets…</Text>}
      {!isLoading && corpora.length === 0 && (
        <Alert title="No datasets yet">
          Create a corpus below, or run <CodeInline>pnpm seed</CodeInline> after deploy to load the
          SciFact demo.
        </Alert>
      )}
      <Stack>
        {corpora.map((c) => (
          <Card key={c.id} withBorder component={Link} to={`/corpus/${c.id}`} style={{ textDecoration: "none" }}>
            <Text fw={600}>{c.name}</Text>
            {c.description && (
              <Text size="sm" c="dimmed" lineClamp={2}>
                {c.description}
              </Text>
            )}
          </Card>
        ))}
      </Stack>

      <Group align="flex-end">
        <TextInput
          label="Name your document set"
          description="A corpus holds documents and evaluation questions for one comparison run."
          placeholder="e.g. Product docs Q1"
          id="corpus-name"
          style={{ flex: 1 }}
        />
        <Button
          onClick={() => {
            const el = document.getElementById("corpus-name") as HTMLInputElement;
            if (el?.value.trim()) create.mutate(el.value.trim());
          }}
          loading={create.isPending}
        >
          Create corpus
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

function CodeInline({ children }: { children: ReactNode }) {
  return (
    <Text span ff="monospace" size="sm">
      {children}
    </Text>
  );
}
