import type { PrismaClient } from "@prisma/client";
import { createOrderingSession } from "../ordering/orderingSessionService.js";
import {
  buildQrArtifactUrls,
  mapQrCodeError,
  type QrCodeRow
} from "./qrCodeManageService.js";

export type ResolveQrResult =
  | {
      ok: true;
      qr: Pick<
        QrCodeRow,
        | "id"
        | "name"
        | "type"
        | "status"
        | "experience"
        | "tableLabel"
        | "areaLabel"
        | "locationLabel"
        | "headline"
        | "allowOrdering"
        | "paymentMode"
        | "publicCode"
      >;
      sessionId: string;
      menuUrl: string;
      restaurantId: string;
    }
  | { ok: false; error: string; message: string };

/**
 * Public scan path: permanent QR identity → temporary OrderingSession.
 * Printed URL stays `/q/{publicCode}` forever (until rotate).
 */
export async function resolveQrPublicCode(
  prisma: PrismaClient,
  publicCode: string
): Promise<ResolveQrResult> {
  const code = publicCode.trim();
  if (!code) {
    return { ok: false, error: "qr_not_found", message: mapQrCodeError("qr_not_found") };
  }

  const qr = await prisma.qrCode.findUnique({ where: { publicCode: code } });
  if (!qr) {
    return { ok: false, error: "qr_not_found", message: mapQrCodeError("qr_not_found") };
  }

  if (qr.status === "ROTATED") {
    return { ok: false, error: "qr_rotated", message: mapQrCodeError("qr_rotated") };
  }
  if (qr.status === "INACTIVE") {
    return { ok: false, error: "qr_unavailable", message: mapQrCodeError("qr_unavailable") };
  }

  if (qr.experience === "FEEDBACK" || qr.experience === "PROMOTION" || qr.experience === "RESERVATION") {
    await prisma.qrCode.update({
      where: { id: qr.id },
      data: { scanCount: { increment: 1 }, lastUsedAt: new Date() }
    });
    return { ok: false, error: "experience_not_ready", message: mapQrCodeError("experience_not_ready") };
  }

  const session = await createOrderingSession(prisma, {
    restaurantId: qr.restaurantId,
    sessionType: "QR_SESSION",
    entryMode: "qr_scan",
    tableId: qr.tableId ?? undefined,
    tableLabel: qr.tableLabel ?? undefined,
    paymentMode: qr.paymentMode,
    qrCodeId: qr.id,
    menuId: qr.menuId ?? undefined,
    allowOrdering: qr.allowOrdering
  });

  if (!session.ok) {
    return {
      ok: false,
      error: session.error,
      message: mapQrCodeError(session.error)
    };
  }

  await prisma.qrCode.update({
    where: { id: qr.id },
    data: { scanCount: { increment: 1 }, lastUsedAt: new Date() }
  });

  return {
    ok: true,
    restaurantId: qr.restaurantId,
    sessionId: session.session.id,
    menuUrl: session.session.menuUrl,
    qr: {
      id: qr.id,
      name: qr.name,
      type: qr.type,
      status: qr.status,
      experience: qr.experience,
      tableLabel: qr.tableLabel,
      areaLabel: qr.areaLabel,
      locationLabel: qr.locationLabel,
      headline: qr.headline,
      allowOrdering: qr.allowOrdering,
      paymentMode: qr.paymentMode,
      publicCode: qr.publicCode
    }
  };
}

export async function recordQrOrderPlaced(prisma: PrismaClient, qrCodeId: string | null | undefined) {
  if (!qrCodeId) return;
  await prisma.qrCode.updateMany({
    where: { id: qrCodeId },
    data: { orderCount: { increment: 1 }, lastUsedAt: new Date() }
  });
}

export function previewArtifactForPublicCode(publicCode: string) {
  return buildQrArtifactUrls(publicCode);
}
