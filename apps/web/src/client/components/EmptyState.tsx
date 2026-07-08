import { Stack, Text } from "@mantine/core";

type Props = {
  title: string;
  hint?: string;
};

/** Compact empty table / list placeholder. */
export default function EmptyState({ title, hint }: Props) {
  return (
    <Stack gap={4} py="md" ta="center">
      <Text size="sm" c="dimmed" fw={500}>
        {title}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Stack>
  );
}
