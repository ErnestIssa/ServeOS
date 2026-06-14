import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import { validatePasswordStrength } from "./validation.js";
import { logSecurityActivity } from "./securityActivity.js";
import { revokeOtherSessions } from "./sessionService.js";
import { captureSecurityAudit } from "../integrations/auditReporter.js";

const SALT_ROUNDS = 10;

export async function changeUserPassword(
  prisma: PrismaClient,
  params: {
    userId: string;
    currentToken: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    jwtSecret: string;
    ipMasked?: string | null;
  }
) {
  if (params.newPassword !== params.confirmPassword) {
    return { ok: false as const, error: "password_mismatch" };
  }

  const strength = validatePasswordStrength(params.newPassword);
  if (!strength.ok) return { ok: false as const, error: strength.error };

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { password: true }
  });
  if (!user) return { ok: false as const, error: "user_not_found" };

  const valid = await bcrypt.compare(params.currentPassword, user.password);
  if (!valid) return { ok: false as const, error: "invalid_current_password" };

  const same = await bcrypt.compare(params.newPassword, user.password);
  if (same) return { ok: false as const, error: "password_same_as_current" };

  await prisma.user.update({
    where: { id: params.userId },
    data: { password: await bcrypt.hash(params.newPassword, SALT_ROUNDS) }
  });

  await revokeOtherSessions(prisma, params.userId, params.currentToken);
  await logSecurityActivity(prisma, {
    userId: params.userId,
    type: "PASSWORD_CHANGED",
    ipMasked: params.ipMasked
  });
  captureSecurityAudit({ userId: params.userId, action: "password_changed" });

  return { ok: true as const, sessionsRevoked: true };
}
