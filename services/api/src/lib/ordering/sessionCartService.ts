import type { Prisma, PrismaClient } from "@prisma/client";
import {
  CART_LINE_QTY_MAX,
  CART_ORDER_NOTE_MAX_LEN,
  cartRemoveConfirmationRequired,
  isCartHttpError,
  type CartHttpError,
  type SerializedCartLine
} from "../customerCartService.js";
import { priceMenuItemLineInput, resolveQuickAddModifierOptionIds } from "../menuItemLinePricing.js";
import { getOrderingSession, touchOrderingSession } from "../ordering/orderingSessionService.js";

export { isCartHttpError, cartRemoveConfirmationRequired };
export type { CartHttpError, SerializedCartLine };

export type SerializedSessionCart = {
  cart: { id: string; orderingSessionId: string; restaurantId: string; updatedAt: string; orderNote: string | null } | null;
  lines: SerializedCartLine[];
  subtotalCents: number;
  lineCount: number;
  totalQuantity: number;
  orderNote: string;
};

function cartError(code: string, statusCode: number, meta?: Record<string, unknown>): CartHttpError {
  return Object.assign(new Error(code), { statusCode, code, meta });
}

function readModifierIds(raw: unknown): string[] {
  return Array.isArray(raw) ? (raw as string[]) : [];
}

function modifierIdsJson(ids: string[]): Prisma.InputJsonValue {
  return ids as unknown as Prisma.InputJsonValue;
}

function normalizeOrderNote(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, CART_ORDER_NOTE_MAX_LEN);
}

type CartDb = PrismaClient | Prisma.TransactionClient;

async function ensureSessionActive(prisma: PrismaClient, sessionId: string) {
  const session = await getOrderingSession(prisma, sessionId);
  if (!session.ok) throw cartError(session.error, 404);
  await touchOrderingSession(prisma, sessionId);
  return session.session;
}

