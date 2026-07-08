import { Button, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <Stack align="center" py="xl" gap="md">
      <Title order={2}>Page not found</Title>
      <Text c="dimmed">That route does not exist in RAGtime.</Text>
      <Button component={Link} to="/">
        Back to home
      </Button>
    </Stack>
  );
}
