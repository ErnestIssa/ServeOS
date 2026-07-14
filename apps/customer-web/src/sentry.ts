import * as Sentry from "@sentry/react";
import type { PublicClientConfig } from "./bootstrap/clientConfig";

let initialized = false;

export function initSentryFromConfig(config: PublicClientConfig | null) {
  if (initialized) return false;
  const sentry = config?.observability.sentry;
  if (!sentry?.enabled || !sentry.dsn) return false;

  Sentry.init({
    dsn: sentry.dsn,
    environment: sentry.environment,
    release: sentry.release ?? undefined,
    tracesSampleRate: sentry.tracesSampleRate,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true
      })
    ],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1
  });
  initialized = true;
  return true;
}

export function captureClientException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext("extra", context);
    Sentry.captureException(error);
  });
}

export function captureClientApiError(path: string, status: number, error?: string) {
  if (!initialized || status < 500) return;
  Sentry.withScope((scope) => {
    scope.setTag("area", "api");
    scope.setTag("status_code", String(status));
    scope.setExtra("path", path);
    if (error) scope.setExtra("error", error);
    Sentry.captureMessage(`client_api_error:${status} ${path}`, "error");
  });
}

export { Sentry };
