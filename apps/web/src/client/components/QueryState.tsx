import { Alert, Button, Center, Loader, Stack, Text } from "@mantine/core";
import { COPY, friendlyError } from "../lib/copy";

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
            {COPY.common.loading}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (notFound) {
    return (
      <Alert color="gray" title={COPY.common.notFound}>
        {COPY.common.notFoundBody}
      </Alert>
    );
  }

  if (isError) {
    return (
      <Alert color="red" title={COPY.common.loadFailed}>
        {friendlyError(error?.message ?? "Unknown error")}
        {onRetry && (
          <Button variant="light" size="compact-sm" mt="sm" onClick={onRetry}>
            {COPY.common.tryAgain}
          </Button>
        )}
      </Alert>
    );
  }

  return <>{children}</>;
}
