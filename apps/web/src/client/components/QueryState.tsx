import { Alert, Button, Center, Loader, Stack, Text } from "@mantine/core";
import { friendlyError } from "../lib/copy";

type Props = {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry?: () => void;
  notFound?: boolean;
  children: React.ReactNode;
};

/** Standard loading, error, and not-found wrappers for page queries. */
export default function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  notFound,
  children,
}: Props) {
  if (isLoading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="sm">
          <Loader size="md" />
          <Text c="dimmed" size="sm">
            Loading…
          </Text>
        </Stack>
      </Center>
    );
  }

  if (notFound) {
    return (
      <Alert color="gray" title="Not found">
        This page does not exist or was removed.
      </Alert>
    );
  }

  if (isError) {
    return (
      <Alert color="red" title="Could not load data">
        {friendlyError(error?.message ?? "Unknown error")}
        {onRetry && (
          <Button variant="light" size="compact-sm" mt="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </Alert>
    );
  }

  return <>{children}</>;
}
