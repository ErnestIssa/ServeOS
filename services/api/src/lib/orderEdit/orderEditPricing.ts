import type { PrismaClient } from "@prisma/client";
import type { OrderPaymentStatus } from "@prisma/client";
import { priceMenuItemLineInput } from "../menuItemLinePricing.js";
import {
  computeOrderServiceFeeCents,
  computeOrderTaxCents,
  summarizeOrderTotals
} from "../orders/orderPricing.js";
import type { OrderEditLineState, OrderEditPricingResult } from "./orderEditTypes.js";
import type { OrderEditOperationType, OrderEditPayload } from "./orderEditTypes.js";
import { resolveFrozenContractFromMetadata } from "../orderSource/orderSourcePolicyVersioning.js";
import { assertSourcePaymentEvolution } from "../orderSource/orderSourcePaymentEvolution.js";

export async function priceNewLine(
  prisma: PrismaClient,
  restaurantId: string,
  input: { menuItemId: string; quantity: number; modifierOptionIds?: string[] }
): Promise<OrderEditLineState> {
  const priced = await priceMenuItemLineInput(prisma, {
    restaurantId,
    menuItemId: input.menuItemId,
    quantity: input.quantity,
    modifierOptionIds: input.modifierOptionIds
  });
  return {
    menuItemId: priced.menuItemId,
    nameSnapshot: priced.nameSnapshot,
    quantity: priced.quantity,
    unitPriceCents: priced.unitPriceCents,
    selectedModifiers: priced.selectedModifiers,
    lineTotalCents: priced.lineTotalCents,
    isNew: true
  };
}

export async function repriceExistingLine(
  prisma: PrismaClient,
  restaurantId: string,
  line: OrderEditLineState,
  input: { quantity?: number; modifierOptionIds?: string[]; unitPriceCents?: number }
): Promise<OrderEditLineState> {
  if (input.unitPriceCents != null) {
    const quantity = input.quantity ?? line.quantity;
    return {
      ...line,
      quantity,
      unitPriceCents: input.unitPriceCents,
      lineTotalCents: input.unitPriceCents * quantity,
      isModified: true
    };
  }

  const priced = await priceMenuItemLineInput(prisma, {
    restaurantId,
    menuItemId: line.menuItemId,
    quantity: input.quantity ?? line.quantity,
    modifierOptionIds: input.modifierOptionIds
  });

  return {
    ...line,
    nameSnapshot: priced.nameSnapshot,
    quantity: priced.quantity,
    unitPriceCents: priced.unitPriceCents,
    selectedModifiers: priced.selectedModifiers,
    lineTotalCents: priced.lineTotalCents,
    isModified: true
  };
}

export function summarizeLineTotals(lines: OrderEditLineState[], discountCents: number, restaurantId: string) {
  const active = lines.filter((l) => !l.isRemoved);
  const subtotalCents = active.reduce((s, l) => s + l.lineTotalCents, 0);
  const taxCents = computeOrderTaxCents(subtotalCents, restaurantId);
  const serviceFeeCents = computeOrderServiceFeeCents(subtotalCents, restaurantId);
  return summarizeOrderTotals({ subtotalCents, taxCents, serviceFeeCents, discountCents });
}

export function computePaymentDelta(
  previousTotalCents: number,
  nextTotalCents: number,
  paymentStatus: OrderPaymentStatus
): Pick<
  OrderEditPricingResult,
  "paymentDeltaCents" | "requiresAdditionalCharge" | "requiresRefundDelta" | "nextPaymentStatus"
> {
  const paymentDeltaCents = nextTotalCents - previousTotalCents;

  if (paymentStatus !== "PAID" && paymentStatus !== "PARTIAL_REFUND") {
    return {
      paymentDeltaCents,
      requiresAdditionalCharge: false,
      requiresRefundDelta: false
    };
  }

  if (paymentDeltaCents > 0) {
    return {
      paymentDeltaCents,
      requiresAdditionalCharge: true,
      requiresRefundDelta: false,
      nextPaymentStatus: "PENDING"
    };
  }

  if (paymentDeltaCents < 0) {
    return {
      paymentDeltaCents,
      requiresAdditionalCharge: false,
      requiresRefundDelta: true
    };
  }

  return { paymentDeltaCents: 0, requiresAdditionalCharge: false, requiresRefundDelta: false };
}

