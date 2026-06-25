import type { OrderActorSource, OrderPaymentStatus } from "@prisma/client";
import type { OrderPlacementLineInput } from "../orders/orderTypes.js";

export type OrderEditOperationType =
  | "ADD_ITEM"
  | "REMOVE_ITEM"
  | "UPDATE_QUANTITY"
  | "MODIFY_MODIFIERS"
  | "UPDATE_NOTE"
  | "ADD_ALLERGY_NOTE"
  | "STAFF_CORRECTION"
  | "PRICE_OVERRIDE";

export type OrderEditRequestSource = "UI" | "STAFF_POS" | "SYSTEM";

export type OrderEditActor = {
  userId?: string | null;
  source: OrderActorSource;
  membershipRole?: string | null;
  permissions?: string[];
  isCustomer?: boolean;
};

export type OrderEditPayload =
  | { menuItemId: string; quantity: number; modifierOptionIds?: string[] }
  | { lineItemId: string }
  | { lineItemId: string; quantity: number }
  | { lineItemId: string; modifierOptionIds: string[] }
  | { note: string }
  | { allergyNote: string }
  | { correctionNote: string; lineItemId?: string; quantity?: number }
  | { lineItemId: string; unitPriceCents: number };

export type OrderEditRequest = {
  orderId: string;
  expectedVersion: number;
  operation: OrderEditOperationType;
  payload: OrderEditPayload;
  actor: OrderEditActor;
  reason?: string;
  requestSource?: OrderEditRequestSource;
  idempotencyKey?: string;
};

export type EditWindowLevel =
  | "PRE_PAYMENT"
  | "POST_PAYMENT_PRE_KITCHEN"
  | "KITCHEN_RESTRICTED"
  | "READY_LOCKED"
  | "TERMINAL";

export type OrderEditWindow = {
  level: EditWindowLevel;
  pricingLocked: boolean;
  kitchenStarted: boolean;
  completed: boolean;
};

export type OrderEditLineState = {
  id?: string;
  menuItemId: string;
  nameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  selectedModifiers: unknown;
  lineTotalCents: number;
  isNew?: boolean;
  isRemoved?: boolean;
  isModified?: boolean;
};

export type OrderEditPricingResult = {
  subtotalCents: number;
  taxCents: number;
  serviceFeeCents: number;
  discountCents: number;
  totalCents: number;
  previousTotalCents: number;
  paymentDeltaCents: number;
  requiresAdditionalCharge: boolean;
  requiresRefundDelta: boolean;
  nextPaymentStatus?: OrderPaymentStatus;
};

export type OrderEditResult = {
  ok: true;
  orderId: string;
  version: number;
  operation: OrderEditOperationType;
  pricing: OrderEditPricingResult;
  linesChanged: number;
  kdsNotifyRequired: boolean;
};

export type OrderEditValidationContext = {
  order: {
    id: string;
    restaurantId: string;
    customerUserId: string | null;
    source: string;
    sourceMetadata: unknown;
    status: string;
    paymentStatus: OrderPaymentStatus;
    note: string | null;
    discountCents: number;
    totalCents: number;
    version: number;
    pricingLockedAt: Date | null;
    kitchenStartedAt: Date | null;
    completedAt: Date | null;
  };
  lines: OrderEditLineState[];
  window: OrderEditWindow;
  actor: OrderEditActor;
  operation: OrderEditOperationType;
  payload: OrderEditPayload;
  reason?: string;
};

export function payloadAsLineInput(payload: OrderEditPayload): OrderPlacementLineInput | null {
  if ("menuItemId" in payload && "quantity" in payload && !("lineItemId" in payload)) {
    return {
      menuItemId: payload.menuItemId,
      quantity: payload.quantity,
      modifierOptionIds: payload.modifierOptionIds
    };
  }
  return null;
}
