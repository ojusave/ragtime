import { useState } from "react";
import type { ReactNode } from "react";
import { ActionIcon, Group, Popover, Text } from "@mantine/core";

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 11v5"
      />
      <circle cx="12" cy="7.75" r="1.15" fill="currentColor" />
    </svg>
  );
}

type Props = {
  /** Screen-reader label for the trigger button, e.g. "What is Embedding?". */
  ariaLabel: string;
  /** The explanation shown inside the popover. */
  children: ReactNode;
};

/**
 * A small "i" affordance that reveals a short explanation on click, tap, or
 * keyboard. Uses a click popover (not a hover tooltip) so it works on touch and
 * keyboard, closes on Escape or outside click, and returns focus to the trigger.
 */
export default function InfoHint({ ariaLabel, children }: Props) {
  const [opened, setOpened] = useState(false);
  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={260}
      position="top"
      withArrow
      shadow="md"
      trapFocus
      returnFocus
      closeOnEscape
      closeOnClickOutside
      withinPortal
    >
      <Popover.Target>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          radius="xl"
          aria-label={ariaLabel}
          onClick={(e) => {
            e.stopPropagation();
            setOpened((o) => !o);
          }}
        >
          <InfoIcon />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="xs">{children}</Text>
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * Renders a field label with an adjacent info affordance, suitable for passing
 * to a Mantine input's `label` prop. Keeps the short label visible and puts the
 * deeper explanation behind the "i".
 */
export function LabelWithInfo({
  label,
  info,
  ariaLabel,
}: {
  label: string;
  info: ReactNode;
  ariaLabel: string;
}) {
  return (
    <Group gap={4} wrap="nowrap" component="span" display="inline-flex">
      <span>{label}</span>
      <InfoHint ariaLabel={ariaLabel}>{info}</InfoHint>
    </Group>
  );
}
