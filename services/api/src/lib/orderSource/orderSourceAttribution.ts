import type { Prisma } from "@prisma/client";
import type { OrderSourceContract, OrderSourcePlacementContext, SourcePlacementAuditPayload } from "./orderSourceTypes.js";
import { SOURCE_CONTRACT_VERSION, TENANT_SOURCE_POLICY_VERSION } from "./orderSourceTypes.js";
import { buildSourceIdentifier } from "./orderSourceResolution.js";
import { appendOrderAuditLog } from "../orders/orderAuditService.js";
import { freezeSourcePolicySnapshot } from "./orderSourcePolicyVersioning.js";
import { buildInitialCompositionalAttribution } from "./orderSourceComposableAnalytics.js";

export function buildSourceAttributionSnapshot(
  contract: OrderSourceContract,
  ctx: OrderSourcePlacementContext
): SourcePlacementAuditPayload {
  const frozenPolicySnapshot = freezeSourcePolicySnapshot(contract);
  const compositionalAttribution = buildInitialCompositionalAttribution(
    ctx.canonicalSource,
    contract.analytics
  );

  return {
    source: ctx.canonicalSource,
    sourceIdentifier: buildSourceIdentifier(ctx),
    validationPassed: true,
    contractVersion: SOURCE_CONTRACT_VERSION,
    policyVersion: TENANT_SOURCE_POLICY_VERSION,
    attribution: contract.analytics,
    compositionalAttribution,
    frozenPolicySnapshot,
    metadata: {
      channel: contract.analytics.channel,
      revenueBucket: contract.analytics.revenueBucket,
      sourceSessionId: ctx.sourceSessionId,
      sourceSessionType: ctx.sourceSessionType,
      reservationId: ctx.reservationId,
      partnerId: ctx.partnerId,
      externalPartnerOrderId: ctx.externalPartnerOrderId,
      deviceId: ctx.deviceId,
      tableLabel: ctx.tableLabel,
      paymentRules: contract.payment,
      notificationRules: contract.notifications
    }
  };
}

export function buildOrderSourceMetadata(
  contract: OrderSourceContract,
  ctx: OrderSourcePlacementContext
): Prisma.InputJsonValue {
  const audit = buildSourceAttributionSnapshot(contract, ctx);
  return {
    ...audit,
    immutable: true,
    placedAt: new Date().toISOString()
  } as unknown as Prisma.InputJsonValue;
}

export async function recordSourcePlacementAudit(
  tx: { orderAuditLog: { create: Function } } | Parameters<typeof appendOrderAuditLog>[0],
  input: {
    orderId: string;
    restaurantId: string;
    actorUserId?: string | null;
    actorSource?: "CUSTOMER" | "STAFF" | "SYSTEM";
    contract: OrderSourceContract;
    ctx: OrderSourcePlacementContext;
  }
) {
  const snapshot = buildSourceAttributionSnapshot(input.contract, input.ctx);

  return appendOrderAuditLog(tx as Parameters<typeof appendOrderAuditLog>[0], {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    action: "source.placement_validated",
    actorUserId: input.actorUserId ?? null,
    actorSource: input.actorSource ?? "SYSTEM",
    afterState: {
      source: snapshot.source,
      sourceIdentifier: snapshot.sourceIdentifier,
      channel: snapshot.attribution.channel
    },
    metadata: snapshot.metadata
  });
}

/** Analytics dimensions — immutable fields for reporting pipelines. */
export const SOURCE_ANALYTICS_DIMENSIONS = [
  "source",
  "channel",
  "revenueBucket",
  "restaurantId",
  "conversionTrackable"
] as const;
