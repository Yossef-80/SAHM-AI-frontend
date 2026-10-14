import { ApiError } from "@/lib/api";

/**
 * One place that turns an `ApiError` into something worth showing a user.
 *
 * The rule the backend enforces is that every error carries `{code, message}`
 * in one envelope. Most codes deserve better copy than the raw message — a 429
 * that does not mention `Retry-After` reads as "the server is broken" when it
 * actually means "come back in 40 seconds" — so the codes we know about get
 * translated, and everything else falls through to the server's own message
 * verbatim. A server that says something specific is always believed.
 *
 * `t` is a `next-intl` translator scoped to the `errors` namespace.
 */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorCode(error: unknown): string {
  return isApiError(error) ? error.code : "";
}

/** `Retry-After` in seconds, when the error carried one. */
export function retryAfterSeconds(error: unknown): number | undefined {
  if (!isApiError(error)) return undefined;
  const raw = error.details?.retryAfterSeconds ?? error.details?.retry_after_seconds ?? error.details?.retryAfter;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

/** The message shown to the user, in the app's language. */
export function describeError(error: unknown, t: Translate): string {
  if (!isApiError(error)) {
    return error instanceof Error ? error.message : t("generic");
  }
  switch (error.code) {
    case "network_error": {
      // No readable response arrived. Say exactly that: the old copy claimed the
      // backend was not running, which was wrong whenever the server had in fact
      // answered but the browser could not read the response.
      const url = typeof error.details?.url === "string" ? error.details.url : "";
      return url ? t("networkError", { url }) : t("networkErrorNoUrl");
    }
    case "request_timeout":
      return t("requestTimeout");
    case "internal_error": {
      // A 5xx is a bug on the server, not something the user did; the one thing
      // they can act on is quoting the request id from the backend log.
      const ref = typeof error.details?.requestId === "string" ? error.details.requestId : "";
      return ref ? t("serverError", { ref }) : t("serverErrorNoRef");
    }
    case "rate_limited": {
      const seconds = retryAfterSeconds(error);
      return seconds !== undefined ? t("rateLimited", { seconds }) : t("rateLimitedUnknown");
    }
    case "token_budget_exceeded":
      return t("budgetExceeded");
    case "unauthorized":
      return error.message || t("unauthorized");
    case "forbidden":
      return t("forbidden");
    case "schema_mismatch":
      return t("schemaMismatch");
    case "NOT_IMPLEMENTED":
      return error.message;
    default:
      return error.message || t("generic");
  }
}
