import type { Prisma, PrismaClient, SecurityActivityType } from "@prisma/client";
import { sendSecurityAlertEmail } from "../integrations/transactionalEmails.js";
import { isSmsProviderConfigured, sendSms } from "../integrations/smsProvider.js";

const ACTIVITY_LABELS: Record<SecurityActivityType, string> = {
  LOGIN_SUCCESS: "Successful login",
  LOGIN_FAILED: "Failed login attempt",
  PASSWORD_CHANGED: "Password changed",
  PASSWORD_RESET_REQUESTED: "Password reset requested",
  EMAIL_CHANGE_REQUESTED: "Email change requested",
  EMAIL_CHANGED: "Email address changed",
  TWO_FA_ENABLED: "Two-factor authentication enabled",
  TWO_FA_DISABLED: "Two-factor authentication disabled",
  SESSION_REVOKED: "Session signed out",
  SESSIONS_REVOKED_ALL: "All other sessions signed out",
  OWNERSHIP_TRANSFER_REQUESTED: "Ownership transfer requested",
  ACCOUNT_CLOSURE_REQUESTED: "Account closure requested",
  PROFILE_UPDATED: "Profile updated"
};

const SECURITY_ALERT_TYPES = new Set<SecurityActivityType>([
  "LOGIN_FAILED",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET_REQUESTED",
  "EMAIL_CHANGE_REQUESTED",
  "EMAIL_CHANGED",
  "TWO_FA_ENABLED",
  "TWO_FA_DISABLED",
  "SESSIONS_REVOKED_ALL",
  "OWNERSHIP_TRANSFER_REQUESTED",
  "ACCOUNT_CLOSURE_REQUESTED"
]);

const ALERT_DETAILS: Partial<Record<SecurityActivityType, string>> = {
  LOGIN_FAILED: "Someone tried to sign in to your account with an incorrect password.",
  PASSWORD_CHANGED: "Your ServeOS password was changed.",
  PASSWORD_RESET_REQUESTED: "A password reset was requested for your account.",
  EMAIL_CHANGE_REQUESTED: "A request was made to change the email on your account.",
  EMAIL_CHANGED: "The email address on your account was updated.",
  TWO_FA_ENABLED: "Two-factor authentication was enabled on your account.",
  TWO_FA_DISABLED: "Two-factor authentication was disabled on your account.",
  SESSIONS_REVOKED_ALL: "All other signed-in devices were signed out of your account.",
  OWNERSHIP_TRANSFER_REQUESTED: "An ownership transfer was requested for one of your venues.",
  ACCOUNT_CLOSURE_REQUESTED: "An account closure request was submitted."
};

async function maybeSendSecurityAlert(
  prisma: PrismaClient,
  params: {
    userId: string;
    type: SecurityActivityType;
    ipMasked?: string | null;
  }
) {
  if (!SECURITY_ALERT_TYPES.has(params.type)) return;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true }
  });
  if (!user?.email) return;

  const title = ACTIVITY_LABELS[params.type] ?? params.type;
  const detail = ALERT_DETAILS[params.type] ?? "A security-related change occurred on your account.";

  try {
    await sendSecurityAlertEmail({
      to: user.email,
      title,
      detail,
      ipMasked: params.ipMasked
    });
  } catch (err) {
    console.error("[security-alert-email] failed", params.type, params.userId, err);
  }
}

async function maybeSendSecuritySms(
  prisma: PrismaClient,
  params: {
    userId: string;
    type: SecurityActivityType;
  }
) {
  if (!SECURITY_ALERT_TYPES.has(params.type)) return;
  if (!isSmsProviderConfigured()) return;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { phone: true }
  });
  if (!user?.phone?.trim()) return;

  const title = ACTIVITY_LABELS[params.type] ?? params.type;
  const detail = ALERT_DETAILS[params.type] ?? "A security-related change occurred on your account.";
  const body = `ServeOS security: ${title}. ${detail}`.slice(0, 320);

  const result = await sendSms({ to: user.phone, body });
  if (!result.ok) {
    if (result.error === "sms_trial_unverified_number") {
      console.info("[security-sms] skipped — Twilio trial requires verified recipient numbers");
      return;
    }
    console.warn("[security-sms] failed", params.type, params.userId, result.error);
  }
}

export async function logSecurityActivity(
  prisma: PrismaClient,
  params: {
    userId: string;
    type: SecurityActivityType;
    ipMasked?: string | null;
    metadata?: Record<string, unknown>;
    skipEmail?: boolean;
  }
) {
  await prisma.securityActivity.create({
    data: {
      userId: params.userId,
      type: params.type,
      ipMasked: params.ipMasked ?? null,
      metadata: (params.metadata ?? null) as Prisma.InputJsonValue
    }
  });

  if (!params.skipEmail) {
    await maybeSendSecurityAlert(prisma, params);
  }

  await maybeSendSecuritySms(prisma, params);
}

export async function listSecurityActivity(prisma: PrismaClient, userId: string, days = 90) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.securityActivity.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    label: ACTIVITY_LABELS[r.type] ?? r.type,
    ipMasked: r.ipMasked,
    metadata: r.metadata,
    createdAt: r.createdAt.toISOString()
  }));
}
