import { Button, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { COPY } from "../lib/copy";

export default function NotFoundPage() {
  return (
    <Stack align="center" py="xl" gap="md">
      <Title order={2}>{COPY.common.notFound}</Title>
      <Text c="dimmed">{COPY.common.notFoundBody}</Text>
      <Button component={Link} to="/">
        Back to home
      </Button>
    </Stack>
  );
}
