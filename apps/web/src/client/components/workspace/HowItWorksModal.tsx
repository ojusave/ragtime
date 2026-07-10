import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { COPY } from "../../lib/copy";

export default function HowItWorksModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={COPY.howItWorks.title} size="md" centered>
      <Stack gap="lg">
        {COPY.howItWorks.steps.map((step, index) => (
          <Group key={step.title} align="flex-start" wrap="nowrap" gap="md">
            <Text className="how-step-number">{index + 1}</Text>
            <Stack gap={3}>
              <Text fw={600} size="sm">
                {step.title}
              </Text>
              <Text size="sm" c="dimmed" lh={1.5}>
                {step.body}
              </Text>
            </Stack>
          </Group>
        ))}
        <Text size="xs" c="dimmed">
          {COPY.howItWorks.footnote}
        </Text>
        <Group justify="flex-end">
          <Button onClick={onClose}>{COPY.common.close}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
