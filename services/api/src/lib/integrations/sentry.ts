import type { FastifyRequest } from "fastify";
import * as Sentry from "@sentry/node";

export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

function requestContext(req?: FastifyRequest) {
  if (!req) return undefined;
  return {
    method: req.method,
    url: req.url,
    route: req.routeOptions?.url
  };
}

export function captureException(
  error: unknown,
  context?: {
    req?: FastifyRequest;
    statusCode?: number;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) {
  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    if (context?.statusCode) scope.setTag("status_code", String(context.statusCode));
    if (context?.tags) {
      for (const [key, value] of Object.entries(context.tags)) scope.setTag(key, value);
    }
    if (context?.req) scope.setContext("request", requestContext(context.req) ?? {});
    if (context?.extra) scope.setContext("extra", context.extra);
    Sentry.captureException(error);
  });
}

export function captureApiError(params: {
  req: FastifyRequest;
  statusCode: number;
  error?: string;
}) {
  if (!isSentryEnabled() || params.statusCode < 500) return;

  Sentry.withScope((scope) => {
    scope.setTag("area", "api");
    scope.setTag("status_code", String(params.statusCode));
    scope.setContext("request", requestContext(params.req) ?? {});
    if (params.error) scope.setExtra("error", params.error);
    Sentry.captureMessage(`API ${params.statusCode} ${params.req.method} ${params.req.url}`, "error");
  });
}

export function captureAuthFailure(params: {
  reason: string;
  req?: FastifyRequest;
  userId?: string | null;
  email?: string | null;
}) {
  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    scope.setTag("area", "auth");
    scope.setTag("auth_reason", params.reason);
    if (params.userId) scope.setUser({ id: params.userId });
    if (params.req) scope.setContext("request", requestContext(params.req) ?? {});
    scope.setFingerprint(["auth_failure", params.reason]);
    Sentry.captureMessage(`auth_failure:${params.reason}`, {
      level: "warning",
      extra: {
        email: params.email ?? undefined
      }
    });
  });
}

export function captureSecurityAudit(event: {
  userId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    scope.setTag("area", "security_audit");
    scope.setTag("audit_action", event.action);
    scope.setUser({ id: event.userId });
    if (event.metadata) scope.setContext("metadata", event.metadata);
    Sentry.captureMessage(`security_audit:${event.action}`, "info");
  });
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!isSentryEnabled()) return;
  await Sentry.flush(timeoutMs);
}
