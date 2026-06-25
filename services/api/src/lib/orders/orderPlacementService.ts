import type { Prisma, PrismaClient } from "@prisma/client";
import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import {
  appendOrderAuditLog,
  appendOrderStatusHistory,
  persistOrderDomainEvent
} from "./orderAuditService.js";
import { buildPricedOrderSnapshot } from "./orderPricing.js";
import { withOrderIdempotency, enqueueOrderOutboxEvent, hashIdempotencyPayload } from "./orderIdempotencyService.js";
import { flushOrderOutboxForOrder } from "./orderOutboxProcessor.js";
import { describePricingSnapshot } from "./orderEventSchema.js";
import { transitionOrderStatus } from "./orderTransitionService.js";
import { mergeOrderEnginePolicy } from "./orderTenantPolicies.js";
import { normalizeOrderStatus, toPrismaOrderStatus, type PlaceOrderInput } from "./orderTypes.js";
import {
  prepareOrderIdentityFields,
  recordOrderIdentityAssignments,
  normalizeSourceSessionType
} from "../orderIdentity/orderIdentityFacade.js";
import { mergeOrderIdentityPolicy, loadRestaurantIdentityPolicy } from "../orderIdentity/orderIdentityPolicy.js";
import { generateInternalOrderId } from "../orderIdentity/orderInternalId.js";
import { buildExtendedIdentityFields } from "../orderIdentity/orderExtendedIdentity.js";
import { logIdentityAssignment } from "../orderIdentity/orderIdentityAudit.js";
import { captureOrderOwnership } from "../orderOwnership/orderOwnershipCapture.js";
import {
  buildPlacementSourceContext,
  validateAndResolveSourceContract,
  derivePlacementDefaultsFromSource,
  buildOrderSourceMetadata,
  recordSourcePlacementAudit,
  resolveOwnershipHintsFromSource
} from "../orderSource/index.js";
import { registerPartnerOrderIdentity } from "../orderIdentity/orderPartnerRegistry.js";

