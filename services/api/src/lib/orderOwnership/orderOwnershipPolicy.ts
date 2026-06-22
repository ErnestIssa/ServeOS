import { createHash } from "node:crypto";
import type { OrderCreatedContext, OrderSource } from "@prisma/client";
import type { OrderOwnershipType } from "./orderOwnershipTypes.js";

export function deriveGuestKey(input: {
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
}): string | null {
  const contact = input.customerEmail?.trim() || input.customerPhone?.trim();
  if (!contact) return null;
  return createHash("sha256").update(contact.toLowerCase()).digest("hex").slice(0, 32);
}

export function resolveOwnershipType(input: {
  customerUserId?: string | null;
  createdByContext: OrderCreatedContext;
  source: OrderSource;
}): OrderOwnershipType {
  if (input.source === "DELIVERY_PARTNER") return "PARTNER_SOURCED";
  if (input.createdByContext === "STAFF") return "STAFF_CREATED";
  if (input.customerUserId) return "CUSTOMER_ACCOUNT";
  return "GUEST";
}

export const ORDER_OWNERSHIP_RULES = {
  restaurantAccountability: "restaurantId is always accountable entity",
  customerOwnership: "customerUserId when logged-in customer placed order",
  guestOwnership: "guestKey hash from contact info when no account",
  staffOwnership: "createdByUserId + STAFF context for staff-created orders",
  assignedStaff: "assignedStaffUserId is operational responsibility not financial ownership",
  tableOwnership: "tableLabel links order to physical table context",
  reservationOwnership: "reservationId links order to booking",
  deviceOwnership: "deviceId links order to originating device",
  sourceOwnership: "source + sourceSessionId for attribution"
} as const;
