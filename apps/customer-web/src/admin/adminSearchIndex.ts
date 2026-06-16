import { ADMIN_NAV_GROUPS } from "./adminNavContent";
import { ADMIN_TOP_HASHES, ADMIN_VENUE_CONTROL_HASH } from "./adminTopHashes";

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
    title: "Venue control centre",
    subtitle: "Mission control for the active location",
    category: "Venues",
    href: ADMIN_VENUE_CONTROL_HASH,
    keywords: ["venue", "control", "location", "dashboard", "overview"]
  },
  {
    id: "top-billing",
    title: "Billing & subscription",
    subtitle: "Plans, invoices, and payment methods",
    category: "Account",
    href: ADMIN_TOP_HASHES.billing,
    keywords: ["billing", "invoice", "payment", "subscription", "plan"]
  },
  {
    id: "top-notifications",
    title: "Notifications",
    subtitle: "Alerts and system messages",
    category: "Account",
    href: ADMIN_TOP_HASHES.notifications,
    keywords: ["notifications", "alerts", "messages"]
  },
  {
    id: "top-add-staff",
    title: "Staff management",
    subtitle: "Invite teammates and assign roles",
    category: "Team",
    href: ADMIN_TOP_HASHES.addStaff,
    keywords: ["staff", "invite", "team", "roles"]
  },
  {
    id: "top-help",
    title: "Platform help",
    subtitle: "Guides, FAQs, and support",
    category: "Support",
    href: ADMIN_TOP_HASHES.platformHelp,
    keywords: ["help", "support", "faq", "guides"]
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
  "reservations",
  "menu-builder",
  "top-notifications",
  "top-add-staff",
  "top-billing",
  "tables",
  "staff-list",
  "top-help"
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
