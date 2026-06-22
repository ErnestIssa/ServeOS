import type { OrderCreatedContext, OrderSource } from "@prisma/client";

export type OrderOwnershipType =
  | "CUSTOMER_ACCOUNT"
  | "GUEST"
  | "STAFF_CREATED"
  | "RESTAURANT_ACCOUNTABLE"
  | "PARTNER_SOURCED";

export type OrderOwnershipSnapshot = {
  orderId: string;
  restaurantId: string;
  accountableRestaurantId: string;
  ownershipType: OrderOwnershipType;
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
  lockedAt: string;
};

export type OrderOwnershipActor = {
  userId: string;
  membershipRole?: string | null;
  isCustomer?: boolean;
};

export const ORDER_OWNERSHIP_IMMUTABILITY = {
  snapshotLockedAtPlacement: true,
  customerUserIdFrozen: true,
  createdByContextFrozen: true,
  accountableRestaurantIdFrozen: true
} as const;
