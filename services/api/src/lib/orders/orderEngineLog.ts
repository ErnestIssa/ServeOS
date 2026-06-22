import type { FastifyBaseLogger } from "fastify";
import { captureException } from "../integrations/sentry.js";

export type OrderEngineLogContext = {
  orderId?: string;
  restaurantId?: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  actorUserId?: string | null;
  idempotencyKey?: string;
  provider?: string;
  extra?: Record<string, unknown>;
};

export function logOrderEngineInfo(log: FastifyBaseLogger | undefined, ctx: OrderEngineLogContext, message: string) {
  log?.info({ orderEngine: ctx }, message);
}

export function logOrderEngineWarning(
  log: FastifyBaseLogger | undefined,
  ctx: OrderEngineLogContext,
  message: string,
  err?: unknown
) {
  log?.warn({ orderEngine: ctx, err }, message);
  captureException(err ?? new Error(message), {
    tags: { area: "order_engine", action: ctx.action },
    extra: { ...ctx, ...(ctx.extra ?? {}) }
  });
}

export function logOrderEngineInvalidTransition(
  log: FastifyBaseLogger | undefined,
  ctx: OrderEngineLogContext,
  code: string
) {
  logOrderEngineWarning(log, { ...ctx, extra: { ...(ctx.extra ?? {}), code } }, `order_engine_invalid_transition:${code}`);
}

export function logOrderEngineVersionConflict(log: FastifyBaseLogger | undefined, ctx: OrderEngineLogContext) {
  logOrderEngineWarning(log, ctx, "order_engine_version_conflict");
}
