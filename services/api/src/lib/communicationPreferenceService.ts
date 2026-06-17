import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { dispatchServeOsEmailSafe } from "./emailDispatchService.js";
import {
  COMMUNICATION_TYPE_ALIASES,
  DEFAULT_COMMUNICATION_PREFS,
  DEFAULT_EMAIL_COMMUNICATION_PREFS,
  DEFAULT_IN_APP_COMMUNICATION_PREFS,
  EMAIL_COMMUNICATION_KEYS,
  IN_APP_COMMUNICATION_KEYS,
  type CommunicationPrefsSnapshot,
  type EmailCommunicationKey,
  type EmailCommunicationPrefs,
  type InAppCommunicationKey,
  type InAppCommunicationPrefs
} from "./communicationPreferenceTypes.js";

const TOKEN_TTL_DAYS = 365;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function normalizeCommunicationEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseEmailPrefs(raw: unknown): EmailCommunicationPrefs {
  const base = { ...DEFAULT_EMAIL_COMMUNICATION_PREFS };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const key of EMAIL_COMMUNICATION_KEYS) {
    if (typeof o[key] === "boolean") base[key] = o[key];
  }
  return base;
}

function parseInAppPrefs(raw: unknown): InAppCommunicationPrefs {
  const base = { ...DEFAULT_IN_APP_COMMUNICATION_PREFS };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const key of IN_APP_COMMUNICATION_KEYS) {
    if (typeof o[key] === "boolean") base[key] = o[key];
  }
  return base;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "••••@••••";
  const visible = local.length <= 2 ? local[0] ?? "•" : `${local.slice(0, 2)}•••`;
  return `${visible}@${domain}`;
}

async function logAudit(
  prisma: PrismaClient,
  subscriberId: string,
  action: string,
  source: string,
  category?: string,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.communicationPreferenceAudit.create({
    data: {
      subscriberId,
      action,
      source,
      category: category ?? null,
      ...(metadata !== undefined ? { metadata } : {})
    }
  });
}

async function loadWorkspaces(prisma: PrismaClient, userId: string | null | undefined) {
  if (!userId) return [] as string[];
  const memberships = await prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    select: { restaurant: { select: { name: true } } },
    take: 8
  });
  return memberships.map((m) => m.restaurant.name).filter(Boolean);
}

function tokenExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= Date.now();
}

function buildPreview(
  row: {
    id: string;
    email: string;
    emailPrefs: unknown;
    inAppPrefs: unknown;
    updatedAt: Date;
    userId: string | null;
  },
  workspaces: string[],
  tokenValid: boolean
) {
  return {
    ok: true as const,
    tokenValid,
    emailMasked: maskEmail(row.email),
    email: row.email,
    workspaces,
    preferences: {
      email: parseEmailPrefs(row.emailPrefs),
      inApp: parseInAppPrefs(row.inAppPrefs)
    },
    lastUpdatedAt: row.updatedAt.toISOString()
  };
}

export async function getOrCreateCommunicationSubscriber(
  prisma: PrismaClient,
  email: string,
  opts?: { userId?: string | null; source?: string }
): Promise<{ subscriberId: string; token: string }> {
  const normalized = normalizeCommunicationEmail(email);
  const existing = await prisma.communicationSubscriber.findUnique({ where: { email: normalized } });
  if (existing) {
    if (opts?.userId && !existing.userId) {
      await prisma.communicationSubscriber.update({
        where: { id: existing.id },
        data: { userId: opts.userId }
      });
    }
    return { subscriberId: existing.id, token: "" };
  }

  const token = generateToken();
  const created = await prisma.communicationSubscriber.create({
    data: {
      email: normalized,
      userId: opts?.userId ?? null,
      tokenHash: hashToken(token),
      tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      emailPrefs: DEFAULT_EMAIL_COMMUNICATION_PREFS as Prisma.InputJsonValue,
      inAppPrefs: DEFAULT_IN_APP_COMMUNICATION_PREFS as Prisma.InputJsonValue,
      lastSource: opts?.source ?? "system"
    }
  });

  await logAudit(prisma, created.id, "subscriber_created", opts?.source ?? "system");
  return { subscriberId: created.id, token };
}

