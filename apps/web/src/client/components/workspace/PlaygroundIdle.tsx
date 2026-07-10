import { Stack, Text } from "@mantine/core";
import { COPY } from "../../lib/copy";

/** Empty arena state before the first launch. */
export default function PlaygroundIdle() {
  return (
    <div className="pg-arena-idle">
      <span className="pg-arena-idle-icon" aria-hidden="true">
        ◎
      </span>
      <Stack gap={4} maw={360}>
        <Text fw={600}>{COPY.playground.canvasIdleTitle}</Text>
        <Text size="sm" c="dimmed">
          {COPY.playground.canvasIdleBody}
        </Text>
      </Stack>
    </div>
  );
}
