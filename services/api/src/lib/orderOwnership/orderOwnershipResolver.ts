import type { PrismaClient } from "@prisma/client";
import { getOrderOwnership, mapOwnershipRecord } from "./orderOwnershipCapture.js";

export async function listOrdersByCustomerOwnership(
  prisma: PrismaClient,
  customerUserId: string,
  restaurantId?: string,
  limit = 50
) {
  const rows = await prisma.orderOwnershipRecord.findMany({
    where: {
      customerUserId,
      ...(restaurantId ? { restaurantId } : {})
    },
    orderBy: { lockedAt: "desc" },
    take: Math.min(100, limit)
  });
  return rows.map(mapOwnershipRecord);
}

export async function listOrdersByGuestKey(
  prisma: PrismaClient,
  guestKey: string,
  restaurantId: string,
  limit = 20
) {
  const rows = await prisma.orderOwnershipRecord.findMany({
    where: { guestKey, restaurantId },
    orderBy: { lockedAt: "desc" },
    take: limit
  });
  return rows.map(mapOwnershipRecord);
}

export async function listOrdersByAssignedStaff(
  prisma: PrismaClient,
  staffUserId: string,
  restaurantId: string,
  limit = 50
) {
  const rows = await prisma.orderOwnershipRecord.findMany({
    where: { assignedStaffUserId: staffUserId, restaurantId },
    orderBy: { lockedAt: "desc" },
    take: Math.min(100, limit)
  });
  return rows.map(mapOwnershipRecord);
}

export async function listOrdersByReservation(
  prisma: PrismaClient,
  reservationId: string
) {
  const rows = await prisma.orderOwnershipRecord.findMany({
    where: { reservationId },
    orderBy: { lockedAt: "desc" }
  });
  return rows.map(mapOwnershipRecord);
}

export async function listOrdersByDevice(
  prisma: PrismaClient,
  deviceId: string,
  restaurantId: string
) {
  const rows = await prisma.orderOwnershipRecord.findMany({
    where: { deviceId, restaurantId },
    orderBy: { lockedAt: "desc" }
  });
  return rows.map(mapOwnershipRecord);
}
