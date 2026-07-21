import { ProviderCallError, safePersistedError } from "@ragtime/core";

export type ErrorBody = {
  error: string;
  code?: string;
  helpUrl?: string;
};

/**
 * Serializes an error for an API response. Provider failures expose a stable
 * `code` (and optional `helpUrl`) so the client never string-matches messages.
 */
export function toErrorBody(error: unknown, fallback: string): ErrorBody {
  if (error instanceof ProviderCallError) {
    return {
      error: safePersistedError(error, fallback),
      code: error.code,
      helpUrl: error.helpUrl,
    };
  }
  return { error: safePersistedError(error, fallback) };
}
