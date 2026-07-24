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
  headline: string | null;
  showRestaurantLogo: boolean;
  showServeosBranding: boolean;
  scanCount: number;
  orderCount: number;
  lastUsedAt: string | null;
  deactivatedAt: string | null;
  replacedById: string | null;
  replacesId: string | null;
  publicUrl: string;
  qrImageUrl: string;
  pngDownloadUrl: string;
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
    pngDownloadUrl: `${qrImageUrl}&format=png`
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
    headline: string | null;
    showRestaurantLogo: boolean;
    showServeosBranding: boolean;
    scanCount: number;
    orderCount: number;
    lastUsedAt: Date | null;
    deactivatedAt: Date | null;
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
    headline: row.headline,
    showRestaurantLogo: row.showRestaurantLogo,
    showServeosBranding: row.showServeosBranding,
    scanCount: row.scanCount,
    orderCount: row.orderCount,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
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
  if (existing.status === "ROTATED") return { ok: false as const, error: "qr_rotated" as const };

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
      ...(opts?.status ? { status: opts.status } : { status: { not: "ROTATED" } }),
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
  if (existing.status === "ROTATED") return { ok: false as const, error: "qr_rotated" as const };

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

  const row = await prisma.qrCode.update({
    where: { id: qrCodeId },
    data: { status: "ACTIVE", deactivatedAt: null },
    include: qrInclude
  });
  return { ok: true as const, qr: serializeQr(row) };
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
  if (existing.status === "ROTATED") return { ok: false as const, error: "qr_rotated" as const };

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
      where: { restaurantId, status: { not: "ROTATED" } },
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
    case "qr_unavailable":
      return "This table is unavailable. Please ask staff.";
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
