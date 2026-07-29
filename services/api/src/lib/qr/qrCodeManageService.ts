import { randomBytes } from "node:crypto";
import type {
  OrderingPaymentMode,
  PrismaClient,
  QrCodeStatus,
  QrCodeType,
  QrExperience
} from "@prisma/client";

const PUBLIC_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export type QrCodeRow = {
  id: string;
  restaurantId: string;
  publicCode: string;
  name: string;
  type: QrCodeType;
  status: QrCodeStatus;
  experience: QrExperience;
  locationLabel: string | null;
  areaLabel: string | null;
  tableLabel: string | null;
  tableId: string | null;
  seatCount: number | null;
  paymentMode: OrderingPaymentMode;
  menuId: string | null;
  menuName: string | null;
  allowOrdering: boolean;
  orderingPaused: boolean;
  sessionTtlHours: number | null;
  description: string | null;
  headline: string | null;
  showRestaurantLogo: boolean;
  showServeosBranding: boolean;
  createdByUserId: string | null;
  scanCount: number;
  orderCount: number;
  lastUsedAt: string | null;
  deactivatedAt: string | null;
  archivedAt: string | null;
  replacedById: string | null;
  replacesId: string | null;
  publicUrl: string;
  qrImageUrl: string;
  pngDownloadUrl: string;
  svgDownloadUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type QrDashboardStats = {
  activeCount: number;
  tableCount: number;
  scansToday: number;
  ordersToday: number;
  revenueTodayCents: number;
  totalScans: number;
  totalOrders: number;
};

export type QrManageActionDescriptor = {
  id: string;
  label: string;
  description?: string;
  danger?: boolean;
};

export type QrManageContext = {
  targets: QrCodeRow[];
  actions: QrManageActionDescriptor[];
};

export type QrAnalyticsSummary = {
  scans: number;
  orders: number;
  revenueCents: number;
  conversionRate: number;
  lastOrderAt: string | null;
};

export type BulkQrCodePatch = {
  status?: "ACTIVE" | "INACTIVE";
  orderingPaused?: boolean;
  menuId?: string | null;
  paymentMode?: OrderingPaymentMode;
  locationLabel?: string | null;
  areaLabel?: string | null;
};

function customerWebBase() {
  return (process.env.CUSTOMER_WEB_URL?.trim() || process.env.API_PUBLIC_URL?.trim() || "").replace(/\/$/, "");
}

export function buildQrPublicUrl(publicCode: string) {
  const base = customerWebBase();
  if (base) return `${base}/q/${publicCode}`;
  return `/q/${publicCode}`;
}

export function buildQrArtifactUrls(publicCode: string) {
  const publicUrl = buildQrPublicUrl(publicCode);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(publicUrl)}`;
  return {
    publicUrl,
    qrImageUrl,
    pngDownloadUrl: `${qrImageUrl}&format=png`,
    svgDownloadUrl: `${qrImageUrl}&format=svg`
  };
}

export function generateQrPublicCode(length = 8) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PUBLIC_CODE_ALPHABET[bytes[i]! % PUBLIC_CODE_ALPHABET.length];
  }
  return out;
}

function serializeQr(
  row: {
    id: string;
    restaurantId: string;
    publicCode: string;
    name: string;
    type: QrCodeType;
    status: QrCodeStatus;
    experience: QrExperience;
    locationLabel: string | null;
    areaLabel: string | null;
    tableLabel: string | null;
    tableId: string | null;
    seatCount: number | null;
    paymentMode: OrderingPaymentMode;
    menuId: string | null;
    allowOrdering: boolean;
    orderingPaused: boolean;
    sessionTtlHours: number | null;
    description: string | null;
    headline: string | null;
    showRestaurantLogo: boolean;
    showServeosBranding: boolean;
    createdByUserId: string | null;
    scanCount: number;
    orderCount: number;
    lastUsedAt: Date | null;
    deactivatedAt: Date | null;
    archivedAt: Date | null;
    replacedById: string | null;
    replacesId: string | null;
    createdAt: Date;
    updatedAt: Date;
    menu?: { name: string } | null;
  }
): QrCodeRow {
  const artifacts = buildQrArtifactUrls(row.publicCode);
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    publicCode: row.publicCode,
    name: row.name,
    type: row.type,
    status: row.status,
    experience: row.experience,
    locationLabel: row.locationLabel,
    areaLabel: row.areaLabel,
    tableLabel: row.tableLabel,
    tableId: row.tableId,
    seatCount: row.seatCount,
    paymentMode: row.paymentMode,
    menuId: row.menuId,
    menuName: row.menu?.name ?? null,
    allowOrdering: row.allowOrdering,
    orderingPaused: row.orderingPaused,
    sessionTtlHours: row.sessionTtlHours,
    description: row.description,
    headline: row.headline,
    showRestaurantLogo: row.showRestaurantLogo,
    showServeosBranding: row.showServeosBranding,
    createdByUserId: row.createdByUserId,
    scanCount: row.scanCount,
    orderCount: row.orderCount,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    replacedById: row.replacedById,
    replacesId: row.replacesId,
    ...artifacts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

const qrInclude = { menu: { select: { name: true } } } as const;

async function allocatePublicCode(prisma: PrismaClient) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const publicCode = generateQrPublicCode();
    const existing = await prisma.qrCode.findUnique({ where: { publicCode }, select: { id: true } });
    if (!existing) return publicCode;
  }
  throw Object.assign(new Error("qr_public_code_exhausted"), { statusCode: 500 });
}

function defaultExperienceForType(type: QrCodeType): QrExperience {
  switch (type) {
    case "FEEDBACK":
      return "FEEDBACK";
    case "MARKETING":
      return "PROMOTION";
    case "STAFF":
      return "ORDERING";
    case "MENU":
      return "MENU_BROWSE";
    case "TAKEAWAY":
    case "TABLE":
    default:
      return "ORDERING";
  }
}

function defaultPaymentForType(type: QrCodeType): OrderingPaymentMode {
  if (type === "TAKEAWAY") return "PREPAY";
  return "PAY_AT_VENUE";
}

function assertMutableStatus(status: QrCodeStatus) {
  if (status === "ROTATED") return "qr_rotated" as const;
  if (status === "ARCHIVED") return "qr_archived" as const;
  return null;
}

export type CreateQrCodeInput = {
  restaurantId: string;
  name: string;
  type: QrCodeType;
  experience?: QrExperience;
  locationLabel?: string | null;
  areaLabel?: string | null;
  tableLabel?: string | null;
  tableId?: string | null;
  seatCount?: number | null;
  paymentMode?: OrderingPaymentMode;
  menuId?: string | null;
  allowOrdering?: boolean;
  orderingPaused?: boolean;
  sessionTtlHours?: number | null;
  description?: string | null;
  headline?: string | null;
  showRestaurantLogo?: boolean;
  showServeosBranding?: boolean;
  createdByUserId?: string | null;
};

export async function createQrCode(prisma: PrismaClient, input: CreateQrCodeInput) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: input.restaurantId },
    select: { id: true }
  });
  if (!restaurant) return { ok: false as const, error: "restaurant_not_found" as const };

  if (input.menuId) {
    const menu = await prisma.menu.findFirst({
      where: { id: input.menuId, restaurantId: input.restaurantId },
      select: { id: true }
    });
    if (!menu) return { ok: false as const, error: "menu_not_found" as const };
  }

  const type = input.type;
  const experience = input.experience ?? defaultExperienceForType(type);
  const allowOrdering =
    input.allowOrdering ?? (experience === "ORDERING" || experience === "MENU_BROWSE");
  const paymentMode = input.paymentMode ?? defaultPaymentForType(type);
  const publicCode = await allocatePublicCode(prisma);

  const row = await prisma.qrCode.create({
    data: {
      restaurantId: input.restaurantId,
      publicCode,
      name: input.name.trim(),
      type,
      experience,
      locationLabel: input.locationLabel?.trim() || null,
      areaLabel: input.areaLabel?.trim() || null,
      tableLabel: input.tableLabel?.trim() || null,
      tableId: input.tableId?.trim() || null,
      seatCount: input.seatCount ?? null,
      paymentMode,
      menuId: input.menuId ?? null,
      allowOrdering,
      orderingPaused: input.orderingPaused ?? false,
      sessionTtlHours: input.sessionTtlHours ?? null,
      description: input.description?.trim() || null,
      headline: input.headline?.trim() || "Scan to order",
      showRestaurantLogo: input.showRestaurantLogo ?? true,
      showServeosBranding: input.showServeosBranding ?? false,
      createdByUserId: input.createdByUserId ?? null
    },
    include: qrInclude
  });

  return { ok: true as const, qr: serializeQr(row) };
}

export type UpdateQrCodeInput = {
  name?: string;
  experience?: QrExperience;
  locationLabel?: string | null;
  areaLabel?: string | null;
  tableLabel?: string | null;
  tableId?: string | null;
  seatCount?: number | null;
  paymentMode?: OrderingPaymentMode;
  menuId?: string | null;
  allowOrdering?: boolean;
  orderingPaused?: boolean;
  sessionTtlHours?: number | null;
  description?: string | null;
  headline?: string | null;
  showRestaurantLogo?: boolean;
  showServeosBranding?: boolean;
};

export async function updateQrCode(
  prisma: PrismaClient,
  restaurantId: string,
  qrCodeId: string,
  input: UpdateQrCodeInput
) {
  const existing = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId },
    select: { id: true, status: true }
  });
  if (!existing) return { ok: false as const, error: "qr_not_found" as const };
  const blocked = assertMutableStatus(existing.status);
  if (blocked) return { ok: false as const, error: blocked };

  if (input.menuId) {
    const menu = await prisma.menu.findFirst({
      where: { id: input.menuId, restaurantId },
      select: { id: true }
    });
    if (!menu) return { ok: false as const, error: "menu_not_found" as const };
  }

  const row = await prisma.qrCode.update({
    where: { id: qrCodeId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.experience !== undefined ? { experience: input.experience } : {}),
      ...(input.locationLabel !== undefined ? { locationLabel: input.locationLabel?.trim() || null } : {}),
      ...(input.areaLabel !== undefined ? { areaLabel: input.areaLabel?.trim() || null } : {}),
      ...(input.tableLabel !== undefined ? { tableLabel: input.tableLabel?.trim() || null } : {}),
      ...(input.tableId !== undefined ? { tableId: input.tableId?.trim() || null } : {}),
      ...(input.seatCount !== undefined ? { seatCount: input.seatCount } : {}),
      ...(input.paymentMode !== undefined ? { paymentMode: input.paymentMode } : {}),
      ...(input.menuId !== undefined ? { menuId: input.menuId } : {}),
      ...(input.allowOrdering !== undefined ? { allowOrdering: input.allowOrdering } : {}),
      ...(input.orderingPaused !== undefined ? { orderingPaused: input.orderingPaused } : {}),
      ...(input.sessionTtlHours !== undefined ? { sessionTtlHours: input.sessionTtlHours } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.headline !== undefined ? { headline: input.headline?.trim() || null } : {}),
      ...(input.showRestaurantLogo !== undefined ? { showRestaurantLogo: input.showRestaurantLogo } : {}),
      ...(input.showServeosBranding !== undefined ? { showServeosBranding: input.showServeosBranding } : {})
    },
    include: qrInclude
  });

  return { ok: true as const, qr: serializeQr(row) };
}

export async function listQrCodes(
  prisma: PrismaClient,
  restaurantId: string,
  opts?: { status?: QrCodeStatus; type?: QrCodeType; q?: string }
) {
  const rows = await prisma.qrCode.findMany({
    where: {
      restaurantId,
      ...(opts?.status ? { status: opts.status } : { status: { notIn: ["ROTATED", "ARCHIVED"] } }),
      ...(opts?.type ? { type: opts.type } : {}),
      ...(opts?.q?.trim()
        ? {
            OR: [
              { name: { contains: opts.q.trim(), mode: "insensitive" } },
              { tableLabel: { contains: opts.q.trim(), mode: "insensitive" } },
              { areaLabel: { contains: opts.q.trim(), mode: "insensitive" } },
              { locationLabel: { contains: opts.q.trim(), mode: "insensitive" } },
              { publicCode: { contains: opts.q.trim(), mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: qrInclude,
    orderBy: [{ status: "asc" }, { name: "asc" }]
  });
  return rows.map(serializeQr);
}

export async function getQrCode(prisma: PrismaClient, restaurantId: string, qrCodeId: string) {
  const row = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId },
    include: qrInclude
  });
  if (!row) return { ok: false as const, error: "qr_not_found" as const };
  return { ok: true as const, qr: serializeQr(row) };
}

export async function deactivateQrCode(prisma: PrismaClient, restaurantId: string, qrCodeId: string) {
  const existing = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId },
    select: { id: true, status: true }
  });
  if (!existing) return { ok: false as const, error: "qr_not_found" as const };
  const blocked = assertMutableStatus(existing.status);
  if (blocked) return { ok: false as const, error: blocked };

  const row = await prisma.qrCode.update({
    where: { id: qrCodeId },
    data: { status: "INACTIVE", deactivatedAt: new Date() },
    include: qrInclude
  });
  return { ok: true as const, qr: serializeQr(row) };
}

export async function reactivateQrCode(prisma: PrismaClient, restaurantId: string, qrCodeId: string) {
  const existing = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId },
    select: { id: true, status: true }
  });
  if (!existing) return { ok: false as const, error: "qr_not_found" as const };
  if (existing.status === "ROTATED") return { ok: false as const, error: "qr_rotated" as const };
  if (existing.status === "ARCHIVED") return { ok: false as const, error: "qr_archived" as const };

  const row = await prisma.qrCode.update({
    where: { id: qrCodeId },
    data: { status: "ACTIVE", deactivatedAt: null },
    include: qrInclude
  });
  return { ok: true as const, qr: serializeQr(row) };
}

export async function archiveQrCode(prisma: PrismaClient, restaurantId: string, qrCodeId: string) {
  const existing = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId },
    select: { id: true, status: true }
  });
  if (!existing) return { ok: false as const, error: "qr_not_found" as const };
  if (existing.status === "ROTATED") return { ok: false as const, error: "qr_rotated" as const };
  if (existing.status === "ARCHIVED") return { ok: false as const, error: "qr_archived" as const };

  const row = await prisma.qrCode.update({
    where: { id: qrCodeId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
    include: qrInclude
  });
  return { ok: true as const, qr: serializeQr(row) };
}

export async function restoreQrCode(prisma: PrismaClient, restaurantId: string, qrCodeId: string) {
  const existing = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId },
    select: { id: true, status: true }
  });
  if (!existing) return { ok: false as const, error: "qr_not_found" as const };
  if (existing.status !== "ARCHIVED") {
    return { ok: false as const, error: "qr_not_archived" as const };
  }

  const row = await prisma.qrCode.update({
    where: { id: qrCodeId },
    data: { status: "ACTIVE", archivedAt: null, deactivatedAt: null },
    include: qrInclude
  });
  return { ok: true as const, qr: serializeQr(row) };
}

/** Permanently remove an archived QR identity. Orders/sessions keep history via SetNull FKs. */
export async function deleteQrCode(prisma: PrismaClient, restaurantId: string, qrCodeId: string) {
  const existing = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId },
    select: { id: true, status: true }
  });
  if (!existing) return { ok: false as const, error: "qr_not_found" as const };
  if (existing.status !== "ARCHIVED") {
    return { ok: false as const, error: "qr_not_archived" as const };
  }

  await prisma.qrCode.delete({ where: { id: qrCodeId } });
  return { ok: true as const };
}

export async function pauseQrOrdering(prisma: PrismaClient, restaurantId: string, qrCodeId: string) {
  const existing = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId },
    select: { id: true, status: true, orderingPaused: true }
  });
  if (!existing) return { ok: false as const, error: "qr_not_found" as const };
  const blocked = assertMutableStatus(existing.status);
  if (blocked) return { ok: false as const, error: blocked };

  const row = await prisma.qrCode.update({
    where: { id: qrCodeId },
    data: { orderingPaused: true },
    include: qrInclude
  });
  return { ok: true as const, qr: serializeQr(row) };
}

export async function resumeQrOrdering(prisma: PrismaClient, restaurantId: string, qrCodeId: string) {
  const existing = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId },
    select: { id: true, status: true }
  });
  if (!existing) return { ok: false as const, error: "qr_not_found" as const };
  const blocked = assertMutableStatus(existing.status);
  if (blocked) return { ok: false as const, error: blocked };

  const row = await prisma.qrCode.update({
    where: { id: qrCodeId },
    data: { orderingPaused: false },
    include: qrInclude
  });
  return { ok: true as const, qr: serializeQr(row) };
}

export async function bulkUpdateQrCodes(
  prisma: PrismaClient,
  restaurantId: string,
  ids: string[],
  patch: BulkQrCodePatch
) {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { ok: false as const, error: "qr_ids_required" as const };

  if (patch.menuId) {
    const menu = await prisma.menu.findFirst({
      where: { id: patch.menuId, restaurantId },
      select: { id: true }
    });
    if (!menu) return { ok: false as const, error: "menu_not_found" as const };
  }

  const existing = await prisma.qrCode.findMany({
    where: { restaurantId, id: { in: uniqueIds } },
    select: { id: true, status: true }
  });
  if (existing.length !== uniqueIds.length) {
    return { ok: false as const, error: "qr_not_found" as const };
  }
  if (existing.some((row) => row.status === "ROTATED" || row.status === "ARCHIVED")) {
    return { ok: false as const, error: "qr_not_mutable" as const };
  }

  const data: {
    status?: "ACTIVE" | "INACTIVE";
    deactivatedAt?: Date | null;
    orderingPaused?: boolean;
    menuId?: string | null;
    paymentMode?: OrderingPaymentMode;
    locationLabel?: string | null;
    areaLabel?: string | null;
  } = {};

  if (patch.status === "ACTIVE") {
    data.status = "ACTIVE";
    data.deactivatedAt = null;
  } else if (patch.status === "INACTIVE") {
    data.status = "INACTIVE";
    data.deactivatedAt = new Date();
  }
  if (patch.orderingPaused !== undefined) data.orderingPaused = patch.orderingPaused;
  if (patch.menuId !== undefined) data.menuId = patch.menuId;
  if (patch.paymentMode !== undefined) data.paymentMode = patch.paymentMode;
  if (patch.locationLabel !== undefined) data.locationLabel = patch.locationLabel?.trim() || null;
  if (patch.areaLabel !== undefined) data.areaLabel = patch.areaLabel?.trim() || null;

  if (Object.keys(data).length === 0) {
    const items = await listQrCodesByIds(prisma, restaurantId, uniqueIds);
    return { ok: true as const, items };
  }

  await prisma.qrCode.updateMany({
    where: { restaurantId, id: { in: uniqueIds } },
    data
  });

  const items = await listQrCodesByIds(prisma, restaurantId, uniqueIds);
  return { ok: true as const, items };
}

async function listQrCodesByIds(prisma: PrismaClient, restaurantId: string, ids: string[]) {
  const rows = await prisma.qrCode.findMany({
    where: { restaurantId, id: { in: ids } },
    include: qrInclude,
    orderBy: [{ status: "asc" }, { name: "asc" }]
  });
  return rows.map(serializeQr);
}

function buildQrManageActions(targets: QrCodeRow[]): QrManageActionDescriptor[] {
  const actions: QrManageActionDescriptor[] = [];
  if (targets.length === 0) return actions;

  if (targets.length === 1) {
    const qr = targets[0]!;
    actions.push(
      { id: "edit-settings", label: "Edit QR", description: "General, destination, and ordering" },
      { id: "download-assets", label: "Download", description: "PNG or SVG" },
      { id: "view-analytics", label: "View analytics" }
    );

    if (qr.status === "INACTIVE") {
      actions.push({ id: "activate", label: "Activate" });
    }

    if (qr.status !== "ROTATED" && qr.status !== "ARCHIVED") {
      if (qr.orderingPaused) {
        actions.push({ id: "resume-ordering", label: "Resume ordering" });
      }
      actions.push({ id: "rotate", label: "Rotate", description: "Invalidate printed URL", danger: true });
      actions.push({ id: "archive", label: "Archive", danger: true });
    }

    return actions;
  }

  const mutable = targets.filter((t) => t.status !== "ROTATED" && t.status !== "ARCHIVED");
  if (mutable.length === 0) return actions;

  if (mutable.some((t) => t.status === "INACTIVE")) {
    actions.push({ id: "activate", label: "Activate" });
  }
  if (mutable.some((t) => t.status === "ACTIVE")) {
    actions.push({ id: "deactivate", label: "Deactivate" });
  }
  if (mutable.some((t) => !t.orderingPaused)) {
    actions.push({ id: "pause-ordering", label: "Pause ordering" });
  }
  if (mutable.some((t) => t.orderingPaused)) {
    actions.push({ id: "resume-ordering", label: "Resume ordering" });
  }
  actions.push({
    id: "assign-menu",
    label: "Assign menu",
    description: "Assign menu — set in panel"
  });
  actions.push({
    id: "assign-payment",
    label: "Assign payment",
    description: "Set payment mode for selected codes"
  });
  actions.push({ id: "archive", label: "Archive", danger: true });

  return actions;
}

export async function getQrManageContext(
  prisma: PrismaClient,
  restaurantId: string,
  qrIds?: string[]
): Promise<QrManageContext> {
  const requestedIds = qrIds?.map((id) => id.trim()).filter(Boolean) ?? [];

  let targets: QrCodeRow[];
  if (requestedIds.length > 0) {
    targets = await listQrCodesByIds(prisma, restaurantId, requestedIds);
  } else {
    targets = await listQrCodes(prisma, restaurantId);
  }

  return {
    targets,
    actions: buildQrManageActions(targets)
  };
}

export async function getQrAnalyticsSummary(
  prisma: PrismaClient,
  restaurantId: string,
  qrCodeId: string
): Promise<{ ok: true; summary: QrAnalyticsSummary } | { ok: false; error: "qr_not_found" }> {
  const qr = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId },
    select: { id: true, scanCount: true, orderCount: true }
  });
  if (!qr) return { ok: false, error: "qr_not_found" };

  const [orderAgg, lastOrder] = await Promise.all([
    prisma.order.aggregate({
      where: { restaurantId, qrCodeId },
      _sum: { totalCents: true },
      _count: { _all: true }
    }),
    prisma.order.findFirst({
      where: { restaurantId, qrCodeId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    })
  ]);

  const scans = qr.scanCount;
  const orders = orderAgg._count._all;
  const revenueCents = orderAgg._sum.totalCents ?? 0;

  return {
    ok: true,
    summary: {
      scans,
      orders,
      revenueCents,
      conversionRate: scans > 0 ? orders / scans : 0,
      lastOrderAt: lastOrder?.createdAt.toISOString() ?? null
    }
  };
}

/** Invalidate printed URL; create replacement with new publicCode (stolen/old QR defense). */
export async function rotateQrCode(
  prisma: PrismaClient,
  restaurantId: string,
  qrCodeId: string,
  createdByUserId?: string | null
) {
  const existing = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId }
  });
  if (!existing) return { ok: false as const, error: "qr_not_found" as const };
  const blocked = assertMutableStatus(existing.status);
  if (blocked) return { ok: false as const, error: blocked };

  const publicCode = await allocatePublicCode(prisma);
  const replacement = await prisma.$transaction(async (tx) => {
    const next = await tx.qrCode.create({
      data: {
        restaurantId,
        publicCode,
        name: existing.name,
        type: existing.type,
        status: "ACTIVE",
        experience: existing.experience,
        locationLabel: existing.locationLabel,
        areaLabel: existing.areaLabel,
        tableLabel: existing.tableLabel,
        tableId: existing.tableId,
        seatCount: existing.seatCount,
        paymentMode: existing.paymentMode,
        menuId: existing.menuId,
        allowOrdering: existing.allowOrdering,
        orderingPaused: existing.orderingPaused,
        sessionTtlHours: existing.sessionTtlHours,
        description: existing.description,
        headline: existing.headline,
        showRestaurantLogo: existing.showRestaurantLogo,
        showServeosBranding: existing.showServeosBranding,
        createdByUserId: createdByUserId ?? existing.createdByUserId,
        replacesId: existing.id
      },
      include: qrInclude
    });
    await tx.qrCode.update({
      where: { id: existing.id },
      data: { status: "ROTATED", deactivatedAt: new Date(), replacedById: next.id }
    });
    return next;
  });

  return { ok: true as const, qr: serializeQr(replacement), previousId: existing.id };
}

export async function duplicateQrCode(
  prisma: PrismaClient,
  restaurantId: string,
  qrCodeId: string,
  createdByUserId?: string | null
) {
  const existing = await prisma.qrCode.findFirst({
    where: { id: qrCodeId, restaurantId }
  });
  if (!existing) return { ok: false as const, error: "qr_not_found" as const };

  return createQrCode(prisma, {
    restaurantId,
    name: `${existing.name} (copy)`,
    type: existing.type,
    experience: existing.experience,
    locationLabel: existing.locationLabel,
    areaLabel: existing.areaLabel,
    tableLabel: existing.tableLabel,
    tableId: existing.tableId,
    seatCount: existing.seatCount,
    paymentMode: existing.paymentMode,
    menuId: existing.menuId,
    allowOrdering: existing.allowOrdering,
    orderingPaused: existing.orderingPaused,
    sessionTtlHours: existing.sessionTtlHours,
    description: existing.description,
    headline: existing.headline,
    showRestaurantLogo: existing.showRestaurantLogo,
    showServeosBranding: existing.showServeosBranding,
    createdByUserId
  });
}

export async function getQrDashboardStats(
  prisma: PrismaClient,
  restaurantId: string
): Promise<QrDashboardStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [activeCount, tableCount, aggregates, scansToday, ordersTodayAgg] = await Promise.all([
    prisma.qrCode.count({ where: { restaurantId, status: "ACTIVE" } }),
    prisma.qrCode.count({ where: { restaurantId, status: "ACTIVE", type: "TABLE" } }),
    prisma.qrCode.aggregate({
      where: { restaurantId, status: { notIn: ["ROTATED", "ARCHIVED"] } },
      _sum: { scanCount: true, orderCount: true }
    }),
    prisma.qrCode.count({
      where: { restaurantId, lastUsedAt: { gte: startOfDay } }
    }),
    prisma.order.aggregate({
      where: { restaurantId, qrCodeId: { not: null }, createdAt: { gte: startOfDay } },
      _count: { _all: true },
      _sum: { totalCents: true }
    })
  ]);

  return {
    activeCount,
    tableCount,
    scansToday,
    ordersToday: ordersTodayAgg._count._all,
    revenueTodayCents: ordersTodayAgg._sum.totalCents ?? 0,
    totalScans: aggregates._sum.scanCount ?? 0,
    totalOrders: aggregates._sum.orderCount ?? 0
  };
}

export function mapQrCodeError(code: string): string {
  switch (code) {
    case "restaurant_not_found":
      return "Venue not found.";
    case "qr_not_found":
      return "QR code not found.";
    case "qr_rotated":
      return "This QR code was rotated. Use the replacement code instead.";
    case "qr_inactive":
      return "This QR code is deactivated.";
    case "qr_archived":
      return "This QR code is archived.";
    case "qr_not_archived":
      return "This QR code is not archived.";
    case "qr_delete_forbidden":
      return "Only archived QR codes can be permanently deleted.";
    case "qr_not_mutable":
      return "One or more QR codes cannot be updated (rotated or archived).";
    case "qr_ids_required":
      return "Select at least one QR code.";
    case "qr_unavailable":
      return "This table is unavailable. Please ask staff.";
    case "ordering_paused":
      return "Ordering is paused for this QR code.";
    case "menu_not_found":
      return "Selected menu was not found.";
    case "experience_not_ready":
      return "This QR experience is not available yet. Please ask staff.";
    case "ordering_disabled":
      return "Ordering is not enabled for this QR code.";
    default:
      return "QR code error.";
  }
}
