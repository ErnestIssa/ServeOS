import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderActorSource } from "@prisma/client";
import { appendOrderAuditLog } from "../orders/orderAuditService.js";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function logIdentityAssignment(
  tx: Tx,
  input: {
    orderId: string;
    restaurantId: string;
    action:
      | "identity.internal_assigned"
      | "identity.tenant_number_assigned"
      | "identity.payment_linked"
      | "identity.session_attached"
      | "identity.tracking_derived";
    actorUserId?: string | null;
    actorSource?: OrderActorSource;
    metadata?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
  }
) {
  return appendOrderAuditLog(tx, {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    actorSource: input.actorSource ?? "SYSTEM",
    afterState: input.afterState,
    metadata: input.metadata
  });
}
