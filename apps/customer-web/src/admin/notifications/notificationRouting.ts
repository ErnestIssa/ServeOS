import { ADMIN_NOTIFICATION_HASHES } from "../adminTopHashes";

export type NotificationLayout = "radar" | "threads" | "ledger" | "mesh" | "console" | "timeline";

export type NotificationCategory = {
  id: string;
  label: string;
  href: string;
  description: string;
  layout: NotificationLayout;
  accent: "rose" | "violet" | "emerald" | "sky" | "amber" | "slate";
};

export const ADMIN_NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    id: "customer-alerts",
    label: "Customer Alerts",
    href: ADMIN_NOTIFICATION_HASHES.customerAlerts,
    description: "Guest requests, complaints, and service signals",
    layout: "radar",
    accent: "rose"
  },
  {
    id: "staff-messages",
    label: "Staff Messages",
    href: ADMIN_NOTIFICATION_HASHES.staffMessages,
    description: "Internal pings, shift notes, and team updates",
    layout: "threads",
    accent: "violet"
  },
  {
    id: "payments",
    label: "Payments",
    href: ADMIN_NOTIFICATION_HASHES.payments,
    description: "Charges, refunds, disputes, and payout events",
    layout: "ledger",
    accent: "emerald"
  },
  {
    id: "devices",
    label: "Devices",
    href: ADMIN_NOTIFICATION_HASHES.devices,
    description: "Hardware offline, printer faults, and KDS drops",
    layout: "mesh",
    accent: "sky"
  },
  {
    id: "logs",
    label: "Logs",
    href: ADMIN_NOTIFICATION_HASHES.logs,
    description: "Audit trail, API events, and operational records",
    layout: "console",
    accent: "amber"
  },
  {
    id: "system-updates",
    label: "System updates",
    href: ADMIN_NOTIFICATION_HASHES.systemUpdates,
    description: "Platform releases, maintenance, and policy notices",
    layout: "timeline",
    accent: "slate"
  }
];

export function isNotificationCategoryHash(hash: string): boolean {
  return ADMIN_NOTIFICATION_CATEGORIES.some((c) => c.href === hash);
}

export function resolveNotificationCategory(hash: string): NotificationCategory | null {
  return ADMIN_NOTIFICATION_CATEGORIES.find((c) => c.href === hash) ?? null;
}

export function isNotificationsNavActive(hash: string): boolean {
  return isNotificationCategoryHash(hash);
}
