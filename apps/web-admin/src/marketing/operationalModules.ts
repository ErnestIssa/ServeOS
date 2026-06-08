import { iconPath } from "./assetPaths";

export type OperationalModule = {
  id: string;
  symbol: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  iconSrc: string;
};

export const OPERATIONAL_MODULES: OperationalModule[] = [
  {
    id: "orders",
    symbol: "◎",
    title: "Orders",
    subtitle: "The heartbeat of daily operations",
    description:
      "Manage dine-in, takeaway, pickup, delivery, and future ordering channels from one live order stream. Every status update, payment event, kitchen action, and customer interaction stays synchronized across the entire restaurant.",
    highlights: [
      "Real-time order flow",
      "Live status updates",
      "Order-to-kitchen routing",
      "Customer communication",
      "Multi-channel support"
    ],
    iconSrc: iconPath("check-out.png")
  },
  {
    id: "reservations",
    symbol: "◷",
    title: "Reservations",
    subtitle: "From booking to arrival",
    description:
      "Reservations are more than calendar entries. Track guest preferences, table assignments, waitlists, visit history, and upcoming arrivals from a single reservation system designed to work with the rest of your operations.",
    highlights: ["Table management", "Waitlists", "Guest profiles", "Visit context", "Capacity controls"],
    iconSrc: iconPath("reservation-system-svgrepo-com.svg")
  },
  {
    id: "kitchen",
    symbol: "▣",
    title: "Kitchen",
    subtitle: "A live command center for food preparation",
    description:
      "Every ticket reaches the kitchen instantly. Staff see the same information as the front of house, reducing delays, mistakes, and communication gaps while keeping preparation synchronized in real time.",
    highlights: [
      "Kitchen display screens",
      "Live ticket updates",
      "Station workflows",
      "Order prioritization",
      "Real-time synchronization"
    ],
    iconSrc: iconPath("monitor-display.png")
  },
  {
    id: "payments",
    symbol: "◇",
    title: "Payments",
    subtitle: "Every transaction connected",
    description:
      "Whether you use Stripe, Swish, existing terminals, or future payment providers, transactions remain linked to orders, reservations, staff activity, and reporting from a single financial source of truth.",
    highlights: [
      "Stripe support",
      "Swish support",
      "Existing terminal integrations",
      "Unified transaction records",
      "Centralized payment visibility"
    ],
    iconSrc: iconPath("online-payment.png")
  },
  {
    id: "staff",
    symbol: "◆",
    title: "Staff",
    subtitle: "Structure, permissions, and accountability",
    description:
      "Manage access across managers, kitchen teams, cashiers, and operational staff with server-controlled permissions. Every action is tracked, every role is enforced, and every employee sees only what they need.",
    highlights: [
      "Role management",
      "Granular permissions",
      "Staff invitations",
      "Shift operations",
      "Activity tracking"
    ],
    iconSrc: iconPath("staff-management.png")
  },
  {
    id: "cx",
    symbol: "✦",
    title: "Customer Experience",
    subtitle: "Every guest interaction connected",
    description:
      "Menus, reservations, ordering, chat, notifications, and future loyalty programs all operate through the same customer journey. Guests experience one seamless flow while your team works from one connected system.",
    highlights: [
      "Digital menus",
      "Mobile ordering",
      "Reservation journeys",
      "In-context messaging",
      "Loyalty-ready foundation"
    ],
    iconSrc: iconPath("application-customer-mobile-svgrepo-com.svg")
  }
];