export async function previewCommunicationPreferencesByToken(prisma: PrismaClient, token: string) {
  const trimmed = token.trim();
  if (trimmed.length < 16) {
    return { ok: false as const, error: "invalid_token" };
  }

  const row = await prisma.communicationSubscriber.findUnique({
    where: { tokenHash: hashToken(trimmed) }
  });
  if (!row) return { ok: false as const, error: "invalid_token" };
  if (tokenExpired(row.tokenExpiresAt)) {
    return { ok: false as const, error: "token_expired", emailMasked: maskEmail(row.email) };
  }

  const workspaces = await loadWorkspaces(prisma, row.userId);
  return buildPreview(row, workspaces, true);
}

export async function previewCommunicationPreferencesForUser(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  if (!user?.email) return { ok: false as const, error: "no_email" };

  let row = await prisma.communicationSubscriber.findFirst({
    where: { OR: [{ userId }, { email: normalizeCommunicationEmail(user.email) }] }
  });

  if (!row) {
    const created = await getOrCreateCommunicationSubscriber(prisma, user.email, { userId, source: "session" });
    row = await prisma.communicationSubscriber.findUniqueOrThrow({ where: { id: created.subscriberId } });
  } else if (!row.userId) {
    row = await prisma.communicationSubscriber.update({
      where: { id: row.id },
      data: { userId }
    });
  }

  const workspaces = await loadWorkspaces(prisma, userId);
  return buildPreview(row, workspaces, true);
}

export async function updateCommunicationPreferences(
  prisma: PrismaClient,
  input: {
    token?: string;
    userId?: string;
    emailPrefs?: Partial<EmailCommunicationPrefs>;
    inAppPrefs?: Partial<InAppCommunicationPrefs>;
    source?: string;
  }
) {
  const source = input.source?.trim() || "web";
  let row =
    input.token && input.token.trim().length >= 16
      ? await prisma.communicationSubscriber.findUnique({
          where: { tokenHash: hashToken(input.token.trim()) }
        })
      : null;

  if (!row && input.userId) {
    const preview = await previewCommunicationPreferencesForUser(prisma, input.userId);
    if (!preview.ok) return preview;
    row = await prisma.communicationSubscriber.findFirst({
      where: { email: preview.email }
    });
  }

  if (!row) return { ok: false as const, error: "invalid_token" };
  if (input.token && tokenExpired(row.tokenExpiresAt)) {
    return { ok: false as const, error: "token_expired", emailMasked: maskEmail(row.email) };
  }

  const emailPrefs = parseEmailPrefs(row.emailPrefs);
  const inAppPrefs = parseInAppPrefs(row.inAppPrefs);

  for (const key of EMAIL_COMMUNICATION_KEYS) {
    if (input.emailPrefs?.[key] !== undefined) emailPrefs[key] = Boolean(input.emailPrefs[key]);
  }
  for (const key of IN_APP_COMMUNICATION_KEYS) {
    if (input.inAppPrefs?.[key] !== undefined) inAppPrefs[key] = Boolean(input.inAppPrefs[key]);
  }

  const updated = await prisma.communicationSubscriber.update({
    where: { id: row.id },
    data: {
      emailPrefs: emailPrefs as Prisma.InputJsonValue,
      inAppPrefs: inAppPrefs as Prisma.InputJsonValue,
      lastSource: source
    }
  });

  await logAudit(prisma, row.id, "preferences_updated", source, undefined, {
    emailPrefs,
    inAppPrefs
  } as Prisma.InputJsonValue);

  const workspaces = await loadWorkspaces(prisma, updated.userId);
  return buildPreview(updated, workspaces, true);
}

function allNonEssentialOff(): CommunicationPrefsSnapshot {
  return {
    email: {
      marketing: false,
      newsletter: false,
      productUpdates: false,
      events: false,
      partner: false
    },
    inApp: {
      featureTips: false,
      productSuggestions: false,
      usageInsights: false,
      promotions: false
    }
  };
}

