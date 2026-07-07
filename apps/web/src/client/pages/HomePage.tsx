import {
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { renderSignupUrlWithUtms, DEPLOY_TO_RENDER_URL } from "../lib/render-links";

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
          <Title order={2}>RAG bake-off arena</Title>
          <Text c="dimmed">
            Compare embedding, rerank, and generation models on your corpus.
            Orchestrated by Render Workflows, powered by OpenRouter.
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

      <Title order={3}>Corpora</Title>
      {isLoading && <Text>Loading...</Text>}
      <Stack>
        {corpora.map((c) => (
          <Card key={c.id} withBorder component={Link} to={`/corpus/${c.id}`} style={{ textDecoration: "none" }}>
            <Text fw={600}>{c.name}</Text>
            {c.description && <Text size="sm" c="dimmed">{c.description}</Text>}
          </Card>
        ))}
      </Stack>

      <Group>
        <TextInput
          placeholder="New corpus name"
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
    </Stack>
  );
}
