import type { OrderEditOperationType, OrderEditValidationContext } from "./orderEditTypes.js";

function permissionError(code: string, statusCode: number): Error {
  return Object.assign(new Error(code), { statusCode });
}

const MANAGER_ROLES = new Set(["OWNER", "MANAGER"]);

export function isManagerActor(actor: OrderEditValidationContext["actor"]): boolean {
  return Boolean(actor.membershipRole && MANAGER_ROLES.has(actor.membershipRole));
}

export function isStaffActor(actor: OrderEditValidationContext["actor"]): boolean {
  return actor.source === "STAFF" || actor.source === "ADMIN" || actor.source === "SYSTEM";
}

export function assertEditActorPermission(ctx: OrderEditValidationContext): void {
  const { actor, operation, order, window } = ctx;
  const isCustomerOwner = actor.isCustomer && order.customerUserId === actor.userId;
  const isStaff = isStaffActor(actor);
  const isManager = isManagerActor(actor);

  if (operation === "PRICE_OVERRIDE" && !isManager) {
    throw permissionError("edit_price_override_requires_manager", 403);
  }

  if (operation === "STAFF_CORRECTION" && !isStaff) {
    throw permissionError("edit_staff_correction_requires_staff", 403);
  }

  if (window.level === "READY_LOCKED" && operation === "STAFF_CORRECTION" && !isManager) {
    throw permissionError("edit_ready_locked_requires_manager", 403);
  }

  if (window.level === "KITCHEN_RESTRICTED" && ["ADD_ITEM", "REMOVE_ITEM", "UPDATE_QUANTITY", "MODIFY_MODIFIERS"].includes(operation)) {
    if (!isManager) {
      throw permissionError("edit_kitchen_locked", 409);
    }
  }

  if (isCustomerOwner) {
    const customerOps: OrderEditOperationType[] = [
      "ADD_ITEM",
      "REMOVE_ITEM",
      "UPDATE_QUANTITY",
      "MODIFY_MODIFIERS",
      "UPDATE_NOTE"
    ];
    if (!customerOps.includes(operation)) {
      throw permissionError("customer_edit_scope_exceeded", 403);
    }
    return;
  }

  if (isStaff) return;

  if (actor.source === "SYSTEM" && operation === "STAFF_CORRECTION") return;

  throw permissionError("edit_ownership_forbidden", 403);
}

export const ORDER_EDIT_PERMISSION_MATRIX = {
  customer: ["ADD_ITEM", "REMOVE_ITEM", "UPDATE_QUANTITY", "MODIFY_MODIFIERS", "UPDATE_NOTE"],
  staff: ["all_except_PRICE_OVERRIDE"],
  manager: ["all_including_PRICE_OVERRIDE"],
  system: ["STAFF_CORRECTION_auto_only"]
} as const;
