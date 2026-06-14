import { getWebAdminUrl } from "../bootstrap/clientConfig";

/** In-app admin dashboard route on customer-web (default when separate web-admin URL is unset). */
export const ADMIN_APP_PATH = "/admin";
/** Placeholder until the dedicated policy page ships. */
export const PRIVACY_POLICY_PATH = "/privacy";
/** Placeholder until the dedicated terms page ships. */
export const TERMS_OF_SERVICE_PATH = "/terms";
/** Placeholder until the pre-business onboarding page ships. */
export const NO_BUSINESS_YET_PATH = "/no-business-yet";
export const DEMO_MAILTO = "mailto:hello@serveos.com?subject=ServeOS%20demo%20request";

/** Backend-driven URL from `GET /config/client` (not frontend env). */
export function webAdminUrl(): string {
  return getWebAdminUrl();
}

export const TAGLINE = "One platform. Every restaurant operation. Connected in real time.";

export const SERVEOS_FLOW = [
  "Customer",
  "Reservation",
  "Order",
  "Kitchen",
  "Checkout",
  "Payment",
  "Analytics"
] as const;

export const ECOSYSTEM_STACK = [
  "Dashboard",
  "Orders",
  "Kitchen screen",
  "Checkout",
  "Customer mobile"
] as const;

export const CONNECTED_MODULES = [
  {
    id: "orders",
    title: "Orders",
    icon: "◎",
    body: "Real-time order flow from dine-in, takeaway, delivery, and more — one live stream for the whole venue."
  },
  {
    id: "reservations",
    title: "Reservations",
    icon: "◷",
    body: "Bookings, waitlists, table context, and guest profiles connected to service and kitchen."
  },
  {
    id: "kitchen",
    title: "Kitchen",
    icon: "▣",
    body: "KDS tickets and prep workflows synchronized with the floor the moment orders confirm."
  },
  {
    id: "payments",
    title: "Payments",
    icon: "◇",
    body: "Stripe, Swish, and terminal workflows tied to orders and reporting in one financial layer."
  },
  {
    id: "staff",
    title: "Staff",
    icon: "◆",
    body: "Roles, permissions, and accountability across managers, kitchen, and front-of-house."
  },
  {
    id: "cx",
    title: "Customer Experience",
    icon: "✦",
    body: "Menus, ordering, chat, and reservations in one connected guest journey."
  }
] as const;

export const PRODUCT_SURFACES = [
  { title: "Mobile app", body: "Staff operations and guest ordering in one installable experience." },
  { title: "Admin dashboard", body: "Menus, staff, orders, and venue control from the web." },
  { title: "Kitchen display", body: "Preparation workflow built for speed and clarity." },
  { title: "Checkout screens", body: "Fast handoff at counter and table." },
  { title: "Integrations", body: "Work with the hardware and payment stack you already use." }
] as const;

export const PRICING_TIERS = [
  {
    name: "Venue",
    for: "Single-location restaurants, cafés, and food trucks",
    price: "1 990 kr",
    period: "/month",
    featured: false,
    highlights: ["Orders & kitchen flow", "Reservations", "Staff access", "14-day trial"]
  },
  {
    name: "Multi",
    for: "Growing brands with multiple venues",
    price: "4 990 kr",
    period: "/month",
    featured: true,
    highlights: ["Everything in Venue", "Multi-location switching", "Shared reporting", "Priority onboarding"]
  },
  {
    name: "Network",
    for: "Chains and hotel F&B groups",
    price: "Custom",
    period: "",
    featured: false,
    highlights: ["Enterprise permissions", "Audit & export", "Dedicated support", "Custom hardware rollout"]
  }
] as const;

export const INDUSTRIES = [
  { title: "Restaurants", body: "Full-service dining with reservations, orders, and floor coordination." },
  { title: "Cafés", body: "Quick turnover, simple menus, and line-busting mobile order flow." },
  { title: "Food trucks", body: "One venue, fast status updates, and portable team tools." },
  { title: "Bars", body: "Tabs, kitchen handoff, and peak-hour order visibility." },
  { title: "Hotels", body: "F&B outlets with shared staff access and multi-venue reporting." },
  { title: "Chains", body: "Consistent operations and permissions across every location." }
] as const;

export const FAQ_ITEMS = [
  {
    q: "Can I keep my current payment terminal?",
    a: "Yes. ServeOS integrates with Stripe, Swish, and common terminal workflows so you are not forced into a single hardware vendor."
  },
  {
    q: "Can I use my own checkout hardware?",
    a: "ServeOS is built to sit alongside your existing checkout screens and POS where needed — one data layer, flexible frontends."
  },
  {
    q: "Can I migrate from another system?",
    a: "We support phased migration: menu and staff first, then orders and reservations, so you never run a blank switchover night."
  },
  {
    q: "Does ServeOS support multiple locations?",
    a: "Enterprise plans include multi-venue permissions, shared reporting, and location-scoped staff access."
  },
  {
    q: "Do customers need to download an app?",
    a: "No. Guests can order via web or QR. The mobile app enhances loyalty and repeat visits but is not required to place an order."
  }
] as const;

export const TESTIMONIALS = [
  {
    quote: "We replaced three vendors in the first month. The kitchen finally sees the same order the floor does.",
    name: "Placeholder — Independent bistro",
    role: "Owner"
  },
  {
    quote: "Reservations and walk-ins stopped fighting each other. One timeline for the whole shift.",
    name: "Placeholder — City café group",
    role: "Operations manager"
  }
] as const;

export const HOW_IT_WORKS_FLOW = [
  { step: "Customer app", detail: "Guests browse, book, order, and message in context." },
  { step: "Orders hub", detail: "Every ticket is a live workspace — status, chat, and actions together." },
  { step: "Kitchen", detail: "KDS tickets update the moment the floor confirms." },
  { step: "Checkout", detail: "Handoff, payment, and receipt without re-keying." },
  { step: "Admin dashboard", detail: "Owners see menus, staff, revenue signals, and alerts in one place." }
] as const;
