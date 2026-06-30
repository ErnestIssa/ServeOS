import type { OrderingPaymentMode, OrderingSessionStatus, OrderingSessionType, PrismaClient } from "@prisma/client";

const DEFAULT_SESSION_HOURS = 4;

export type OrderingSessionRow = {
  id: string;
  restaurantId: string;
  sessionType: OrderingSessionType;
  status: OrderingSessionStatus;
  entryMode: string | null;
  tableId: string | null;
  tableLabel: string | null;
  locationId: string | null;
  paymentMode: OrderingPaymentMode;
  expiresAt: string;
  lastActiveAt: string;
  menuUrl: string;
};

function sessionMenuPath(sessionId: string) {
  const base = process.env.CUSTOMER_WEB_URL?.trim() || process.env.API_PUBLIC_URL?.trim() || "";
  if (base) return `${base.replace(/\/$/, "")}/menu/session/${sessionId}`;
  return `/menu/session/${sessionId}`;
}

function expiresAtFromNow(hours = DEFAULT_SESSION_HOURS) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function createOrderingSession(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    sessionType?: OrderingSessionType;
    entryMode?: string;
    tableId?: string;
    tableLabel?: string;
    locationId?: string;
    paymentMode?: OrderingPaymentMode;
    ttlHours?: number;
  }
) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: params.restaurantId }, select: { id: true } });
  if (!restaurant) return { ok: false as const, error: "restaurant_not_found" };

  const session = await prisma.orderingSession.create({
    data: {
      restaurantId: params.restaurantId,
      sessionType: params.sessionType ?? "QR_SESSION",
      entryMode: params.entryMode?.trim() || null,
      tableId: params.tableId?.trim() || null,
      tableLabel: params.tableLabel?.trim() || null,
      locationId: params.locationId?.trim() || null,
      paymentMode: params.paymentMode ?? "PREPAY",
      expiresAt: expiresAtFromNow(params.ttlHours)
    }
  });

  return { ok: true as const, session: serializeSession(session) };
}

function serializeSession(row: {
  id: string;
  restaurantId: string;
  sessionType: OrderingSessionType;
  status: OrderingSessionStatus;
  entryMode: string | null;
  tableId: string | null;
  tableLabel: string | null;
  locationId: string | null;
  paymentMode: OrderingPaymentMode;
  expiresAt: Date;
  lastActiveAt: Date;
}): OrderingSessionRow {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    sessionType: row.sessionType,
    status: row.status,
    entryMode: row.entryMode,
    tableId: row.tableId,
    tableLabel: row.tableLabel,
    locationId: row.locationId,
    paymentMode: row.paymentMode,
    expiresAt: row.expiresAt.toISOString(),
    lastActiveAt: row.lastActiveAt.toISOString(),
    menuUrl: sessionMenuPath(row.id)
  };
}

export async function getOrderingSession(prisma: PrismaClient, sessionId: string) {
  const row = await prisma.orderingSession.findUnique({ where: { id: sessionId } });
  if (!row) return { ok: false as const, error: "session_not_found" };
  if (row.status !== "ACTIVE") return { ok: false as const, error: "session_inactive" };
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.orderingSession.update({ where: { id: row.id }, data: { status: "EXPIRED" } });
    return { ok: false as const, error: "session_expired" };
  }
  return { ok: true as const, session: serializeSession(row) };
}

export async function touchOrderingSession(prisma: PrismaClient, sessionId: string, ttlHours = DEFAULT_SESSION_HOURS) {
  const loaded = await getOrderingSession(prisma, sessionId);
  if (!loaded.ok) return loaded;
  const row = await prisma.orderingSession.update({
    where: { id: sessionId },
    data: { lastActiveAt: new Date(), expiresAt: expiresAtFromNow(ttlHours) }
  });
  return { ok: true as const, session: serializeSession(row) };
}

export async function assertOrderingSessionForRestaurant(
  prisma: PrismaClient,
  sessionId: string,
  restaurantId: string
) {
  const loaded = await getOrderingSession(prisma, sessionId);
  if (!loaded.ok) return loaded;
  if (loaded.session.restaurantId !== restaurantId) {
    return { ok: false as const, error: "session_restaurant_mismatch" };
  }
  await touchOrderingSession(prisma, sessionId);
  return loaded;
}

export function placementDefaultsFromSession(session: {
  paymentMode: OrderingPaymentMode;
  sessionType: OrderingSessionType;
  tableLabel: string | null;
}) {
  if (session.paymentMode === "PAY_AT_VENUE") {
    return {
      source: "WALK_IN" as const,
      sourceSessionType: mapSessionType(session.sessionType),
      initialStatus: "CREATED" as const,
      paymentStatus: "UNPAID" as const,
      tableLabel: session.tableLabel ?? undefined
    };
  }
  if (session.paymentMode === "HYBRID") {
    return {
      source: "QR_ORDER" as const,
      sourceSessionType: mapSessionType(session.sessionType),
      initialStatus: "PENDING_PAYMENT" as const,
      paymentStatus: "PENDING" as const,
      tableLabel: session.tableLabel ?? undefined
    };
  }
  return {
    source: "QR_ORDER" as const,
    sourceSessionType: mapSessionType(session.sessionType),
    initialStatus: "PENDING_PAYMENT" as const,
    paymentStatus: "PENDING" as const,
    tableLabel: session.tableLabel ?? undefined
  };
}

function mapSessionType(type: OrderingSessionType): string {
  switch (type) {
    case "QR_SESSION":
      return "QR";
    case "WALK_IN_SESSION":
      return "WALK_IN";
    case "LINK_SESSION":
      return "LINK";
    case "STAFF_ASSISTED_SESSION":
      return "STAFF_DEVICE";
    default:
      return "OTHER";
  }
}

export function mapOrderingSessionError(code: string): string {
  switch (code) {
    case "session_not_found":
      return "Ordering session not found.";
    case "session_expired":
      return "This ordering session has expired. Scan the QR code again.";
    case "session_inactive":
      return "This ordering session is no longer active.";
    case "session_restaurant_mismatch":
      return "Session does not belong to this venue.";
    case "restaurant_not_found":
      return "Venue not found.";
    default:
      return "Ordering session error.";
  }
}
