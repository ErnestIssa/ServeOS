import type { NavAction } from "./navContent";
import { NAV_MEGA_MENUS } from "./navContent";

export type SearchResultCategory =
  | "Features"
  | "Docs"
  | "Pricing"
  | "Hardware"
  | "Support"
  | "Integrations"
  | "Company";

export type MarketingSearchEntry = {
  id: string;
  title: string;
  subtitle: string;
  category: SearchResultCategory;
  keywords: string[];
  action: NavAction;
};

const scroll = (targetId: string): NavAction => ({ type: "scroll", targetId });

const CATEGORY_RANK: Record<SearchResultCategory, number> = {
  Features: 0,
  Integrations: 1,
  Hardware: 2,
  Docs: 3,
  Pricing: 4,
  Support: 5,
  Company: 6
};

function menuCategory(menuId: string): SearchResultCategory {
  if (menuId === "hardware") return "Hardware";
  if (menuId === "resources") return "Docs";
  return "Features";
}

function fromMenus(): MarketingSearchEntry[] {
  const out: MarketingSearchEntry[] = [];
  for (const menu of NAV_MEGA_MENUS) {
    for (const col of menu.columns) {
      for (const item of col.items) {
        out.push({
          id: `${menu.id}-${item.label}`,
          title: item.label,
          subtitle: item.description ?? col.title,
          category: menuCategory(menu.id),
          keywords: [item.label, col.title, menu.label, item.description ?? "", item.badge ?? ""].filter(
            Boolean
          ) as string[],
          action: item.action
        });
      }
    }
  }
  return out;
}

const PLATFORM_EXTRAS: MarketingSearchEntry[] = [
  {
    id: "ocl-layer",
    title: "Operational communication layer",
    subtitle: "Orders, chat, and timeline on one thread",
    category: "Features",
    keywords: ["ocl", "chat", "timeline", "operations", "workspace"],
    action: scroll("features")
  },
  {
    id: "order-workspace",
    title: "Order workspace",
    subtitle: "Staff hub for live tickets and actions",
    category: "Features",
    keywords: ["orders", "workspace", "staff", "kitchen"],
    action: scroll("features")
  },
  {
    id: "admin-dashboard",
    title: "Admin dashboard",
    subtitle: "Menus, venues, staff, and reporting",
    category: "Features",
    keywords: ["admin", "dashboard", "web", "control"],
    action: scroll("features")
  },
  {
    id: "how-it-works",
    title: "How ServeOS works",
    subtitle: "End-to-end platform workflow",
    category: "Docs",
    keywords: ["how", "workflow", "guide", "tour"],
    action: { type: "how-it-works" }
  },
  {
    id: "stripe",
    title: "Stripe payments",
    subtitle: "Cards and digital wallets",
    category: "Integrations",
    keywords: ["stripe", "payments", "card"],
    action: scroll("features")
  },
  {
    id: "swish",
    title: "Swish payments",
    subtitle: "Popular in Nordic markets",
    category: "Integrations",
    keywords: ["swish", "payments", "nordic"],
    action: scroll("features")
  },
  {
    id: "receipt-printers",
    title: "Receipt printers",
    subtitle: "Kitchen and counter tickets",
    category: "Hardware",
    keywords: ["printer", "receipt", "hardware"],
    action: scroll("features")
  },
  {
    id: "cash-drawers",
    title: "Cash drawers",
    subtitle: "Connect existing peripherals",
    category: "Hardware",
    keywords: ["cash", "drawer", "hardware"],
    action: scroll("features")
  },
  {
    id: "pricing-starter",
    title: "Starter pricing",
    subtitle: "For independents and single venues",
    category: "Pricing",
    keywords: ["pricing", "starter", "plan", "trial"],
    action: { type: "pricing" }
  },
  {
    id: "pricing-growth",
    title: "Growth plan",
    subtitle: "Kitchen display and advanced permissions",
    category: "Pricing",
    keywords: ["growth", "pricing", "plan"],
    action: { type: "pricing" }
  },
  {
    id: "pricing-enterprise",
    title: "Enterprise pricing",
    subtitle: "Multi-site rollout and SLA",
    category: "Pricing",
    keywords: ["enterprise", "chains", "custom", "pricing"],
    action: { type: "pricing" }
  },
  {
    id: "free-trial",
    title: "Start free trial",
    subtitle: "Launch your first venue",
    category: "Pricing",
    keywords: ["trial", "signup", "start"],
    action: { type: "pricing" }
  },
  {
    id: "help-center",
    title: "Help center",
    subtitle: "Answers for operators and staff",
    category: "Support",
    keywords: ["help", "support", "faq"],
    action: scroll("faq")
  },
  {
    id: "product-guides",
    title: "Product guides",
    subtitle: "Step-by-step operator articles",
    category: "Docs",
    keywords: ["guides", "articles", "learn", "docs"],
    action: { type: "how-it-works" }
  },
  {
    id: "migration",
    title: "Migration assistance",
    subtitle: "Move from POS or reservations safely",
    category: "Support",
    keywords: ["migration", "import", "switch", "pos"],
    action: { type: "external", url: "mailto:support@serveos.com?subject=ServeOS%20migration" }
  },
  {
    id: "training",
    title: "Training resources",
    subtitle: "Onboarding for teams and managers",
    category: "Support",
    keywords: ["training", "onboarding", "learn"],
    action: scroll("faq")
  },
  {
    id: "contact-support",
    title: "Contact support",
    subtitle: "Email support@serveos.com",
    category: "Support",
    keywords: ["contact", "support", "help", "email"],
    action: { type: "external", url: "mailto:support@serveos.com" }
  },
  {
    id: "book-demo",
    title: "Book a demo",
    subtitle: "Walkthrough with our team",
    category: "Support",
    keywords: ["demo", "sales", "book"],
    action: { type: "mailto" }
  },
  {
    id: "blog",
    title: "Blog",
    subtitle: "Product and industry articles",
    category: "Docs",
    keywords: ["blog", "articles", "news"],
    action: scroll("faq")
  },
  {
    id: "case-studies",
    title: "Case studies",
    subtitle: "Operator success stories",
    category: "Docs",
    keywords: ["case", "studies", "customers"],
    action: scroll("faq")
  },
  {
    id: "restaurant-guides",
    title: "Restaurant guides",
    subtitle: "Best practices for modern venues",
    category: "Docs",
    keywords: ["guides", "restaurant", "playbooks"],
    action: scroll("faq")
  },
  {
    id: "about",
    title: "About ServeOS",
    subtitle: "Company and mission",
    category: "Company",
    keywords: ["about", "company", "serveos"],
    action: scroll("final-cta")
  },
  {
    id: "partners-company",
    title: "Partners program",
    subtitle: "Technology and reseller partners",
    category: "Company",
    keywords: ["partners", "reseller", "program"],
    action: scroll("faq")
  },
  {
    id: "privacy",
    title: "Privacy policy",
    subtitle: "Data handling and rights",
    category: "Company",
    keywords: ["privacy", "legal", "gdpr"],
    action: { type: "legal", slug: "privacy" }
  },
  {
    id: "terms",
    title: "Terms of service",
    subtitle: "Platform usage terms",
    category: "Company",
    keywords: ["terms", "legal", "service"],
    action: { type: "legal", slug: "terms" }
  },
  {
    id: "security-compliance",
    title: "Security & compliance",
    subtitle: "Controls for enterprise operators",
    category: "Company",
    keywords: ["security", "compliance", "audit"],
    action: { type: "legal", slug: "security" }
  },
  {
    id: "legal-center",
    title: "Legal Center",
    subtitle: "All policies and agreements",
    category: "Company",
    keywords: ["legal", "dpa", "cookies", "policies"],
    action: { type: "legal", slug: "center" }
  },
  {
    id: "enterprise-solutions",
    title: "Enterprise solutions",
    subtitle: "Chains and multi-brand groups",
    category: "Features",
    keywords: ["enterprise", "chains", "groups"],
    action: scroll("pricing")
  },
  {
    id: "faq",
    title: "Frequently asked questions",
    subtitle: "Hardware, migration, and pricing answers",
    category: "Support",
    keywords: ["faq", "questions", "answers"],
    action: scroll("faq")
  }
];

