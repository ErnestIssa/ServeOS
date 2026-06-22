import type { PrismaClient } from "@prisma/client";
import { priceMenuItemLineInput, type ModifierSnap } from "../menuItemLinePricing.js";
import type { OrderPlacementLineInput } from "./orderTypes.js";

export type PricedOrderLine = {
  menuItemId: string;
  nameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  selectedModifiers: ModifierSnap[];
  lineTotalCents: number;
};

export async function priceOrderLines(
  prisma: PrismaClient,
  restaurantId: string,
  lines: OrderPlacementLineInput[]
): Promise<PricedOrderLine[]> {
  const priced: PricedOrderLine[] = [];
  for (const line of lines) {
    const row = await priceMenuItemLineInput(prisma, {
      restaurantId,
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      modifierOptionIds: line.modifierOptionIds
    });
    priced.push(row);
  }
  return priced;
}

/** Tax policy hook — returns cents; replace with venue tax rules later. */
export function computeOrderTaxCents(subtotalCents: number, _restaurantId: string): number {
  void _restaurantId;
  return 0;
}

export function computeOrderServiceFeeCents(subtotalCents: number, _restaurantId: string): number {
  void _restaurantId;
  return 0;
}

export function summarizeOrderTotals(input: {
  subtotalCents: number;
  taxCents: number;
  serviceFeeCents: number;
  discountCents: number;
}) {
  const totalCents = Math.max(0, input.subtotalCents + input.taxCents + input.serviceFeeCents - input.discountCents);
  return { ...input, totalCents };
}

export async function buildPricedOrderSnapshot(
  prisma: PrismaClient,
  restaurantId: string,
  lines: OrderPlacementLineInput[],
  discountCents = 0
) {
  const pricedLines = await priceOrderLines(prisma, restaurantId, lines);
  const subtotalCents = pricedLines.reduce((s, l) => s + l.lineTotalCents, 0);
  const taxCents = computeOrderTaxCents(subtotalCents, restaurantId);
  const serviceFeeCents = computeOrderServiceFeeCents(subtotalCents, restaurantId);
  const totals = summarizeOrderTotals({ subtotalCents, taxCents, serviceFeeCents, discountCents });
  return { pricedLines, totals };
}
