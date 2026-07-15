const MAX_PERSISTED_ERROR_LENGTH = 1000;

/** Persist only errors explicitly produced as safe public messages. */
export function safePersistedError(
  error: unknown,
  fallback = "Operation failed"
): string {
  const candidate =
    error instanceof Error && error.name === "SafeUrlFetchError"
      ? error.message
      : fallback;
  return candidate
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, MAX_PERSISTED_ERROR_LENGTH);
}
