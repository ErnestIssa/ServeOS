import type { Prisma, PrismaClient } from "@prisma/client";
import { listMarkedMenuItemIdsForRestaurant } from "./customerMarkedMenuItems.js";
import { priceMenuItemLineInput, resolveQuickAddModifierOptionIds } from "./menuItemLinePricing.js";

export const CART_ORDER_NOTE_MAX_LEN = 2000;
export const CART_LINE_QTY_MAX = 99;

export type SerializedCartLine = {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  modifierOptionIds: string[];
  stale?: boolean;
};

export type SerializedCustomerCart = {
  cart: { id: string; restaurantId: string; updatedAt: string; orderNote: string | null } | null;
  lines: SerializedCartLine[];
  subtotalCents: number;
  lineCount: number;
  totalQuantity: number;
  orderNote: string;
  markedMenuItemIds: string[];
};

export type CartHttpError = Error & {
  statusCode: number;
  code: string;
  meta?: Record<string, unknown>;
};

function cartError(code: string, statusCode: number, meta?: Record<string, unknown>): CartHttpError {
  return Object.assign(new Error(code), { statusCode, code, meta });
}

export function isCartHttpError(err: unknown): err is CartHttpError {
  return err instanceof Error && typeof (err as CartHttpError).statusCode === "number";
}

export function cartRemoveConfirmationRequired(line: { id: string; name: string }): CartHttpError {
  return cartError("remove_confirmation_required", 409, {
    lineId: line.id,
    lineName: line.name,
    message: `Remove "${line.name}" from your cart?`
  });
}

function normalizeOrderNote(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, CART_ORDER_NOTE_MAX_LEN);
}

function modifierIdsJson(ids: string[]): Prisma.InputJsonValue {
  return ids as unknown as Prisma.InputJsonValue;
}

function readModifierIds(raw: unknown): string[] {
  return Array.isArray(raw) ? (raw as string[]) : [];
}

async function assertRestaurant(prisma: PrismaClient, restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw cartError("restaurant_not_found", 404);
  return restaurant;
}

async function getOwnedCartLine(prisma: PrismaClient, userId: string, lineId: string) {
  const line = await prisma.cartLine.findUnique({
    where: { id: lineId },
    include: {
      cart: true,
      menuItem: {
        select: {
          id: true,
          name: true,
          priceCents: true,
          isActive: true,
          category: { select: { restaurantId: true, isActive: true } }
        }
      }
    }
  });
  if (!line || line.cart.userId !== userId) {
    throw cartError("not_found", 404);
  }
  return line;
}

type CartDb = PrismaClient | Prisma.TransactionClient;

async function touchCart(db: CartDb, cartId: string) {
  await db.shoppingCart.update({
    where: { id: cartId },
    data: { updatedAt: new Date() }
  });
}

async function ensureCart(db: CartDb, userId: string, restaurantId: string) {
  return db.shoppingCart.upsert({
    where: { userId_restaurantId: { userId, restaurantId } },
    create: { userId, restaurantId, orderNote: null },
    update: {}
  });
}

async function priceLineForSerialize(
  prisma: PrismaClient,
  restaurantId: string,
  line: {
    id: string;
    menuItemId: string;
    quantity: number;
    modifierOptionIds: unknown;
    menuItem: {
      name: string;
      priceCents: number;
      isActive: boolean;
      category: { restaurantId: string; isActive: boolean };
    };
  }
): Promise<SerializedCartLine> {
  const rawMods = readModifierIds(line.modifierOptionIds);
  let stale = false;
  let name = line.menuItem.name;
  let unit = 0;
  let lineTotal = 0;
  try {
    const priced = await priceMenuItemLineInput(prisma, {
      restaurantId,
      menuItemId: line.menuItemId,
      quantity: 1,
      modifierOptionIds: rawMods
    });
    unit = priced.unitPriceCents;
    lineTotal = priced.unitPriceCents * line.quantity;
    name = priced.nameSnapshot;
  } catch {
    stale = true;
    unit = line.menuItem.priceCents;
    lineTotal = unit * line.quantity;
  }

  if (
    !line.menuItem.isActive ||
    !line.menuItem.category.isActive ||
    line.menuItem.category.restaurantId !== restaurantId
  ) {
    stale = true;
  }

  return {
    id: line.id,
    menuItemId: line.menuItemId,
    name,
    quantity: line.quantity,
    unitPriceCents: unit,
    lineTotalCents: lineTotal,
    modifierOptionIds: rawMods,
    ...(stale ? { stale: true } : {})
  };
}

export async function serializeCustomerCart(
  prisma: PrismaClient,
  userId: string,
  restaurantId: string
): Promise<SerializedCustomerCart> {
  await assertRestaurant(prisma, restaurantId);

  const cart = await prisma.shoppingCart.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    include: {
      lines: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              priceCents: true,
              isActive: true,
              category: { select: { restaurantId: true, isActive: true } }
            }
          }
        },
        orderBy: { id: "asc" }
      }
    }
  });

  const markedMenuItemIds = await listMarkedMenuItemIdsForRestaurant(prisma, userId, restaurantId);

  if (!cart) {
    return {
      cart: null,
      lines: [],
      subtotalCents: 0,
      lineCount: 0,
      totalQuantity: 0,
      orderNote: "",
      markedMenuItemIds
    };
  }

  const linesOut: SerializedCartLine[] = [];
  let subtotalCents = 0;
  let totalQuantity = 0;

  for (const line of cart.lines) {
    const row = await priceLineForSerialize(prisma, restaurantId, line);
    subtotalCents += row.lineTotalCents;
    totalQuantity += row.quantity;
    linesOut.push(row);
  }

  const orderNote = normalizeOrderNote(cart.orderNote);

  return {
    cart: {
      id: cart.id,
      restaurantId: cart.restaurantId,
      updatedAt: cart.updatedAt.toISOString(),
      orderNote: orderNote || null
    },
    lines: linesOut,
    subtotalCents,
    lineCount: linesOut.length,
    totalQuantity,
    orderNote,
    markedMenuItemIds
  };
}

