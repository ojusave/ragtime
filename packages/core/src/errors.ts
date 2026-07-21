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

/** Machine-readable classification for a provider failure. */
export type ProviderErrorCode =
  | "insufficient_credits"
  | "rate_limited"
  | "auth"
  | "invalid_model"
  | "provider_unavailable";

/**
 * Provider failure annotated with whether the paid request may have executed.
 * Unknown errors are treated as billing-ambiguous by the cost pipeline.
 */
export class ProviderCallError extends Error {
  override readonly name = "ProviderCallError";

  constructor(
    message: string,
    readonly billingAmbiguous: boolean,
    readonly status?: number,
    readonly retryAfterMs?: number,
    /** Code-based classification so callers never string-match error text. */
    readonly code?: ProviderErrorCode,
    /** Adapter-supplied link that helps the user resolve this error. */
    readonly helpUrl?: string
  ) {
    super(message);
  }
}

/** A costed operation that cannot be replayed without risking a second charge. */
export class CostOperationError extends Error {
  override readonly name = "CostOperationError";

  constructor(
    message: string,
    readonly retryable: boolean,
    readonly originalError?: unknown
  ) {
    super(message);
  }
}
