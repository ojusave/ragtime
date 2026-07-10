import { Alert, Button, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { FLOW_STEPS, COPY } from "../../lib/copy";
import RenderCtas from "../RenderCtas";

type Props = {
  loading: boolean;
  failed: boolean;
  errorMessage?: string;
  onRetry: () => void;
};

/** Centered first-run card while SciFact sample data loads or needs a retry. */
export default function DemoSetupPanel({ loading, failed, errorMessage, onRetry }: Props) {
  return (
    <div className="workspace-setup">
      <div className="workspace-setup-card">
        <Stack gap="lg">
          <Stack gap="xs">
            <Text className="workspace-setup-eyebrow">RAGtime</Text>
            <Title order={2} className="workspace-setup-title">
              Compare RAG models side by side
            </Title>
            <Text size="sm" c="dimmed">
              One question, many embedding, rerank, and answer models. Runs on Render Workflows with
              live progress.
            </Text>
          </Stack>

          <Stack gap="sm" className="workspace-setup-steps">
            {FLOW_STEPS.map((step, index) => (
              <Group key={step.label} gap="sm" wrap="nowrap" align="flex-start">
                <span className="how-step-number">{index + 1}</span>
                <Stack gap={2}>
                  <Text size="sm" fw={600}>
                    {step.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {step.description}
                  </Text>
                </Stack>
              </Group>
            ))}
          </Stack>

          {failed ? (
            <Alert color="red" title="Could not load sample data">
              <Stack gap="sm">
                <Text size="sm">{errorMessage ?? COPY.common.loadFailed}</Text>
                <Button size="sm" onClick={onRetry}>
                  {COPY.common.tryAgain}
                </Button>
              </Stack>
            </Alert>
          ) : (
            <Group gap="sm" wrap="wrap">
              <Button
                size="md"
                onClick={onRetry}
                loading={loading}
                leftSection={loading ? <Loader size="xs" color="white" /> : undefined}
              >
                {loading ? COPY.workspace.loadingDemo : COPY.workspace.loadDemo}
              </Button>
              <Text size="xs" c="dimmed">
                Loads the SciFact sample corpus so you can run a comparison immediately.
              </Text>
            </Group>
          )}

          <Group justify="space-between" wrap="wrap" className="workspace-setup-footer">
            <Text size="xs" c="dimmed">
              {COPY.howItWorks.footnote}
            </Text>
            <RenderCtas signupContent="hero_cta" size="sm" />
          </Group>
        </Stack>
      </div>
    </div>
  );
}
