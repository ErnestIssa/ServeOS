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

export function filterChannelsByPreferences(
  channels: DeliveryChannel[],
  priority: NotificationPriority,
  category: NotificationCategory,
  prefs: UserPrefs
): DeliveryChannel[] {
  if (priority === "CRITICAL") return channels;

  if (prefs.categoryFlags[category] === false) {
    return channels.filter((c) => c === "IN_APP");
  }

  if (inQuietHours(prefs)) {
    return channels.filter((c) => c === "IN_APP" || c === "EMAIL");
  }

  return channels.filter((ch) => {
    switch (ch) {
      case "PUSH":
        return prefs.pushEnabled;
      case "EMAIL":
        return prefs.emailEnabled;
      case "SMS":
        return prefs.smsEnabled;
      case "WHATSAPP":
        return prefs.whatsappEnabled;
      case "IN_APP":
        return true;
      default:
        return false;
    }
  });
}
