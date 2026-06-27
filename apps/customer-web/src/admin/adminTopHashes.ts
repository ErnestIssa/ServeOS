export const ADMIN_TOP_HASHES = {
  billing: "#top-billing",
  notifications: "#top-notifications",
  addStaff: "#top-add-staff",
  platformHelp: "#top-platform-help",
  profile: "#top-profile"
} as const;

export const ADMIN_NOTIFICATION_HASHES = {
  customerAlerts: "#top-notify-customer-alerts",
  staffMessages: "#top-notify-staff-messages",
  payments: "#top-notify-payments",
  devices: "#top-notify-devices",
  logs: "#top-notify-logs",
  systemUpdates: "#top-notify-system-updates"
} as const;

export const ADMIN_BILLING_HASHES = {
  subscription: "#top-bill-subscription",
  invoices: "#top-bill-invoices",
  paymentMethod: "#top-bill-payment-method",
  usageLimits: "#top-bill-usage-limits",
  billingHistory: "#top-bill-billing-history",
  planFeatures: "#top-bill-plan-features",
  security: "#top-bill-security"
} as const;

export const ADMIN_HELP_HASHES = {
  tipsInfo: "#top-help-tips-info",
  faqs: "#top-help-faqs",
  productGuides: "#top-help-product-guides",
  troubleshooting: "#top-help-troubleshooting"
} as const;

export const ADMIN_VENUE_CONTROL_HASH = "#venue-control-centre";

export type AdminTopHash = (typeof ADMIN_TOP_HASHES)[keyof typeof ADMIN_TOP_HASHES];
export type AdminNotificationHash = (typeof ADMIN_NOTIFICATION_HASHES)[keyof typeof ADMIN_NOTIFICATION_HASHES];
export type AdminBillingHash = (typeof ADMIN_BILLING_HASHES)[keyof typeof ADMIN_BILLING_HASHES];
export type AdminHelpHash = (typeof ADMIN_HELP_HASHES)[keyof typeof ADMIN_HELP_HASHES];

const TOP_HASH_SET = new Set<string>(Object.values(ADMIN_TOP_HASHES));
const NOTIFICATION_HASH_SET = new Set<string>(Object.values(ADMIN_NOTIFICATION_HASHES));
const BILLING_HASH_SET = new Set<string>(Object.values(ADMIN_BILLING_HASHES));
const HELP_HASH_SET = new Set<string>(Object.values(ADMIN_HELP_HASHES));

export function isAdminTopPageHash(hash: string): hash is AdminTopHash {
  return TOP_HASH_SET.has(hash);
}

export function isAdminNotificationPageHash(hash: string): hash is AdminNotificationHash {
  return NOTIFICATION_HASH_SET.has(hash);
}

export function isAdminBillingPageHash(hash: string): hash is AdminBillingHash {
  return BILLING_HASH_SET.has(hash);
}

export function isAdminHelpPageHash(hash: string): hash is AdminHelpHash {
  return HELP_HASH_SET.has(hash);
}

export function isAdminFullPageHash(hash: string): boolean {
  if (
    hash === ADMIN_TOP_HASHES.notifications ||
    hash === ADMIN_TOP_HASHES.billing ||
    hash === ADMIN_TOP_HASHES.platformHelp
  ) {
    return false;
  }
  return (
    isAdminTopPageHash(hash) ||
    isAdminNotificationPageHash(hash) ||
    isAdminBillingPageHash(hash) ||
    isAdminHelpPageHash(hash) ||
    hash === ADMIN_VENUE_CONTROL_HASH
  );
}

export function adminFullPageKey(hash: string): string {
  if (isAdminFullPageHash(hash)) return hash;
  const match = (hash || "").match(/^#ws-[a-z-]+\/[^/]+$/);
  if (match) return hash;
  return "#ws-live-ops/live-overview";
}
