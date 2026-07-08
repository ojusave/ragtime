import { Anchor, Breadcrumbs, Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type Crumb = { label: string; to?: string };

type Props = {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
};

/** Page title with optional breadcrumb trail and right-side actions. */
export default function PageHeader({ title, description, crumbs, actions }: Props) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
      <Stack gap={4} style={{ flex: 1, minWidth: 200 }}>
        {crumbs && crumbs.length > 0 && (
          <Breadcrumbs separator="›">
            {crumbs.map((c, i) =>
              c.to ? (
                <Anchor key={i} component={Link} to={c.to} size="sm">
                  {c.label}
                </Anchor>
              ) : (
                <Text key={i} size="sm" c="dimmed">
                  {c.label}
                </Text>
              )
            )}
          </Breadcrumbs>
        )}
        <Title order={2}>{title}</Title>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      {actions && <Group gap="sm">{actions}</Group>}
    </Group>
  );
}
