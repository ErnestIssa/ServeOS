import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import type { DisplayNumberResetPolicy, InternalIdSchema, OrderIdentityPolicy } from "./orderIdentityTypes.js";

export const DEFAULT_ORDER_IDENTITY_POLICY: OrderIdentityPolicy = {
  displayNumberReset: "never",
  trackingCodePrefix: "ORD",
  internalIdSchema: "cuid"
};

const identityPolicySchema = z
  .object({
    displayNumberReset: z.enum(["never", "yearly", "monthly"]).optional(),
    trackingCodePrefix: z.string().min(2).max(8).optional(),
    internalIdSchema: z.enum(["cuid", "ulid"]).optional()
  })
  .partial();

export function mergeOrderIdentityPolicy(raw: unknown): OrderIdentityPolicy {
  const parsed = identityPolicySchema.safeParse(raw ?? {});
  const p = parsed.success ? parsed.data : {};
  return {
    displayNumberReset: p.displayNumberReset ?? DEFAULT_ORDER_IDENTITY_POLICY.displayNumberReset,
    trackingCodePrefix: (p.trackingCodePrefix ?? DEFAULT_ORDER_IDENTITY_POLICY.trackingCodePrefix).toUpperCase(),
    internalIdSchema: p.internalIdSchema ?? DEFAULT_ORDER_IDENTITY_POLICY.internalIdSchema
  };
}

export async function loadRestaurantIdentityPolicy(
  prisma: PrismaClient,
  restaurantId: string
): Promise<OrderIdentityPolicy> {
  const row = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { orderIdentityPolicy: true }
  });
  return mergeOrderIdentityPolicy(row?.orderIdentityPolicy);
}

/** Period key for tenant display numbers — reset policy never reuses numbers within same period bucket. */
export function computeDisplayPeriodKey(policy: DisplayNumberResetPolicy, at = new Date()): string {
  if (policy === "never") return "all";
  if (policy === "yearly") return String(at.getUTCFullYear());
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
