import { ADMIN_NOTIFICATION_HASHES, ADMIN_TOP_HASHES, ADMIN_VENUE_CONTROL_HASH } from "./adminTopHashes";
import { ADMIN_NAV_GROUPS, ADMIN_BILLING_CATEGORIES, ADMIN_HELP_CATEGORIES, ADMIN_NOTIFICATION_CATEGORIES } from "./adminNavContent";

export type AdminSearchEntry = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  href: string;
  keywords: string[];
};

const STATIC_ENTRIES: AdminSearchEntry[] = [
  {
    id: "venue-control",
    title: "Venue profile",
    subtitle: "Identity, IDs, and workspace locations",
    category: "Venues",
    href: ADMIN_VENUE_CONTROL_HASH,
    keywords: ["venue", "profile", "location", "restaurant", "identity", "id"]
  },
  {
    id: "notify-customer-alerts",
    title: "Customer Alerts",
    subtitle: "Notifications",
    category: "Alerts",
    href: ADMIN_NOTIFICATION_HASHES.customerAlerts,
    keywords: ["customer", "alerts", "guest", "notifications"]
  },
  ...ADMIN_BILLING_CATEGORIES.map((cat) => ({
    id: cat.id,
    title: cat.label,
    subtitle: "ServeOS platform billing",
    category: "Billing",
    href: cat.href,
    keywords: [cat.label, cat.layout, "billing", "subscription", "saas", "invoice"]
  })),
  ...ADMIN_NOTIFICATION_CATEGORIES.map((cat) => ({
    id: cat.id,
    title: cat.label,
    subtitle: "Notifications",
    category: "Alerts",
    href: cat.href,
    keywords: [cat.label, cat.layout, "notifications", "alerts"]
  })),
  ...ADMIN_HELP_CATEGORIES.map((cat) => ({
    id: cat.id,
    title: cat.label,
    subtitle: "Platform help",
    category: "Support",
    href: cat.href,
    keywords: [cat.label, cat.layout, "help", "support", "faq", "guide", "troubleshooting"]
  })),
  {
    id: "top-add-staff",
    title: "Staff management",
    subtitle: "Invite teammates and assign roles",
    category: "Team",
    href: ADMIN_TOP_HASHES.addStaff,
    keywords: ["staff", "invite", "team", "roles"]
  },
  {
    id: "top-profile",
    title: "Your profile",
    subtitle: "Account, security, and preferences",
    category: "Account",
    href: ADMIN_TOP_HASHES.profile,
    keywords: ["profile", "account", "password", "security"]
  }
];

function fromNavGroups(): AdminSearchEntry[] {
  const out: AdminSearchEntry[] = [];
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      out.push({
        id: item.id,
        title: item.label,
        subtitle: item.description ?? group.label,
        category: group.label,
        href: item.href,
        keywords: [item.label, group.label, item.description ?? "", item.id]
      });
    }
  }
  return out;
}

const ALL_ENTRIES = [...STATIC_ENTRIES, ...fromNavGroups()];

const SUGGESTED_IDS = [
  "venue-control",
  "live-overview",
  "live-orders",
  "all-orders",
  "active-orders",
  "problem-orders",
  "reservations",
  "menu",
  "notify-customer-alerts",
  "top-add-staff",
  "bill-subscription",
  "payments",
  "tips-info",
] as const;

function suggestedEntries(): AdminSearchEntry[] {
  const picked = SUGGESTED_IDS.map((id) => ALL_ENTRIES.find((e) => e.id === id)).filter(
    (e): e is AdminSearchEntry => Boolean(e)
  );
  return picked.length > 0 ? picked : ALL_ENTRIES.slice(0, 12);
}

export function filterAdminSearch(query: string): AdminSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return suggestedEntries();
  return ALL_ENTRIES.filter((entry) => {
    const hay = [entry.title, entry.subtitle, entry.category, ...entry.keywords].join(" ").toLowerCase();
    return hay.includes(q) || q.split(/\s+/).every((token) => hay.includes(token));
  }).slice(0, 12);
}

export function groupAdminSearchByCategory(entries: AdminSearchEntry[]): Array<{ category: string; items: AdminSearchEntry[] }> {
  const map = new Map<string, AdminSearchEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.category) ?? [];
    list.push(entry);
    map.set(entry.category, list);
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }));
}
