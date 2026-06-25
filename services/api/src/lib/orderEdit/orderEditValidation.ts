import { deriveLockFlags } from "../orders/orderStatusMachine.js";
import { normalizeOrderStatus } from "../orders/orderTypes.js";
import type {
  EditWindowLevel,
  OrderEditOperationType,
  OrderEditValidationContext,
  OrderEditWindow
} from "./orderEditTypes.js";
import { resolveSourceEditRules, assertSourceEditAllowed } from "./orderEditSourceRules.js";
import { assertEditActorPermission } from "./orderEditPermissions.js";

function editError(code: string, statusCode: number): Error {
  return Object.assign(new Error(code), { statusCode });
}

const OPERATIONS_BY_WINDOW: Record<EditWindowLevel, OrderEditOperationType[]> = {
  PRE_PAYMENT: [
    "ADD_ITEM",
    "REMOVE_ITEM",
    "UPDATE_QUANTITY",
    "MODIFY_MODIFIERS",
    "UPDATE_NOTE",
    "ADD_ALLERGY_NOTE",
    "STAFF_CORRECTION",
    "PRICE_OVERRIDE"
  ],
  POST_PAYMENT_PRE_KITCHEN: [
    "ADD_ITEM",
    "UPDATE_NOTE",
    "ADD_ALLERGY_NOTE",
    "STAFF_CORRECTION",
    "PRICE_OVERRIDE"
  ],
  KITCHEN_RESTRICTED: ["UPDATE_NOTE", "ADD_ALLERGY_NOTE", "STAFF_CORRECTION"],
  READY_LOCKED: ["ADD_ALLERGY_NOTE", "STAFF_CORRECTION"],
  TERMINAL: []
};

export function resolveEditWindow(order: {
  status: string;
  pricingLockedAt: Date | null;
  kitchenStartedAt: Date | null;
  completedAt: Date | null;
  paymentStatus: string;
}): OrderEditWindow {
  const locks = deriveLockFlags(order);
  const canon = normalizeOrderStatus(order.status as never);

  if (["CANCELLED", "REJECTED", "REFUNDED", "PARTIALLY_REFUNDED", "ARCHIVED"].includes(canon)) {
    return { level: "TERMINAL", ...locks };
  }

  if (locks.completed || canon === "COMPLETED") {
    return { level: "TERMINAL", ...locks };
  }

  if (canon === "READY" || locks.kitchenStarted && canon === "READY") {
    return { level: "READY_LOCKED", ...locks };
  }

  if (locks.kitchenStarted || canon === "PREPARING") {
    return { level: "KITCHEN_RESTRICTED", ...locks };
  }

  if (locks.pricingLocked || order.paymentStatus === "PAID" || canon === "PAID" || canon === "ACCEPTED") {
    return { level: "POST_PAYMENT_PRE_KITCHEN", ...locks };
  }

  return { level: "PRE_PAYMENT", ...locks };
}

export function assertOperationAllowedInWindow(
  operation: OrderEditOperationType,
  window: OrderEditWindow
): void {
  const allowed = OPERATIONS_BY_WINDOW[window.level];
  if (!allowed.includes(operation)) {
    throw editError("edit_window_operation_blocked", 409);
  }
}

export function assertStaffReasonRequired(
  operation: OrderEditOperationType,
  actor: OrderEditValidationContext["actor"],
  reason?: string
): void {
  const staffOps: OrderEditOperationType[] = ["STAFF_CORRECTION", "PRICE_OVERRIDE"];
  const isStaff = actor.source === "STAFF" || actor.source === "ADMIN";
  if (staffOps.includes(operation) && isStaff && !reason?.trim()) {
    throw editError("edit_reason_required", 400);
  }
}

export function validateOrderEdit(ctx: OrderEditValidationContext): void {
  assertOperationAllowedInWindow(ctx.operation, ctx.window);
  assertEditActorPermission(ctx);
  assertStaffReasonRequired(ctx.operation, ctx.actor, ctx.reason);

  const sourceRules = resolveSourceEditRules(ctx.order.source);
  assertSourceEditAllowed(ctx.operation, ctx.actor, sourceRules, ctx.window);

  if (ctx.operation === "REMOVE_ITEM" && ctx.lines.filter((l) => !l.isRemoved).length <= 1) {
    throw editError("edit_last_line_blocked", 409);
  }

  if (ctx.operation === "UPDATE_QUANTITY" && "quantity" in ctx.payload && ctx.payload.quantity < 1) {
    throw editError("edit_invalid_quantity", 400);
  }
}

export const ORDER_EDIT_VALIDATION_RULES = {
  authority: "all edits validated before mutation",
  windows: OPERATIONS_BY_WINDOW
} as const;
