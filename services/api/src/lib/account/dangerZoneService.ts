import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import { logSecurityActivity } from "./securityActivity.js";
import { sendAccountClosureEmail, sendOwnershipTransferEmail } from "../integrations/transactionalEmails.js";

const COOLING_DAYS = 14;

export async function requestOwnershipTransfer(
  prisma: PrismaClient,
  params: {
    fromUserId: string;
    toEmail: string;
    restaurantId: string;
    password: string;
    twoFaCode?: string;
    ipMasked?: string | null;
  }
) {
  const user = await prisma.user.findUnique({
    where: { id: params.fromUserId },
    select: { password: true, email: true }
  });
  if (!user) return { ok: false as const, error: "user_not_found" };

  const valid = await bcrypt.compare(params.password, user.password);
  if (!valid) return { ok: false as const, error: "invalid_password" };

  const membership = await prisma.membership.findFirst({
    where: {
      userId: params.fromUserId,
      restaurantId: params.restaurantId,
      role: "OWNER",
      status: "ACTIVE"
    }
  });
  if (!membership) return { ok: false as const, error: "not_venue_owner" };

  const tfa = await prisma.userTwoFactorAuth.findUnique({ where: { userId: params.fromUserId } });
  if (tfa?.enabled && !params.twoFaCode) {
    return { ok: false as const, error: "2fa_required" };
  }

  const toEmail = params.toEmail.trim().toLowerCase();
  const targetUser = await prisma.user.findFirst({ where: { email: toEmail }, select: { id: true } });

  const row = await prisma.ownershipTransferRequest.create({
    data: {
      fromUserId: params.fromUserId,
      toEmail,
      toUserId: targetUser?.id ?? null,
      restaurantId: params.restaurantId,
      passwordVerifiedAt: new Date(),
      twoFaVerifiedAt: tfa?.enabled ? new Date() : null
    }
  });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: params.restaurantId },
    select: { name: true }
  });

  try {
    await sendOwnershipTransferEmail({
      to: toEmail,
      restaurantName: restaurant?.name ?? "your venue",
      fromEmail: user.email
    });
  } catch {
    return { ok: false as const, error: "email_send_failed" };
  }

  await logSecurityActivity(prisma, {
    userId: params.fromUserId,
    type: "OWNERSHIP_TRANSFER_REQUESTED",
    ipMasked: params.ipMasked,
    metadata: { toEmail, restaurantId: params.restaurantId }
  });

  return { ok: true as const, requestId: row.id, status: "PENDING" };
}

export async function requestAccountClosure(
  prisma: PrismaClient,
  params: { userId: string; password: string; reason?: string; ipMasked?: string | null }
) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { password: true, email: true }
  });
  if (!user) return { ok: false as const, error: "user_not_found" };

  const valid = await bcrypt.compare(params.password, user.password);
  if (!valid) return { ok: false as const, error: "invalid_password" };

  const existing = await prisma.accountClosureRequest.findFirst({
    where: { userId: params.userId, status: "PENDING" }
  });
  if (existing) return { ok: false as const, error: "closure_already_pending" };

  const coolingUntil = new Date(Date.now() + COOLING_DAYS * 24 * 60 * 60 * 1000);
  const row = await prisma.accountClosureRequest.create({
    data: {
      userId: params.userId,
      reason: params.reason?.trim() || null,
      status: "PENDING",
      coolingUntil
    }
  });

  if (user.email) {
    try {
      await sendAccountClosureEmail({
        to: user.email,
        coolingUntil: coolingUntil.toISOString().slice(0, 10)
      });
    } catch {
      return { ok: false as const, error: "email_send_failed" };
    }
  }

  await logSecurityActivity(prisma, {
    userId: params.userId,
    type: "ACCOUNT_CLOSURE_REQUESTED",
    ipMasked: params.ipMasked,
    metadata: { requestId: row.id },
    skipEmail: true
  });

  return { ok: true as const, requestId: row.id, coolingUntil: coolingUntil.toISOString(), status: "PENDING" };
}
