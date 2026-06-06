import { iconPath } from "./assetPaths";

export type ProductSurfaceCard = {
  id: string;
  symbol: string;
  title: string;
  body: string;
  tags: string[];
  layoutClass: string;
  variant: "hero-dark" | "glass-light" | "kds" | "checkout" | "integrations";
  /** How screenshots are chosen — all from `/public/imgs` except integrations. */
  imageMode: "triple-random" | "single-random" | "checkout-fixed" | "kds-random" | "none";
  size?: "default" | "compact";
};

export const MOBILE_NESTED_CARDS: ProductSurfaceCard[] = [
  {
    id: "kds",
    symbol: "▣",
    title: "Kitchen Display System",
    body: "Live order queues built for speed. Every ticket updates instantly across the platform.",
    tags: ["Real-Time", "Kitchen", "Sync"],
    layoutClass: "",
    variant: "kds",
    imageMode: "kds-random",
    size: "compact"
  },
  {
    id: "checkout",
    symbol: "◎",
    title: "Checkout Screens",
    body: "Fast service at the counter, table, or pickup area.",
    tags: ["Counter", "Payments", "Pickup"],
    layoutClass: "",
    variant: "checkout",
    imageMode: "checkout-fixed",
    size: "compact"
  }
];

export const PRODUCT_ECOSYSTEM_CARDS: ProductSurfaceCard[] = [
  {
    id: "mobile",
    symbol: "📱",
    title: "Mobile App",
    body: "One app for guests, staff, and operators. Browse menus, place orders, manage shifts, track reservations, and communicate in real time — all from a role-aware mobile experience.",
    tags: ["Customer", "Staff", "Manager", "Real-Time"],
    layoutClass: "lg:col-span-7 lg:row-span-2 lg:row-start-1 lg:col-start-1",
    variant: "hero-dark",
    imageMode: "triple-random"
  },
  {
    id: "admin",
    symbol: "🖥",
    title: "Admin Dashboard",
    body: "Control menus, staff access, orders, payments, reservations, and restaurant settings from a single web-based command center.",
    tags: ["Multi-location", "Analytics", "Permissions", "Operations"],
    layoutClass: "lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:translate-y-2",
    variant: "glass-light",
    imageMode: "single-random"
  },
  {
    id: "integrations",
    symbol: "⬡",
    title: "Integrations",
    body: "Keep the hardware and services you already trust. ServeOS connects to your existing workflow instead of forcing a complete replacement.",
    tags: ["Stripe", "Swish", "Hardware", "API"],
    layoutClass: "lg:col-span-5 lg:col-start-8 lg:row-start-2",
    variant: "integrations",
    imageMode: "none",
    size: "compact"
  }
];

export type IntegrationPartner = {
  id: string;
  label: string;
  src?: string;
  text?: string;
};

export const INTEGRATION_PARTNERS: IntegrationPartner[] = [
  { id: "stripe", label: "Stripe", src: iconPath("online-payment.png") },
  { id: "swish", label: "Swish", text: "S" },
  { id: "apple", label: "Apple Pay", src: iconPath("apple-173-svgrepo-com.svg") },
  { id: "google", label: "Google Pay", src: iconPath("google-play-svgrepo-com.svg") },
  { id: "printers", label: "Printers", src: iconPath("check-out.png") },
  { id: "tablets", label: "Tablets", src: iconPath("monitor-display.png") },
  { id: "terminals", label: "Terminals", src: iconPath("staff-management.png") }
];
