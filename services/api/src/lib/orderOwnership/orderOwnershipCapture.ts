import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderCreatedContext, OrderSource } from "@prisma/client";
import { deriveGuestKey, resolveOwnershipType } from "./orderOwnershipPolicy.js";
import type { OrderOwnershipSnapshot } from "./orderOwnershipTypes.js";

export type CaptureOwnershipInput = {
  orderId: string;
  restaurantId: string;
  customerUserId?: string | null;
  createdByUserId?: string | null;
  createdByContext: OrderCreatedContext;
  assignedStaffUserId?: string | null;
  tableLabel?: string | null;
  reservationId?: string | null;
  deviceId?: string | null;
  source: OrderSource;
  sourceSessionId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
};

export async function captureOrderOwnership(
  tx: Prisma.TransactionClient,
  input: CaptureOwnershipInput
) {
  const ownershipType = resolveOwnershipType({
    customerUserId: input.customerUserId,
    createdByContext: input.createdByContext,
    source: input.source
  });

  const guestKey = deriveGuestKey({
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    customerName: input.customerName
  });

  return tx.orderOwnershipRecord.create({
    data: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      accountableRestaurantId: input.restaurantId,
      ownershipType,
      customerUserId: input.customerUserId ?? null,
      guestKey,
      createdByUserId: input.createdByUserId ?? null,
      createdByContext: input.createdByContext,
      assignedStaffUserId: input.assignedStaffUserId ?? null,
      tableLabel: input.tableLabel?.trim() || null,
      reservationId: input.reservationId ?? null,
      deviceId: input.deviceId ?? null,
      source: input.source,
      sourceSessionId: input.sourceSessionId ?? null
    }
  });
}

export function mapOwnershipRecord(
  row: {
    orderId: string;
    restaurantId: string;
    accountableRestaurantId: string;
    ownershipType: string;
    customerUserId: string | null;
    guestKey: string | null;
    createdByUserId: string | null;
    createdByContext: OrderCreatedContext;
    assignedStaffUserId: string | null;
    tableLabel: string | null;
    reservationId: string | null;
    deviceId: string | null;
    source: OrderSource;
    sourceSessionId: string | null;
    lockedAt: Date;
  }
): OrderOwnershipSnapshot {
  return {
    orderId: row.orderId,
    restaurantId: row.restaurantId,
    accountableRestaurantId: row.accountableRestaurantId,
    ownershipType: row.ownershipType as OrderOwnershipSnapshot["ownershipType"],
    customerUserId: row.customerUserId,
    guestKey: row.guestKey,
    createdByUserId: row.createdByUserId,
    createdByContext: row.createdByContext,
    assignedStaffUserId: row.assignedStaffUserId,
    tableLabel: row.tableLabel,
    reservationId: row.reservationId,
    deviceId: row.deviceId,
    source: row.source,
    sourceSessionId: row.sourceSessionId,
    lockedAt: row.lockedAt.toISOString()
  };
}

export async function getOrderOwnership(
  prisma: PrismaClient,
  orderId: string
): Promise<OrderOwnershipSnapshot> {
  const row = await prisma.orderOwnershipRecord.findUnique({ where: { orderId } });
  if (!row) throw Object.assign(new Error("ownership_not_found"), { statusCode: 404 });
  return mapOwnershipRecord(row);
}
