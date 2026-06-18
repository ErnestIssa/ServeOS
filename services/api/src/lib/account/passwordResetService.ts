import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import { sendPasswordResetEmail } from "../integrations/transactionalEmails.js";
import { sanitizeReturnTo } from "../safeReturnTo.js";
import { logSecurityActivity } from "./securityActivity.js";
import { revokeOtherSessions } from "./sessionService.js";
import { validatePasswordStrength } from "./validation.js";

const SALT_ROUNDS = 10;
const TOKEN_TTL_HOURS = 1;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Always returns ok to avoid email enumeration. */
export async function requestPasswordReset(
  prisma: PrismaClient,
  email: string,
  ipMasked?: string | null,
  returnTo?: string | null
) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: normalized },
    select: { id: true, email: true }
  });

  if (user?.email) {
    await prisma.passwordResetRequest.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() }
    });

    const rawToken = randomBytes(32).toString("hex");
    await prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000)
      }
    });

    await sendPasswordResetEmail({
      to: user.email,
      token: rawToken,
      expiresHours: TOKEN_TTL_HOURS,
      returnTo: sanitizeReturnTo(returnTo)
    });

    await logSecurityActivity(prisma, {
      userId: user.id,
      type: "PASSWORD_RESET_REQUESTED",
      ipMasked,
      metadata: { email: user.email }
    });
  }

  return { ok: true as const };
}

export async function confirmPasswordReset(
  prisma: PrismaClient,
  params: {
    token: string;
    newPassword: string;
    confirmPassword: string;
    currentToken?: string;
    ipMasked?: string | null;
  }
) {
  if (params.newPassword !== params.confirmPassword) {
    return { ok: false as const, error: "password_mismatch" };
  }

  const strength = validatePasswordStrength(params.newPassword);
  if (!strength.ok) return { ok: false as const, error: strength.error };

  const row = await prisma.passwordResetRequest.findFirst({
    where: {
      tokenHash: hashToken(params.token.trim()),
      consumedAt: null,
      expiresAt: { gt: new Date() }
    }
  });
  if (!row) return { ok: false as const, error: "invalid_or_expired_token" };

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { password: true }
  });
  if (!user) return { ok: false as const, error: "user_not_found" };

  const same = await bcrypt.compare(params.newPassword, user.password);
  if (same) return { ok: false as const, error: "password_same_as_current" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { password: await bcrypt.hash(params.newPassword, SALT_ROUNDS) }
    }),
    prisma.passwordResetRequest.update({
      where: { id: row.id },
      data: { consumedAt: new Date() }
    })
  ]);

  if (params.currentToken) {
    await revokeOtherSessions(prisma, row.userId, params.currentToken);
  }

  await logSecurityActivity(prisma, {
    userId: row.userId,
    type: "PASSWORD_CHANGED",
    ipMasked: params.ipMasked,
    metadata: { method: "password_reset" }
  });

  return { ok: true as const };
}