function dedupeEntries(entries: MarketingSearchEntry[]): MarketingSearchEntry[] {
  const map = new Map<string, MarketingSearchEntry>();
  for (const e of entries) {
    if (!map.has(e.id)) map.set(e.id, e);
  }
  return [...map.values()];
}

function sortEntries(entries: MarketingSearchEntry[]): MarketingSearchEntry[] {
  return [...entries].sort((a, b) => {
    const cr = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    if (cr !== 0) return cr;
    return a.title.localeCompare(b.title);
  });
}

export const MARKETING_SEARCH_INDEX = sortEntries(dedupeEntries([...fromMenus(), ...PLATFORM_EXTRAS]));

export function filterMarketingSearch(query: string): MarketingSearchEntry[] {
  const all = MARKETING_SEARCH_INDEX;
  const q = query.trim().toLowerCase();
  if (!q) return all;

  return all.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.subtitle.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.keywords.some((k) => k.toLowerCase().includes(q))
  );
}

export type MarketingSearchGroup = {
  category: SearchResultCategory;
  items: MarketingSearchEntry[];
};

export function groupMarketingSearchByCategory(entries: MarketingSearchEntry[]): MarketingSearchGroup[] {
  const map = new Map<SearchResultCategory, MarketingSearchEntry[]>();

  for (const entry of entries) {
    const list = map.get(entry.category) ?? [];
    list.push(entry);
    map.set(entry.category, list);
  }

  const categories = Object.keys(CATEGORY_RANK) as SearchResultCategory[];
  return categories
    .filter((category) => map.has(category))
    .sort((a, b) => CATEGORY_RANK[a] - CATEGORY_RANK[b])
    .map((category) => ({ category, items: map.get(category)! }));
}
