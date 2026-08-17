import { ADMIN_NOTIFICATION_HASHES, ADMIN_TOP_HASHES } from "../adminTopHashes";

export type NotificationLayout = "list" | "audit";

export type NotificationCategory = {
  id: string;
  label: string;
  href: string;
  description: string;
  layout: NotificationLayout;
  accent: "rose" | "violet" | "emerald" | "sky" | "amber" | "slate" | "purple";
  filter: "all" | "customer" | "staff" | "payments" | "devices" | "system" | "logs";
};

export const ADMIN_NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    id: "all",
    label: "All",
    href: ADMIN_TOP_HASHES.notifications,
    description: "Everything you need to know, across the venue",
    layout: "list",
    accent: "purple",
    filter: "all"
  },
  {
    id: "customer-alerts",
    label: "Customer",
    href: ADMIN_NOTIFICATION_HASHES.customerAlerts,
    description: "Guest orders, chats, and reservations",
    layout: "list",
    accent: "rose",
    filter: "customer"
  },
  {
    id: "staff-messages",
    label: "Staff",
    href: ADMIN_NOTIFICATION_HASHES.staffMessages,
    description: "Invites, approvals, and team updates",
    layout: "list",
    accent: "violet",
    filter: "staff"
  },
  {
    id: "payments",
    label: "Payments",
    href: ADMIN_NOTIFICATION_HASHES.payments,
    description: "Charges, refunds, and payout events",
    layout: "list",
    accent: "emerald",
    filter: "payments"
  },
  {
    id: "devices",
    label: "Devices",
    href: ADMIN_NOTIFICATION_HASHES.devices,
    description: "Hardware offline and integration faults",
    layout: "list",
    accent: "sky",
    filter: "devices"
  },
  {
    id: "logs",
    label: "Logs",
    href: ADMIN_NOTIFICATION_HASHES.logs,
    description: "What happened — audit trail, not an inbox",
    layout: "audit",
    accent: "amber",
    filter: "logs"
  },
  {
    id: "system-updates",
    label: "System",
    href: ADMIN_NOTIFICATION_HASHES.systemUpdates,
    description: "Platform and system notices",
    layout: "list",
    accent: "slate",
    filter: "system"
  }
];

export function isNotificationCategoryHash(hash: string) {
  return ADMIN_NOTIFICATION_CATEGORIES.some((c) => c.href === hash);
}

export function resolveNotificationCategory(hash: string): NotificationCategory | null {
  return ADMIN_NOTIFICATION_CATEGORIES.find((c) => c.href === hash) ?? null;
}

export function isNotificationsNavActive(hash: string) {
  return isNotificationCategoryHash(hash);
}
