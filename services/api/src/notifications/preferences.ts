import type { NotificationCategory, NotificationPriority, PrismaClient } from "@prisma/client";
import type { DeliveryChannel } from "./types.js";

export type UserPrefs = {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  quietHours: { start?: string; end?: string; timezone?: string } | null;
  categoryFlags: Partial<Record<NotificationCategory, boolean>>;
};

const DEFAULT_PREFS: UserPrefs = {
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  whatsappEnabled: false,
  quietHours: null,
  categoryFlags: {}
};

export async function loadUserNotificationPrefs(
  prisma: PrismaClient,
  userId: string
): Promise<UserPrefs> {
  const row = await prisma.userNotificationPreference.findUnique({ where: { userId } });
  if (!row) return { ...DEFAULT_PREFS };
  return {
    pushEnabled: row.pushEnabled,
    emailEnabled: row.emailEnabled,
    smsEnabled: row.smsEnabled,
    whatsappEnabled: row.whatsappEnabled,
    quietHours: parseQuietHours(row.quietHours),
    categoryFlags: parseCategoryFlags(row.categoryFlags)
  };
}

function parseQuietHours(raw: unknown): UserPrefs["quietHours"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    start: typeof o.start === "string" ? o.start : undefined,
    end: typeof o.end === "string" ? o.end : undefined,
    timezone: typeof o.timezone === "string" ? o.timezone : undefined
  };
}

function parseCategoryFlags(raw: unknown): Partial<Record<NotificationCategory, boolean>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Partial<Record<NotificationCategory, boolean>>;
}

function inQuietHours(prefs: UserPrefs, now = new Date()): boolean {
  const q = prefs.quietHours;
  if (!q?.start || !q?.end) return false;
  const hhmm = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const cur = hhmm(now);
  if (q.start <= q.end) return cur >= q.start && cur < q.end;
  return cur >= q.start || cur < q.end;
}

/**
 * Single channel policy. Handlers must not invent their own quiet-hours / pref logic.
 *
 *   Priority   In-app   Push          Email
 *   LOW        always   prefs         prefs
 *   MEDIUM     always   prefs*        prefs
 *   HIGH       always   always        prefs
 *   CRITICAL   always   always        always
 *
 *   * Operational categories (CHAT/ORDER/PAYMENT/RESERVATION) keep PUSH during quiet hours.
 */
export function filterChannelsByPreferences(
  channels: DeliveryChannel[],
  priority: NotificationPriority,
  category: NotificationCategory,
  prefs: UserPrefs
): DeliveryChannel[] {
  if (priority === "CRITICAL") return channels;

  const operational =
    category === "CHAT" || category === "ORDER" || category === "PAYMENT" || category === "RESERVATION";

  return channels.filter((ch) => {
    if (ch === "IN_APP") return true;
    if (prefs.categoryFlags[category] === false) return false;

    if (ch === "PUSH") {
      if (priority === "HIGH") return true;
      if (inQuietHours(prefs) && operational) return true;
      if (inQuietHours(prefs)) return false;
      return prefs.pushEnabled;
    }

    if (ch === "EMAIL") return prefs.emailEnabled;
    if (ch === "SMS") return prefs.smsEnabled;
    if (ch === "WHATSAPP") return prefs.whatsappEnabled;
    return false;
  });
}