async function ensureSessionCart(db: CartDb, orderingSessionId: string, restaurantId: string) {
  return db.sessionCart.upsert({
    where: { orderingSessionId },
    create: { orderingSessionId, restaurantId, orderNote: null },
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

export async function serializeSessionCart(prisma: PrismaClient, sessionId: string): Promise<SerializedSessionCart> {
  const session = await ensureSessionActive(prisma, sessionId);
  const cart = await prisma.sessionCart.findUnique({
    where: { orderingSessionId: sessionId },
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

  if (!cart) {
    return {
      cart: null,
      lines: [],
      subtotalCents: 0,
      lineCount: 0,
      totalQuantity: 0,
      orderNote: ""
    };
  }

  const linesOut: SerializedCartLine[] = [];
  let subtotalCents = 0;
  let totalQuantity = 0;

  for (const line of cart.lines) {
    const row = await priceLineForSerialize(prisma, session.restaurantId, line);
    subtotalCents += row.lineTotalCents;
    totalQuantity += row.quantity;
    linesOut.push(row);
  }

  const orderNote = normalizeOrderNote(cart.orderNote);

  return {
    cart: {
      id: cart.id,
      orderingSessionId: cart.orderingSessionId,
      restaurantId: cart.restaurantId,
      updatedAt: cart.updatedAt.toISOString(),
      orderNote: orderNote || null
    },
    lines: linesOut,
    subtotalCents,
    lineCount: linesOut.length,
    totalQuantity,
    orderNote
  };
}

export async function addItemToSessionCart(
  prisma: PrismaClient,
  sessionId: string,
  input: { menuItemId: string; quantity?: number; modifierOptionIds?: string[] }
) {
  const session = await ensureSessionActive(prisma, sessionId);
  const qty = Math.min(CART_LINE_QTY_MAX, Math.max(1, input.quantity ?? 1));

  const inferredMods = await resolveQuickAddModifierOptionIds(
    prisma,
    session.restaurantId,
    input.menuItemId,
    input.modifierOptionIds
  );

  await priceMenuItemLineInput(prisma, {
    restaurantId: session.restaurantId,
    menuItemId: input.menuItemId,
    quantity: 1,
    modifierOptionIds: inferredMods
  });

  const modJson = modifierIdsJson(inferredMods);

  await prisma.$transaction(async (tx) => {
    const cart = await ensureSessionCart(tx, sessionId, session.restaurantId);
    const existing = await tx.sessionCartLine.findFirst({
      where: {
        sessionCartId: cart.id,
        menuItemId: input.menuItemId,
        modifierOptionIds: { equals: modJson }
      }
    });
    if (existing) {
      await tx.sessionCartLine.update({
        where: { id: existing.id },
        data: { quantity: Math.min(CART_LINE_QTY_MAX, existing.quantity + qty) }
      });
    } else {
      await tx.sessionCartLine.create({
        data: {
          sessionCartId: cart.id,
          menuItemId: input.menuItemId,
          quantity: qty,
          modifierOptionIds: modJson
        }
      });
    }
    await tx.sessionCart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  });

  return serializeSessionCart(prisma, sessionId);
}

export async function updateSessionCartOrderNote(prisma: PrismaClient, sessionId: string, orderNote: string) {
  const session = await ensureSessionActive(prisma, sessionId);
  const note = normalizeOrderNote(orderNote);

  await prisma.$transaction(async (tx) => {
    const cart = await ensureSessionCart(tx, sessionId, session.restaurantId);
    await tx.sessionCart.update({
      where: { id: cart.id },
      data: { orderNote: note.length ? note : null, updatedAt: new Date() }
    });
  });

  return serializeSessionCart(prisma, sessionId);
}

type LineMutationInput = { quantity?: number; delta?: number; confirmRemove?: boolean };

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

async function getSessionCartLine(prisma: PrismaClient, sessionId: string, lineId: string) {
  const line = await prisma.sessionCartLine.findUnique({
    where: { id: lineId },
    include: {
      sessionCart: true,
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
  if (!line || line.sessionCart.orderingSessionId !== sessionId) {
    throw cartError("not_found", 404);
  }
  return line;
}

export async function mutateSessionCartLine(
  prisma: PrismaClient,
  sessionId: string,
  lineId: string,
  input: LineMutationInput
) {
  const line = await getSessionCartLine(prisma, sessionId, lineId);
  const next = resolveNextQuantity(line.quantity, input);

  if (next === "remove") {
    if (!input.confirmRemove) {
      throw cartRemoveConfirmationRequired({ id: line.id, name: line.menuItem.name });
    }
    await prisma.$transaction(async (tx) => {
      await tx.sessionCartLine.delete({ where: { id: lineId } });
      await tx.sessionCart.update({ where: { id: line.sessionCartId }, data: { updatedAt: new Date() } });
    });
    return serializeSessionCart(prisma, sessionId);
  }

  if (next === line.quantity) return serializeSessionCart(prisma, sessionId);

  await prisma.$transaction(async (tx) => {
    await tx.sessionCartLine.update({ where: { id: lineId }, data: { quantity: next } });
    await tx.sessionCart.update({ where: { id: line.sessionCartId }, data: { updatedAt: new Date() } });
  });

  return serializeSessionCart(prisma, sessionId);
}

export async function clearSessionCart(prisma: PrismaClient, sessionId: string) {
  await ensureSessionActive(prisma, sessionId);
  const cart = await prisma.sessionCart.findUnique({ where: { orderingSessionId: sessionId } });
  if (cart) {
    await prisma.sessionCartLine.deleteMany({ where: { sessionCartId: cart.id } });
    await prisma.sessionCart.update({ where: { id: cart.id }, data: { orderNote: null, updatedAt: new Date() } });
  }
  return serializeSessionCart(prisma, sessionId);
}

export async function loadSessionCartLinesForOrder(prisma: PrismaClient, sessionId: string, restaurantId: string) {
  const session = await getOrderingSession(prisma, sessionId);
  if (!session.ok) throw Object.assign(new Error(session.error), { statusCode: 400 });
  if (session.session.restaurantId !== restaurantId) {
    throw Object.assign(new Error("session_restaurant_mismatch"), { statusCode: 400 });
  }

  const cart = await prisma.sessionCart.findUnique({
    where: { orderingSessionId: sessionId },
    include: { lines: true }
  });
  if (!cart || cart.lines.length === 0) {
    throw Object.assign(new Error("cart_empty"), { statusCode: 400 });
  }

  return {
    orderNote: cart.orderNote?.trim() || undefined,
    lines: cart.lines.map((l) => ({
      menuItemId: l.menuItemId,
      quantity: l.quantity,
      modifierOptionIds: readModifierIds(l.modifierOptionIds)
    }))
  };
}
