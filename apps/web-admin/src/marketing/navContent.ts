import { DEMO_MAILTO, webAdminUrl } from "./constants";

export type NavAction =
  | { type: "scroll"; targetId: string }
  | { type: "how-it-works" }
  | { type: "pricing" }
  | { type: "external"; url: string }
  | { type: "mailto" };

export type NavLinkItem = {
  label: string;
  description?: string;
  action: NavAction;
  badge?: string;
};

export type NavMegaColumn = {
  title: string;
  items: NavLinkItem[];
};

export type NavMegaMenu = {
  id: string;
  label: string;
  columns: NavMegaColumn[];
};

export const NAV_MEGA_MENUS: NavMegaMenu[] = [
  {
    id: "platform",
    label: "Platform",
    columns: [
      {
        title: "Core operations",
        items: [
          { label: "Orders", description: "Live order queue and status", action: { type: "scroll", targetId: "features" } },
          { label: "Reservations", description: "Bookings, tables, waitlists", action: { type: "scroll", targetId: "features" } },
          { label: "Tables & waitlists", description: "Floor plan and queue", action: { type: "scroll", targetId: "features" } },
          { label: "Kitchen display (KDS)", description: "Ticket flow to the line", action: { type: "scroll", targetId: "features" } },
          { label: "Checkout screens", description: "Fast handoff at counter", action: { type: "scroll", targetId: "features" } }
        ]
      },
      {
        title: "Management",
        items: [
          { label: "Dashboard", description: "Venue pulse at a glance", action: { type: "scroll", targetId: "features" } },
          { label: "Staff management", description: "Roles, shifts, access", action: { type: "scroll", targetId: "features" } },
          { label: "Permissions", description: "Server-enforced RBAC", action: { type: "scroll", targetId: "features" } },
          { label: "Analytics", description: "Service and revenue insight", action: { type: "scroll", targetId: "features" } },
          { label: "Multi-location", description: "Groups and brands", action: { type: "scroll", targetId: "features" } }
        ]
      },
      {
        title: "Customer experience",
        items: [
          { label: "QR ordering", description: "Scan, browse, order", action: { type: "scroll", targetId: "features" } },
          { label: "Mobile app", description: "Guest and staff surfaces", action: { type: "scroll", targetId: "features" } },
          { label: "Customer chat", description: "In-context venue messaging", action: { type: "scroll", targetId: "features" } },
          { label: "Loyalty", description: "Rewards roadmap", action: { type: "scroll", targetId: "faq" }, badge: "Soon" },
          { label: "Guest profiles", description: "Preferences and history", action: { type: "scroll", targetId: "features" } }
        ]
      },
      {
        title: "Infrastructure",
        items: [
          { label: "Payments", description: "Stripe, Swish, terminals", action: { type: "scroll", targetId: "features" } },
          { label: "Notifications", description: "Ops and guest alerts", action: { type: "scroll", targetId: "features" } },
          { label: "Integrations", description: "Connect your stack", action: { type: "scroll", targetId: "features" } },
          { label: "Security", description: "Audit-ready controls", action: { type: "scroll", targetId: "faq" } }
        ]
      }
    ]
  },
  {
    id: "solutions",
    label: "Solutions",
    columns: [
      {
        title: "Restaurant types",
        items: [
          { label: "Restaurants", action: { type: "scroll", targetId: "solutions" } },
          { label: "Cafés", action: { type: "scroll", targetId: "solutions" } },
          { label: "Bars", action: { type: "scroll", targetId: "solutions" } },
          { label: "Food trucks", action: { type: "scroll", targetId: "solutions" } },
          { label: "Hotels", action: { type: "scroll", targetId: "solutions" } },
          { label: "Chains", action: { type: "scroll", targetId: "solutions" } }
        ]
      },
      {
        title: "Use cases",
        items: [
          { label: "Replace your POS", description: "One system instead of five", action: { type: "scroll", targetId: "features" } },
          { label: "Reservation management", action: { type: "scroll", targetId: "features" } },
          { label: "Kitchen operations", action: { type: "scroll", targetId: "features" } },
          { label: "Staff coordination", action: { type: "scroll", targetId: "features" } },
          { label: "Customer ordering", action: { type: "scroll", targetId: "features" } }
        ]
      }
    ]
  },
  {
    id: "hardware",
    label: "Hardware",
    columns: [
      {
        title: "Displays",
        items: [
          { label: "Kitchen displays", action: { type: "scroll", targetId: "features" } },
          { label: "Customer displays", action: { type: "scroll", targetId: "features" } },
          { label: "Order status screens", action: { type: "scroll", targetId: "features" } }
        ]
      },
      {
        title: "Checkout",
        items: [
          { label: "Quick checkout screens", action: { type: "scroll", targetId: "features" } },
          { label: "Self-service kiosks", action: { type: "scroll", targetId: "faq" }, badge: "Soon" },
          { label: "Payment terminals", action: { type: "scroll", targetId: "features" } }
        ]
      },
      {
        title: "Bring your own hardware",
        items: [
          { label: "Existing tablets", action: { type: "scroll", targetId: "features" } },
          { label: "Existing monitors", action: { type: "scroll", targetId: "features" } },
          { label: "Existing POS devices", action: { type: "scroll", targetId: "features" } }
        ]
      },
      {
        title: "Integrations",
        items: [
          { label: "Stripe", action: { type: "scroll", targetId: "features" } },
          { label: "Swish", action: { type: "scroll", targetId: "features" } },
          { label: "Receipt printers", action: { type: "scroll", targetId: "features" } },
          { label: "Cash drawers", action: { type: "scroll", targetId: "features" } }
        ]
      }
    ]
  },
  {
    id: "resources",
    label: "Resources",
    columns: [
      {
        title: "Learn",
        items: [
          { label: "How ServeOS works", action: { type: "how-it-works" } },
          { label: "Documentation", action: { type: "scroll", targetId: "faq" } },
          { label: "Integrations", action: { type: "scroll", targetId: "features" } }
        ]
      },
      {
        title: "Business",
        items: [
          { label: "Blog", action: { type: "scroll", targetId: "faq" } },
          { label: "Case studies", action: { type: "scroll", targetId: "faq" } },
          { label: "Restaurant guides", action: { type: "scroll", targetId: "faq" } }
        ]
      },
      {
        title: "Company",
        items: [
          { label: "About", action: { type: "scroll", targetId: "final-cta" } },
          { label: "Contact", action: { type: "mailto" } }
        ]
      }
    ]
  }
];

export type { MarketingSearchEntry, SearchResultCategory } from "./marketingSearchIndex";
export { MARKETING_SEARCH_INDEX, filterMarketingSearch } from "./marketingSearchIndex";

export const LOGIN_OPTIONS = [
  {
    id: "customer",
    label: "Customer",
    description: "Order, book, and chat with venues",
    href: undefined as string | undefined
  },
  {
    id: "staff",
    label: "Restaurant staff",
    description: "Orders, tasks, and floor operations",
    href: webAdminUrl() || undefined
  },
  {
    id: "admin",
    label: "Restaurant admin",
    description: "Dashboard, menu, and venue control",
    href: webAdminUrl() || undefined
  }
] as const;

export { DEMO_MAILTO };
