import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import { sendEmailChangeVerification } from "../integrations/transactionalEmails.js";
import { logSecurityActivity } from "./securityActivity.js";

const TOKEN_TTL_HOURS = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestEmailChange(
  prisma: PrismaClient,
  params: {
    userId: string;
    newEmail: string;
    password: string;
    ipMasked?: string | null;
    confirmBaseUrl?: string;
  }
) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, password: true }
  });
  if (!user) return { ok: false as const, error: "user_not_found" };

  const valid = await bcrypt.compare(params.password, user.password);
  if (!valid) return { ok: false as const, error: "invalid_password" };

  const normalized = params.newEmail.trim().toLowerCase();
  if (user.email?.toLowerCase() === normalized) {
    return { ok: false as const, error: "email_unchanged" };
  }

  const taken = await prisma.user.findFirst({
    where: { email: normalized, NOT: { id: params.userId } },
    select: { id: true }
  });
  if (taken) return { ok: false as const, error: "email_in_use" };

  await prisma.emailChangeRequest.updateMany({
    where: { userId: params.userId, consumedAt: null },
    data: { consumedAt: new Date() }
  });

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.emailChangeRequest.create({
    data: {
      userId: params.userId,
      newEmail: normalized,
      tokenHash: hashToken(rawToken),
      passwordVerifiedAt: new Date(),
      expiresAt
    }
  });

  try {
    await sendEmailChangeVerification({
      to: normalized,
      token: rawToken,
      expiresHours: TOKEN_TTL_HOURS
    });
  } catch {
    return { ok: false as const, error: "email_send_failed" };
  }

  await logSecurityActivity(prisma, {
    userId: params.userId,
    type: "EMAIL_CHANGE_REQUESTED",
    ipMasked: params.ipMasked,
    metadata: { newEmail: normalized }
  });

  return { ok: true as const, verificationSent: true };
}

export async function confirmEmailChange(prisma: PrismaClient, rawToken: string, ipMasked?: string | null) {
  const tokenHash = hashToken(rawToken.trim());
  const row = await prisma.emailChangeRequest.findFirst({
    where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } }
  });
  if (!row) return { ok: false as const, error: "invalid_or_expired_token" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { email: row.newEmail }
    }),
    prisma.emailChangeRequest.update({
      where: { id: row.id },
      data: { consumedAt: new Date() }
    })
  ]);

  await logSecurityActivity(prisma, {
    userId: row.userId,
    type: "EMAIL_CHANGED",
    ipMasked,
    metadata: { newEmail: row.newEmail }
  });

  return { ok: true as const, userId: row.userId, newEmail: row.newEmail };
}
