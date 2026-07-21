import { Stack, Text } from "@mantine/core";
import { COPY } from "../../lib/copy";

function IdleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="7.5"
        height="14"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="13.5"
        y="5"
        width="7.5"
        height="14"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 9h3.5M5 12h3.5M15.5 9H19M15.5 12H19"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PlaygroundIdle() {
  return (
    <div className="pg-arena-idle">
      <span className="pg-arena-idle-icon">
        <IdleIcon />
      </span>
      <Stack gap={4} maw={360} align="center">
        <Text fw={600}>{COPY.app.canvasIdleTitle}</Text>
        <Text size="sm" c="dimmed">
          {COPY.app.canvasIdleBody}
        </Text>
      </Stack>
    </div>
  );
}
