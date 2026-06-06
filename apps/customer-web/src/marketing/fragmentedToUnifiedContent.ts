import { iconPath } from "./assetPaths";

export type FragmentedTool = {
  id: string;
  label: string;
  iconSrc?: string;
  symbol?: string;
  x: number;
  y: number;
  floatClass: string;
  rotate: number;
  /** Curvature factor for the flow line toward ServeOS (-1 … 1). */
  pathBend: number;
};

export const FRAGMENTED_TOOLS: FragmentedTool[] = [
  {
    id: "pos",
    label: "POS",
    iconSrc: iconPath("check-out.png"),
    x: 0,
    y: 4,
    floatClass: "ftu-float-a",
    rotate: -6,
    pathBend: 0.55
  },
  {
    id: "reservations",
    label: "Reservations",
    iconSrc: iconPath("reservation-system-svgrepo-com.svg"),
    x: 58,
    y: 0,
    floatClass: "ftu-float-b",
    rotate: 4,
    pathBend: -0.7
  },
  {
    id: "kds",
    label: "KDS",
    iconSrc: iconPath("monitor-display.png"),
    x: 10,
    y: 36,
    floatClass: "ftu-float-c",
    rotate: -3,
    pathBend: 0.35
  },
  {
    id: "staff",
    label: "Staff",
    iconSrc: iconPath("staff-management.png"),
    x: 62,
    y: 40,
    floatClass: "ftu-float-d",
    rotate: 7,
    pathBend: -0.45
  },
  {
    id: "loyalty",
    label: "Loyalty",
    symbol: "★",
    x: 0,
    y: 70,
    floatClass: "ftu-float-e",
    rotate: -5,
    pathBend: 0.8
  },
  {
    id: "payments",
    label: "Payments",
    iconSrc: iconPath("online-payment.png"),
    x: 38,
    y: 76,
    floatClass: "ftu-float-f",
    rotate: 3,
    pathBend: -0.25
  },
  {
    id: "analytics",
    label: "Analytics",
    symbol: "▤",
    x: 66,
    y: 68,
    floatClass: "ftu-float-g",
    rotate: -8,
    pathBend: -0.85
  },
  {
    id: "chat",
    label: "Chat",
    iconSrc: iconPath("application-customer-mobile-svgrepo-com.svg"),
    x: 24,
    y: 16,
    floatClass: "ftu-float-h",
    rotate: 5,
    pathBend: 0.6
  }
];
