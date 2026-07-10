import { Stack, Text } from "@mantine/core";
import { COPY } from "../../lib/copy";

export default function PlaygroundIdle() {
  return (
    <div className="pg-arena-idle">
      <Stack gap={4} maw={360}>
        <Text fw={600}>{COPY.app.canvasIdleTitle}</Text>
        <Text size="sm" c="dimmed">
          {COPY.app.canvasIdleBody}
        </Text>
      </Stack>
    </div>
  );
}
