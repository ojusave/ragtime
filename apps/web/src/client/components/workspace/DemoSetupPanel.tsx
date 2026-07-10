import { Alert, Button, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { FLOW_STEPS, COPY } from "../../lib/copy";
import RenderCtas from "../RenderCtas";

type Props = {
  loading: boolean;
  failed: boolean;
  errorMessage?: string;
  onRetry: () => void;
};

export default function DemoSetupPanel({ loading, failed, errorMessage, onRetry }: Props) {
  return (
    <div className="pg-setup">
      <div className="pg-setup-card">
        <Stack gap="lg">
          <Stack gap="xs">
            <Title order={2} className="pg-setup-title">
              {COPY.app.welcomeTitle}
            </Title>
            <Text size="sm" c="dimmed">
              {COPY.app.welcomeBody}
            </Text>
          </Stack>

          <Stack gap="sm" className="pg-setup-steps">
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
            <Alert color="red" title="Corpus load failed">
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
                {loading ? COPY.app.loadingDemo : COPY.app.loadDemo}
              </Button>
            </Group>
          )}

          <Group justify="space-between" wrap="wrap" className="pg-setup-footer">
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
