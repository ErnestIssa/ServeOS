import { normalizeToCanonicalSource } from "../orderSource/orderSourceResolution.js";
import type { CanonicalOrderSource } from "../orderSource/orderSourceTypes.js";
import type { EditWindowLevel, OrderEditActor, OrderEditOperationType } from "./orderEditTypes.js";
import type { OrderEditWindow } from "./orderEditTypes.js";

export type SourceEditRules = {
  customerLineEdits: boolean;
  staffLineEdits: boolean;
  partnerReconciliationRequired: boolean;
  maxCustomerWindow: EditWindowLevel;
};

export const SOURCE_EDIT_RULES: Record<CanonicalOrderSource, SourceEditRules> = {
  QR_ORDER: {
    customerLineEdits: true,
    staffLineEdits: true,
    partnerReconciliationRequired: false,
    maxCustomerWindow: "PRE_PAYMENT"
  },
  WALK_IN: {
    customerLineEdits: false,
    staffLineEdits: true,
    partnerReconciliationRequired: false,
    maxCustomerWindow: "TERMINAL"
  },
  STAFF_CREATED: {
    customerLineEdits: false,
    staffLineEdits: true,
    partnerReconciliationRequired: false,
    maxCustomerWindow: "TERMINAL"
  },
  PHONE_ORDER: {
    customerLineEdits: false,
    staffLineEdits: true,
    partnerReconciliationRequired: false,
    maxCustomerWindow: "TERMINAL"
  },
  RESERVATION_ORDER: {
    customerLineEdits: true,
    staffLineEdits: true,
    partnerReconciliationRequired: false,
    maxCustomerWindow: "POST_PAYMENT_PRE_KITCHEN"
  },
  DELIVERY_PARTNER: {
    customerLineEdits: false,
    staffLineEdits: false,
    partnerReconciliationRequired: true,
    maxCustomerWindow: "TERMINAL"
  }
};

const LINE_OPERATIONS: OrderEditOperationType[] = [
  "ADD_ITEM",
  "REMOVE_ITEM",
  "UPDATE_QUANTITY",
  "MODIFY_MODIFIERS",
  "PRICE_OVERRIDE"
];

const WINDOW_RANK: Record<EditWindowLevel, number> = {
  PRE_PAYMENT: 0,
  POST_PAYMENT_PRE_KITCHEN: 1,
  KITCHEN_RESTRICTED: 2,
  READY_LOCKED: 3,
  TERMINAL: 4
};

export function resolveSourceEditRules(source: string): SourceEditRules {
  const canonical = normalizeToCanonicalSource(source);
  return SOURCE_EDIT_RULES[canonical];
}

export function assertSourceEditAllowed(
  operation: OrderEditOperationType,
  actor: OrderEditActor,
  rules: SourceEditRules,
  window: OrderEditWindow
): void {
  const isStaff = actor.source === "STAFF" || actor.source === "ADMIN" || actor.source === "SYSTEM";
  const isCustomer = actor.isCustomer || actor.source === "CUSTOMER";

  if (isCustomer && WINDOW_RANK[window.level] > WINDOW_RANK[rules.maxCustomerWindow]) {
    throw Object.assign(new Error("source_customer_edit_window_closed"), { statusCode: 409 });
  }

  if (LINE_OPERATIONS.includes(operation)) {
    if (isCustomer && !rules.customerLineEdits) {
      throw Object.assign(new Error("source_customer_line_edit_blocked"), { statusCode: 403 });
    }
    if (isStaff && !rules.staffLineEdits) {
      throw Object.assign(new Error("source_partner_edit_restricted"), { statusCode: 409 });
    }
    if (!isStaff && !isCustomer) {
      throw Object.assign(new Error("source_edit_actor_forbidden"), { statusCode: 403 });
    }
  }
}

export const ORDER_EDIT_SOURCE_AUTHORITY = {
  rule: "source edit rules consult frozen source at placement via Order.source + sourceMetadata"
} as const;