async function createOrderRecord(
  prisma: PrismaClient,
  input: PlaceOrderInput,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  if (!input.lines.length) {
    throw Object.assign(new Error("order_lines_required"), { statusCode: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id: input.restaurantId } });
  if (!restaurant) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });

  const { pricedLines, totals } = await buildPricedOrderSnapshot(prisma, input.restaurantId, input.lines);

  const sourceCtx = buildPlacementSourceContext(input, { internalTotalCents: totals.totalCents });
  const sourceContract = await validateAndResolveSourceContract(prisma, sourceCtx);
  const ownershipHints = resolveOwnershipHintsFromSource(sourceContract, sourceCtx);

  const sourceDefaults = derivePlacementDefaultsFromSource(sourceContract);
  const initialStatus = input.initialStatus
    ? toPrismaOrderStatus(input.initialStatus)
    : sourceDefaults.initialStatus;
  const paymentStatus = input.paymentStatus ?? sourceDefaults.paymentStatus;
  const source = sourceCtx.prismaSource;
  const sourceMetadata = buildOrderSourceMetadata(sourceContract, sourceCtx);

  const created = await prisma.$transaction(async (tx) => {
    const identityPolicy = await loadRestaurantIdentityPolicy(tx as unknown as PrismaClient, input.restaurantId);
    const identity = await prepareOrderIdentityFields(tx, {
      restaurantId: input.restaurantId,
      sourceSessionId: input.sourceSessionId,
      sourceSessionType: normalizeSourceSessionType(input.sourceSessionType)
    });

    const ulidId =
      identityPolicy.internalIdSchema === "ulid" ? generateInternalOrderId("ulid").id : undefined;
    const createdAt = new Date();

    const o = await tx.order.create({
      data: {
        ...(ulidId ? { id: ulidId } : {}),
        restaurantId: input.restaurantId,
        customerUserId: input.customerUserId ?? null,
        createdByUserId: input.createdByUserId ?? input.customerUserId ?? null,
        createdByContext: input.createdByContext ?? ownershipHints.createdByContext,
        displaySeq: identity.displaySeq,
        displayPeriodKey: identity.displayPeriodKey,
        sourceSessionId: identity.sourceSessionId,
        sourceSessionType: identity.sourceSessionType,
        deviceId: input.deviceId?.trim() || null,
        reservationId: input.reservationId?.trim() || null,
        source,
        sourceMetadata,
        status: initialStatus,
        paymentStatus,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        serviceFeeCents: totals.serviceFeeCents,
        totalCents: totals.totalCents,
        note: input.note?.trim() || null,
        customerName: input.customerName?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        customerEmail: input.customerEmail?.trim() || null,
        tableLabel: input.tableLabel?.trim() || null,
        assignedStaffUserId: input.assignedStaffUserId ?? null,
        lines: {
          create: pricedLines.map((l) => ({
            menuItemId: l.menuItemId,
            nameSnapshot: l.nameSnapshot,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            selectedModifiers: l.selectedModifiers as unknown as Prisma.InputJsonValue,
            lineTotalCents: l.lineTotalCents
          }))
        }
      },
      include: { lines: true, restaurant: { select: { name: true } } }
    });

    const extended = buildExtendedIdentityFields({
      orderId: o.id,
      restaurantId: o.restaurantId,
      displaySeq: identity.displaySeq,
      displayPeriodKey: identity.displayPeriodKey,
      totalCents: o.totalCents,
      createdAt: o.createdAt ?? createdAt,
      internalIdSchema: identityPolicy.internalIdSchema
    });

    const enriched = await tx.order.update({
      where: { id: o.id },
      data: extended,
      include: { lines: true, restaurant: { select: { name: true } } }
    });

    await recordOrderIdentityAssignments(tx, {
      orderId: enriched.id,
      restaurantId: enriched.restaurantId,
      displaySeq: identity.displaySeq,
      displayPeriodKey: identity.displayPeriodKey,
      sourceSessionId: identity.sourceSessionId,
      sourceSessionType: identity.sourceSessionType,
      actorUserId: input.createdByUserId ?? input.customerUserId ?? null,
      actorSource: input.createdByContext === "STAFF" ? "STAFF" : input.customerUserId ? "CUSTOMER" : "SYSTEM"
    });

    await logIdentityAssignment(tx, {
      orderId: enriched.id,
      restaurantId: enriched.restaurantId,
      action: "identity.tracking_derived",
      metadata: {
        gs1Identifier: extended.gs1Identifier,
        receiptSearchHash: extended.receiptSearchHash,
        federationId: extended.federationId,
        internalIdSchema: extended.internalIdSchema
      }
    });

    await captureOrderOwnership(tx, {
      orderId: enriched.id,
      restaurantId: enriched.restaurantId,
      customerUserId: enriched.customerUserId,
      createdByUserId: enriched.createdByUserId,
      createdByContext:
        input.createdByContext ?? ownershipHints.createdByContext,
      assignedStaffUserId: enriched.assignedStaffUserId,
      tableLabel: enriched.tableLabel,
      reservationId: enriched.reservationId,
      deviceId: enriched.deviceId,
      source: enriched.source,
      sourceSessionId: enriched.sourceSessionId,
      customerEmail: enriched.customerEmail,
      customerPhone: enriched.customerPhone,
      customerName: enriched.customerName
    });

    await recordSourcePlacementAudit(tx, {
      orderId: enriched.id,
      restaurantId: enriched.restaurantId,
      actorUserId: input.createdByUserId ?? input.customerUserId ?? null,
      actorSource: input.createdByContext === "STAFF" ? "STAFF" : input.customerUserId ? "CUSTOMER" : "SYSTEM",
      contract: sourceContract,
      ctx: sourceCtx
    });

    await appendOrderStatusHistory(tx, {
      orderId: enriched.id,
      fromStatus: null,
      toStatus: initialStatus,
      actorUserId: input.createdByUserId ?? input.customerUserId ?? null,
      actorSource: input.createdByContext === "STAFF" ? "STAFF" : input.customerUserId ? "CUSTOMER" : "SYSTEM",
      reason: "order_placed"
    });

    await appendOrderAuditLog(tx, {
      orderId: enriched.id,
      restaurantId: enriched.restaurantId,
      action: "order.created",
      actorUserId: input.createdByUserId ?? input.customerUserId ?? null,
      actorSource: input.createdByContext === "STAFF" ? "STAFF" : input.customerUserId ? "CUSTOMER" : "SYSTEM",
      afterState: {
        status: enriched.status,
        paymentStatus: enriched.paymentStatus,
        totalCents: enriched.totalCents,
        lineCount: enriched.lines.length,
        pricingSnapshot: describePricingSnapshot(null)
      },
      metadata: { source, lineSnapshots: pricedLines, sourceChannel: sourceContract.analytics.channel }
    });

    const envelope = await enqueueOrderOutboxEvent(tx, {
      type: "order.created",
      order: enriched,
      actorUserId: input.createdByUserId ?? input.customerUserId ?? null
    });

    await persistOrderDomainEvent(tx, {
      orderId: enriched.id,
      restaurantId: enriched.restaurantId,
      type: "order.created",
      payload: envelope as unknown as Record<string, unknown>
    });

    return enriched;
  });

  if (
    sourceCtx.canonicalSource === "DELIVERY_PARTNER" &&
    sourceCtx.partnerId &&
    sourceCtx.externalPartnerOrderId
  ) {
    await registerPartnerOrderIdentity(prisma, {
      orderId: created.id,
      restaurantId: created.restaurantId,
      partnerId: sourceCtx.partnerId,
      externalOrderId: sourceCtx.externalPartnerOrderId,
      metadata: { source: "DELIVERY_PARTNER" }
    });
  }

  if (buses) {
    await flushOrderOutboxForOrder(prisma, created.id, buses, log);
  }

  const policy = mergeOrderEnginePolicy(restaurant.orderEnginePolicy);
  const canon = normalizeOrderStatus(created.status);
  if (policy.autoAcceptOnCreate && (canon === "CREATED" || canon === "PAID")) {
    const accepted = await transitionOrderStatus(
      prisma,
      {
        orderId: created.id,
        targetStatus: "ACCEPTED",
        actor: { source: "SYSTEM" },
        reason: "tenant_policy:auto_accept_on_create"
      },
      buses,
      log
    );
    if (buses) await flushOrderOutboxForOrder(prisma, accepted.id, buses, log);
    return accepted;
  }

  return created;
}

export async function placeOrder(
  prisma: PrismaClient,
  input: PlaceOrderInput,
  buses?: { domainEventBus?: EventEmitter; orderBus?: EventEmitter },
  log?: FastifyBaseLogger
) {
  if (!input.idempotencyKey) {
    return createOrderRecord(prisma, input, buses, log);
  }

  return withOrderIdempotency(
    prisma,
    {
      scope: "place_order",
      key: input.idempotencyKey,
      restaurantId: input.restaurantId,
      requestHash: hashIdempotencyPayload({
        restaurantId: input.restaurantId,
        lines: input.lines,
        customerUserId: input.customerUserId
      })
    },
    async () => {
      const order = await createOrderRecord(prisma, input, buses, log);
      return { orderId: order.id, response: order };
    }
  );
}