export async function addItemToCustomerCart(
  prisma: PrismaClient,
  userId: string,
  input: {
    restaurantId: string;
    menuItemId: string;
    quantity?: number;
    modifierOptionIds?: string[];
  }
): Promise<SerializedCustomerCart> {
  const restaurantId = input.restaurantId.trim();
  const qty = Math.min(CART_LINE_QTY_MAX, Math.max(1, input.quantity ?? 1));
  await assertRestaurant(prisma, restaurantId);

  const inferredMods = await resolveQuickAddModifierOptionIds(
    prisma,
    restaurantId,
    input.menuItemId,
    input.modifierOptionIds
  );

  await priceMenuItemLineInput(prisma, {
    restaurantId,
    menuItemId: input.menuItemId,
    quantity: 1,
    modifierOptionIds: inferredMods
  });

  const modJson = modifierIdsJson(inferredMods);

  await prisma.$transaction(async (tx) => {
    const cart = await ensureCart(tx, userId, restaurantId);

    const existing = await tx.cartLine.findFirst({
      where: {
        cartId: cart.id,
        menuItemId: input.menuItemId,
        modifierOptionIds: { equals: modJson }
      }
    });

    if (existing) {
      const nextQty = Math.min(CART_LINE_QTY_MAX, existing.quantity + qty);
      await tx.cartLine.update({
        where: { id: existing.id },
        data: { quantity: nextQty }
      });
    } else {
      await tx.cartLine.create({
        data: {
          cartId: cart.id,
          menuItemId: input.menuItemId,
          quantity: qty,
          modifierOptionIds: modJson
        }
      });
    }

    await touchCart(tx, cart.id);
  });

  return serializeCustomerCart(prisma, userId, restaurantId);
}

export async function updateCustomerCartOrderNote(
  prisma: PrismaClient,
  userId: string,
  restaurantId: string,
  orderNote: string
): Promise<SerializedCustomerCart> {
  const rid = restaurantId.trim();
  await assertRestaurant(prisma, rid);
  const note = normalizeOrderNote(orderNote);

  await prisma.$transaction(async (tx) => {
    const cart = await ensureCart(tx, userId, rid);
    await tx.shoppingCart.update({
      where: { id: cart.id },
      data: { orderNote: note.length ? note : null }
    });
    await touchCart(tx, cart.id);
  });

  return serializeCustomerCart(prisma, userId, rid);
}

type LineMutationInput = {
  quantity?: number;
  delta?: number;
  confirmRemove?: boolean;
};

function resolveNextQuantity(current: number, input: LineMutationInput): number | "remove" {
  if (input.quantity !== undefined) {
    if (input.quantity <= 0) return "remove";
    return Math.min(CART_LINE_QTY_MAX, input.quantity);
  }
  if (input.delta !== undefined) {
    const next = current + input.delta;
    if (next <= 0) return "remove";
    return Math.min(CART_LINE_QTY_MAX, next);
  }
  throw cartError("quantity_or_delta_required", 400);
}

export async function mutateCustomerCartLine(
  prisma: PrismaClient,
  userId: string,
  lineId: string,
  input: LineMutationInput
): Promise<SerializedCustomerCart> {
  const line = await getOwnedCartLine(prisma, userId, lineId);
  const restaurantId = line.cart.restaurantId;
  const next = resolveNextQuantity(line.quantity, input);

  if (next === "remove") {
    if (!input.confirmRemove) {
      throw cartRemoveConfirmationRequired({ id: line.id, name: line.menuItem.name });
    }
    await prisma.$transaction(async (tx) => {
      await tx.cartLine.delete({ where: { id: lineId } });
      await touchCart(tx, line.cartId);
    });
    return serializeCustomerCart(prisma, userId, restaurantId);
  }

  if (next === line.quantity) {
    return serializeCustomerCart(prisma, userId, restaurantId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.cartLine.update({
      where: { id: lineId },
      data: { quantity: next }
    });
    await touchCart(tx, line.cartId);
  });

  return serializeCustomerCart(prisma, userId, restaurantId);
}

export async function removeCustomerCartLine(
  prisma: PrismaClient,
  userId: string,
  lineId: string,
  opts: { confirmed: boolean }
): Promise<SerializedCustomerCart> {
  const line = await getOwnedCartLine(prisma, userId, lineId);
  if (!opts.confirmed) {
    throw cartRemoveConfirmationRequired({ id: line.id, name: line.menuItem.name });
  }

  await prisma.$transaction(async (tx) => {
    await tx.cartLine.delete({ where: { id: lineId } });
    await touchCart(tx, line.cartId);
  });

  return serializeCustomerCart(prisma, userId, line.cart.restaurantId);
}
