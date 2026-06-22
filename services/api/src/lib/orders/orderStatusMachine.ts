import type { OrderStatus } from "@prisma/client";
import {
  type CanonicalOrderStatus,
  normalizeOrderStatus,
  type OrderLockFlags,
  type OrderTransitionActor
} from "./orderTypes.js";
import type { OrderEngineTenantPolicy } from "./orderTenantPolicies.js";

/** Allowed transitions — service-level SSOT. Invalid transitions MUST be rejected here. */
export const ALLOWED_TRANSITIONS: Record<CanonicalOrderStatus, CanonicalOrderStatus[]> = {
  CREATED: ["PENDING_PAYMENT", "PAID", "ACCEPTED", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  REJECTED: [],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["REFUNDED", "PARTIALLY_REFUNDED", "ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  REFUNDED: ["ARCHIVED"],
  PARTIALLY_REFUNDED: ["REFUNDED", "ARCHIVED"],
  ARCHIVED: []
};

/** Kitchen happy-path advance (staff OCL quick actions). */
export const KITCHEN_ADVANCE: Partial<Record<CanonicalOrderStatus, CanonicalOrderStatus>> = {
  CREATED: "ACCEPTED",
  PAID: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED"
};

export const STATUS_LABELS: Record<CanonicalOrderStatus, string> = {
  CREATED: "Created",
  PENDING_PAYMENT: "Pending payment",
  PAID: "Paid",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  ARCHIVED: "Archived"
};

export function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  const fromCanon = normalizeOrderStatus(from);
  const toCanon = normalizeOrderStatus(to);
  if (fromCanon === toCanon) return false;
  return ALLOWED_TRANSITIONS[fromCanon]?.includes(toCanon) ?? false;
}

export function getKitchenAdvanceTarget(status: OrderStatus): CanonicalOrderStatus | null {
  const canon = normalizeOrderStatus(status);
  return KITCHEN_ADVANCE[canon] ?? null;
}

export function deriveLockFlags(order: {
  status: OrderStatus;
  pricingLockedAt: Date | null;
  kitchenStartedAt: Date | null;
  completedAt: Date | null;
}): OrderLockFlags {
  const canon = normalizeOrderStatus(order.status);
  return {
    pricingLocked: Boolean(order.pricingLockedAt) || ["PAID", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "REFUNDED", "PARTIALLY_REFUNDED", "ARCHIVED"].includes(canon),
    kitchenStarted: Boolean(order.kitchenStartedAt) || ["PREPARING", "READY", "COMPLETED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(canon),
    completed: Boolean(order.completedAt) || canon === "COMPLETED" || canon === "REFUNDED" || canon === "PARTIALLY_REFUNDED" || canon === "ARCHIVED"
  };
}

export function canEditLineItems(flags: OrderLockFlags): boolean {
  return !flags.pricingLocked && !flags.kitchenStarted && !flags.completed;
}

export function canApplyDiscount(flags: OrderLockFlags): boolean {
  return !flags.completed;
}

/** Role / permission gates for sensitive transitions. */
export function assertTransitionPermission(
  from: OrderStatus,
  to: OrderStatus,
  actor: OrderTransitionActor,
  tenant?: Pick<OrderEngineTenantPolicy, "cancelAfterAccepted" | "cancelAfterKitchenStart" | "refundRequiresManager" | "customerCancelBeforeAccepted">
): void {
  const fromCanon = normalizeOrderStatus(from);
  const toCanon = normalizeOrderStatus(to);
  const perms = new Set(actor.permissions ?? []);
  const role = actor.membershipRole ?? "";

  const isManager = role === "OWNER" || role === "MANAGER";
  const isKitchen = role === "KITCHEN" || perms.has("admin.live_orders") || perms.has("staff.kitchen");
  const isStaff = role === "STAFF" || role === "CASHIER" || isKitchen || isManager;

  if (toCanon === "REFUNDED" || toCanon === "PARTIALLY_REFUNDED") {
    const needsManager = tenant?.refundRequiresManager ?? true;
    if (needsManager && !isManager && actor.source !== "ADMIN" && actor.source !== "SYSTEM") {
      throw transitionError("refund_requires_manager", 403);
    }
    return;
  }

  if (toCanon === "ARCHIVED") {
    if (!isManager && actor.source !== "SYSTEM" && actor.source !== "ADMIN") {
      throw transitionError("archive_requires_manager", 403);
    }
    return;
  }

  if (toCanon === "CANCELLED") {
    if (fromCanon === "ACCEPTED" && !tenant?.cancelAfterAccepted && !isManager) {
      throw transitionError("cancel_after_accepted_not_allowed", 403);
    }
    if ((fromCanon === "PREPARING" || fromCanon === "READY") && !tenant?.cancelAfterKitchenStart && !isManager) {
      throw transitionError("cancel_after_kitchen_requires_manager", 403);
    } else if (actor.source === "CUSTOMER") {
      const customerOk = tenant?.customerCancelBeforeAccepted ?? true;
      if (!customerOk || !["CREATED", "PENDING_PAYMENT", "PAID"].includes(fromCanon)) {
        throw transitionError("customer_cancel_too_late", 403);
      }
    } else if (!isStaff && actor.source !== "SYSTEM") {
      throw transitionError("cancel_requires_staff", 403);
    }
    return;
  }

  if (toCanon === "ACCEPTED" || toCanon === "REJECTED") {
    if (!isStaff && actor.source !== "SYSTEM" && actor.source !== "PAYMENT") {
      throw transitionError("accept_requires_staff", 403);
    }
    return;
  }

  if (toCanon === "PREPARING" || toCanon === "READY") {
    if (!isKitchen && actor.source !== "SYSTEM") {
      throw transitionError("kitchen_status_requires_kitchen_role", 403);
    }
    return;
  }

  if (toCanon === "COMPLETED") {
    if (!isStaff && actor.source !== "SYSTEM") {
      throw transitionError("complete_requires_staff", 403);
    }
  }
}

export function transitionError(code: string, statusCode: number): Error {
  return Object.assign(new Error(code), { statusCode });
}

export function validateTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: OrderTransitionActor,
  locks: OrderLockFlags,
  tenant?: OrderEngineTenantPolicy
): void {
  if (!isTransitionAllowed(from, to)) {
    throw transitionError("invalid_order_transition", 400);
  }

  const toCanon = normalizeOrderStatus(to);
  if (locks.completed && !["REFUNDED", "PARTIALLY_REFUNDED", "ARCHIVED"].includes(toCanon)) {
    throw transitionError("order_completed_locked", 409);
  }

  if (locks.kitchenStarted && toCanon === "CANCELLED" && actor.membershipRole !== "OWNER" && actor.membershipRole !== "MANAGER") {
    throw transitionError("cancel_after_kitchen_requires_manager", 403);
  }

  assertTransitionPermission(from, to, actor, tenant);
}
