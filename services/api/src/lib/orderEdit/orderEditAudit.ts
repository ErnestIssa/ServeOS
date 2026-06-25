import type { Prisma } from "@prisma/client";
import { appendOrderAuditLog } from "../orders/orderAuditService.js";
import type { OrderEditOperationType, OrderEditPricingResult, OrderEditRequestSource } from "./orderEditTypes.js";

export async function recordOrderEditAudit(
  tx: Parameters<typeof appendOrderAuditLog>[0],
  input: {
    orderId: string;
    restaurantId: string;
    operation: OrderEditOperationType;
    actorUserId?: string | null;
    actorSource: "CUSTOMER" | "STAFF" | "SYSTEM" | "ADMIN";
    reason?: string;
    requestSource?: OrderEditRequestSource;
    beforeState: Record<string, unknown>;
    afterState: Record<string, unknown>;
    pricing: OrderEditPricingResult;
    metadata?: Record<string, unknown>;
  }
) {
  return appendOrderAuditLog(tx, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    action: `edit.${input.operation.toLowerCase()}`,
    actorUserId: input.actorUserId ?? null,
    actorSource: input.actorSource,
    beforeState: input.beforeState,
    afterState: input.afterState,
    metadata: {
      classification: "order_edit",
      operation: input.operation,
      reason: input.reason ?? null,
      requestSource: input.requestSource ?? "UI",
      paymentDeltaCents: input.pricing.paymentDeltaCents,
      requiresAdditionalCharge: input.pricing.requiresAdditionalCharge,
      requiresRefundDelta: input.pricing.requiresRefundDelta,
      ...input.metadata
    } as Prisma.InputJsonValue
  });
}

export const ORDER_EDIT_AUDIT_CLASSIFICATION = "order_edit" as const;
