import type { Prisma } from "@prisma/client";
import { persistOrderDomainEvent } from "../orders/orderAuditService.js";
import { enqueueOrderOutboxEvent } from "../orders/orderIdempotencyService.js";
import type { OrderEventType } from "../orders/orderTypes.js";
import type { OrderEditOperationType, OrderEditPricingResult } from "./orderEditTypes.js";

export function resolveEditEventTypes(operation: OrderEditOperationType): OrderEventType[] {
  const events: OrderEventType[] = ["order.edited"];

  if (operation === "ADD_ITEM") events.push("order.item_added");
  if (operation === "REMOVE_ITEM") events.push("order.item_removed");
  if (
    ["ADD_ITEM", "REMOVE_ITEM", "UPDATE_QUANTITY", "MODIFY_MODIFIERS", "PRICE_OVERRIDE"].includes(operation)
  ) {
    events.push("order.pricing_updated");
  }

  return [...new Set(events)];
}

export async function emitOrderEditEvents(
  tx: Prisma.TransactionClient,
  input: {
    operation: OrderEditOperationType;
    order: {
      id: string;
      restaurantId: string;
      status: string;
      totalCents: number;
      customerUserId: string | null;
      displaySeq?: number | null;
      displayPeriodKey?: string;
      paymentStatus?: string;
    };
    actorUserId?: string | null;
    pricing: OrderEditPricingResult;
    kdsNotifyRequired: boolean;
    linesChanged: number;
  }
) {
  const eventTypes = resolveEditEventTypes(input.operation);
  const metadata = {
    operation: input.operation,
    previousTotalCents: input.pricing.previousTotalCents,
    paymentDeltaCents: input.pricing.paymentDeltaCents,
    requiresAdditionalCharge: input.pricing.requiresAdditionalCharge,
    requiresRefundDelta: input.pricing.requiresRefundDelta,
    kdsNotifyRequired: input.kdsNotifyRequired,
    linesChanged: input.linesChanged
  };

  for (const type of eventTypes) {
    await persistOrderDomainEvent(tx, {
      orderId: input.order.id,
      restaurantId: input.order.restaurantId,
      type,
      payload: metadata
    });

    await enqueueOrderOutboxEvent(tx, {
      type,
      order: input.order,
      actorUserId: input.actorUserId,
      metadata
    });
  }
}

export const ORDER_EDIT_EVENT_AUTHORITY = {
  rule: "all successful edits emit order.edited + operation-specific events via outbox"
} as const;
