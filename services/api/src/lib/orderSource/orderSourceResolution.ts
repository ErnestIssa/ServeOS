import type { OrderSource } from "@prisma/client";
import type { PlaceOrderInput } from "../orders/orderTypes.js";
import {
  FUTURE_ORDER_SOURCES,
  PHASE_1_ORDER_SOURCES,
  type CanonicalOrderSource,
  type OrderSourcePlacementContext
} from "./orderSourceTypes.js";

const LEGACY_SOURCE_MAP: Partial<Record<OrderSource, CanonicalOrderSource>> = {
  RESERVATION: "RESERVATION_ORDER"
};

export function normalizeToCanonicalSource(raw: string | OrderSource): CanonicalOrderSource {
  if ((FUTURE_ORDER_SOURCES as string[]).includes(raw)) {
    throw Object.assign(new Error("source_not_implemented"), { statusCode: 501 });
  }

  const mapped = LEGACY_SOURCE_MAP[raw as OrderSource];
  if (mapped) return mapped;

  if (!(PHASE_1_ORDER_SOURCES as string[]).includes(raw)) {
    throw Object.assign(new Error("invalid_order_source"), { statusCode: 400 });
  }

  return raw as CanonicalOrderSource;
}

export function toPrismaOrderSource(canonical: CanonicalOrderSource): OrderSource {
  return canonical as OrderSource;
}

export function inferCanonicalSourceFromPlacement(input: PlaceOrderInput): CanonicalOrderSource {
  if (input.source) return normalizeToCanonicalSource(input.source);

  if (input.reservationId?.trim()) return "RESERVATION_ORDER";
  if (input.partnerId && input.externalPartnerOrderId) return "DELIVERY_PARTNER";
  if (input.createdByContext === "STAFF") return "STAFF_CREATED";
  if (input.sourceSessionId?.trim()) return "QR_ORDER";

  return "QR_ORDER";
}

export function buildPlacementSourceContext(
  input: PlaceOrderInput,
  extras?: { actorMembershipRole?: string | null; internalTotalCents?: number | null }
): OrderSourcePlacementContext {
  const canonicalSource = input.source
    ? normalizeToCanonicalSource(input.source)
    : inferCanonicalSourceFromPlacement(input);

  return {
    restaurantId: input.restaurantId,
    canonicalSource,
    prismaSource: toPrismaOrderSource(canonicalSource),
    customerUserId: input.customerUserId,
    createdByUserId: input.createdByUserId,
    createdByContext: input.createdByContext,
    sourceSessionId: input.sourceSessionId,
    sourceSessionType: input.sourceSessionType,
    tableLabel: input.tableLabel,
    reservationId: input.reservationId,
    deviceId: input.deviceId,
    partnerId: input.partnerId,
    externalPartnerOrderId: input.externalPartnerOrderId,
    partnerTotalCents: input.partnerTotalCents,
    internalTotalCents: extras?.internalTotalCents ?? null,
    lineCount: input.lines.length,
    actorMembershipRole: extras?.actorMembershipRole ?? null
  };
}

export function buildSourceIdentifier(ctx: OrderSourcePlacementContext): string {
  if (ctx.canonicalSource === "DELIVERY_PARTNER" && ctx.partnerId && ctx.externalPartnerOrderId) {
    return `${ctx.partnerId}:${ctx.externalPartnerOrderId}`;
  }
  if (ctx.sourceSessionId) return `session:${ctx.sourceSessionId}`;
  if (ctx.reservationId) return `reservation:${ctx.reservationId}`;
  if (ctx.createdByUserId) return `staff:${ctx.createdByUserId}`;
  if (ctx.customerUserId) return `customer:${ctx.customerUserId}`;
  return `restaurant:${ctx.restaurantId}`;
}