export function assertEditPaymentSafety(input: {
  operation: OrderEditOperationType;
  sourceMetadata: unknown;
  paymentStatus: OrderPaymentStatus;
  actorIsStaff: boolean;
}): void {
  const frozen = resolveFrozenContractFromMetadata(input.sourceMetadata);
  if (!frozen) return;

  if (input.operation === "ADD_ITEM" && input.actorIsStaff) {
    assertSourcePaymentEvolution("staff_line_added", {
      frozenPolicy: frozen,
      paymentStatus: input.paymentStatus
    });
  }

  if (input.operation === "PRICE_OVERRIDE") {
    assertSourcePaymentEvolution("staff_line_added", {
      frozenPolicy: frozen,
      paymentStatus: input.paymentStatus
    });
  }
}

export async function applyEditToLines(
  prisma: PrismaClient,
  restaurantId: string,
  lines: OrderEditLineState[],
  operation: OrderEditOperationType,
  payload: OrderEditPayload
): Promise<OrderEditLineState[]> {
  const next = lines.map((l) => ({ ...l }));

  switch (operation) {
    case "ADD_ITEM": {
      if (!("menuItemId" in payload)) throw new Error("edit_payload_invalid");
      const row = await priceNewLine(prisma, restaurantId, payload);
      next.push(row);
      return next;
    }
    case "REMOVE_ITEM": {
      if (!("lineItemId" in payload)) throw new Error("edit_payload_invalid");
      return next.map((l) => (l.id === payload.lineItemId ? { ...l, isRemoved: true } : l));
    }
    case "UPDATE_QUANTITY": {
      if (!("lineItemId" in payload) || !("quantity" in payload)) throw new Error("edit_payload_invalid");
      const idx = next.findIndex((l) => l.id === payload.lineItemId);
      if (idx < 0) throw Object.assign(new Error("edit_line_not_found"), { statusCode: 404 });
      next[idx] = await repriceExistingLine(prisma, restaurantId, next[idx]!, { quantity: payload.quantity });
      return next;
    }
    case "MODIFY_MODIFIERS": {
      if (!("lineItemId" in payload) || !("modifierOptionIds" in payload)) throw new Error("edit_payload_invalid");
      const idx = next.findIndex((l) => l.id === payload.lineItemId);
      if (idx < 0) throw Object.assign(new Error("edit_line_not_found"), { statusCode: 404 });
      next[idx] = await repriceExistingLine(prisma, restaurantId, next[idx]!, {
        modifierOptionIds: payload.modifierOptionIds
      });
      return next;
    }
    case "PRICE_OVERRIDE": {
      if (!("lineItemId" in payload) || !("unitPriceCents" in payload)) throw new Error("edit_payload_invalid");
      const idx = next.findIndex((l) => l.id === payload.lineItemId);
      if (idx < 0) throw Object.assign(new Error("edit_line_not_found"), { statusCode: 404 });
      next[idx] = await repriceExistingLine(prisma, restaurantId, next[idx]!, {
        unitPriceCents: payload.unitPriceCents
      });
      return next;
    }
    default:
      return next;
  }
}

export function resolveNoteAfterEdit(
  currentNote: string | null,
  operation: OrderEditOperationType,
  payload: OrderEditPayload
): string | null {
  if (operation === "UPDATE_NOTE" && "note" in payload) return payload.note.trim() || null;
  if (operation === "ADD_ALLERGY_NOTE" && "allergyNote" in payload) {
    const tag = `[ALLERGY] ${payload.allergyNote.trim()}`;
    return currentNote ? `${currentNote}\n${tag}` : tag;
  }
  if (operation === "STAFF_CORRECTION" && "correctionNote" in payload) {
    const tag = `[CORRECTION] ${payload.correctionNote.trim()}`;
    return currentNote ? `${currentNote}\n${tag}` : tag;
  }
  return currentNote;
}