export async function unsubscribeAllNonEssential(
  prisma: PrismaClient,
  input: { token?: string; userId?: string; source?: string }
) {
  const off = allNonEssentialOff();
  const result = await updateCommunicationPreferences(prisma, {
    ...input,
    emailPrefs: off.email,
    inAppPrefs: off.inApp,
    source: input.source ?? "unsubscribe_all"
  });
  if (!result.ok) return result;

  const row =
    input.token && input.token.trim().length >= 16
      ? await prisma.communicationSubscriber.findUnique({
          where: { tokenHash: hashToken(input.token.trim()) }
        })
      : input.userId
        ? await prisma.communicationSubscriber.findFirst({ where: { userId: input.userId } })
        : null;
  if (row) await logAudit(prisma, row.id, "unsubscribe_all_non_essential", input.source ?? "unsubscribe_all");
  return result;
}

export async function enableAllCommunications(
  prisma: PrismaClient,
  input: { token?: string; userId?: string; source?: string }
) {
  const result = await updateCommunicationPreferences(prisma, {
    ...input,
    emailPrefs: DEFAULT_EMAIL_COMMUNICATION_PREFS,
    inAppPrefs: DEFAULT_IN_APP_COMMUNICATION_PREFS,
    source: input.source ?? "enable_all"
  });
  if (!result.ok) return result;

  const row =
    input.token && input.token.trim().length >= 16
      ? await prisma.communicationSubscriber.findUnique({
          where: { tokenHash: hashToken(input.token.trim()) }
        })
      : input.userId
        ? await prisma.communicationSubscriber.findFirst({ where: { userId: input.userId } })
        : null;
  if (row) await logAudit(prisma, row.id, "enable_all", input.source ?? "enable_all");
  return result;
}

export async function issueCommunicationPreferencesToken(
  prisma: PrismaClient,
  email: string,
  opts?: { userId?: string | null; source?: string }
): Promise<{ token: string; emailMasked: string; subscriberId: string }> {
  const normalized = normalizeCommunicationEmail(email);
  const token = generateToken();
  const row = await prisma.communicationSubscriber.upsert({
    where: { email: normalized },
    create: {
      email: normalized,
      userId: opts?.userId ?? null,
      tokenHash: hashToken(token),
      tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      emailPrefs: DEFAULT_EMAIL_COMMUNICATION_PREFS as Prisma.InputJsonValue,
      inAppPrefs: DEFAULT_IN_APP_COMMUNICATION_PREFS as Prisma.InputJsonValue,
      lastSource: opts?.source ?? "system"
    },
    update: {
      tokenHash: hashToken(token),
      tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      ...(opts?.userId ? { userId: opts.userId } : {})
    }
  });
  return { token, emailMasked: maskEmail(normalized), subscriberId: row.id };
}

export async function requestCommunicationPreferencesAccess(prisma: PrismaClient, email: string) {
  const normalized = normalizeCommunicationEmail(email);
  if (!normalized.includes("@") || normalized.length < 5) {
    return { ok: true as const, message: "lookup_accepted" };
  }

  const { token, emailMasked, subscriberId } = await issueCommunicationPreferencesToken(prisma, normalized, {
    source: "email_lookup"
  });
  await logAudit(prisma, subscriberId, "access_link_requested", "email_lookup");
  await dispatchServeOsEmailSafe({
    template: "communication_preferences",
    to: normalized,
    token,
    emailMasked
  });

  return { ok: true as const, message: "lookup_accepted" };
}

export function resolvePreferenceKeyFromType(type: string | undefined): {
  scope: "email" | "inApp";
  key: EmailCommunicationKey | InAppCommunicationKey;
} | null {
  if (!type?.trim()) return null;
  const key = COMMUNICATION_TYPE_ALIASES[type.trim().toLowerCase()];
  if (!key) return null;
  if ((EMAIL_COMMUNICATION_KEYS as readonly string[]).includes(key)) {
    return { scope: "email", key: key as EmailCommunicationKey };
  }
  return { scope: "inApp", key: key as InAppCommunicationKey };
}

import { communicationPreferencesUrl } from "./emailUrls.js";

export function buildCommunicationPreferencesUrl(token: string, type?: string): string {
  return communicationPreferencesUrl(token, type);
}
