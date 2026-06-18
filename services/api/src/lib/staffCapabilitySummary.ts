import type { Role } from "@prisma/client";
import { VENUE_PERMISSION } from "./venuePermissions.js";

export type CapabilityItem = { label: string; allowed: boolean };
export type CapabilityDomain = { domain: string; items: CapabilityItem[] };

type CatalogItem = { label: string; keys: string[] };

const CAPABILITY_CATALOG: Array<{ domain: string; items: CatalogItem[] }> = [
  {
    domain: "Operations",
    items: [
      { label: "View live orders", keys: [VENUE_PERMISSION.ordersView] },
      { label: "Update order status", keys: [VENUE_PERMISSION.ordersUpdateStatus] },
      { label: "Manage reservations", keys: [VENUE_PERMISSION.reservations, VENUE_PERMISSION.reservationsMgmt] },
      { label: "Manage tables", keys: [VENUE_PERMISSION.tables, VENUE_PERMISSION.tablesMgmt] }
    ]
  },
  {
    domain: "Kitchen",
    items: [
      { label: "View kitchen tickets", keys: [VENUE_PERMISSION.kds, VENUE_PERMISSION.kitchenOverview] },
      { label: "Mark orders ready", keys: [VENUE_PERMISSION.ordersUpdateStatus, VENUE_PERMISSION.kds] }
    ]
  },
  {
    domain: "Payments",
    items: [
      { label: "Process checkout", keys: [VENUE_PERMISSION.checkout] },
      { label: "Manage payment settings", keys: [VENUE_PERMISSION.paymentSettings] }
    ]
  },
  {
    domain: "Menu",
    items: [
      { label: "View menu", keys: [VENUE_PERMISSION.menuView] },
      { label: "Edit menu", keys: [VENUE_PERMISSION.menuEdit] }
    ]
  },
  {
    domain: "Staff",
    items: [
      { label: "Invite team members", keys: [VENUE_PERMISSION.staffInvite] },
      { label: "Approve staff access", keys: [VENUE_PERMISSION.staffApprove] },
      { label: "Manage staff", keys: [VENUE_PERMISSION.staffMgmt, VENUE_PERMISSION.staffPermissionsEdit] }
    ]
  },
  {
    domain: "Management",
    items: [
      { label: "View analytics", keys: [VENUE_PERMISSION.analytics, VENUE_PERMISSION.revenue] },
      { label: "Manage billing", keys: [VENUE_PERMISSION.billing] },
      { label: "Configure restaurant", keys: [VENUE_PERMISSION.restaurantSettings, VENUE_PERMISSION.restaurantProfile] }
    ]
  }
];

function hasAny(permissions: Set<string>, keys: string[]): boolean {
  return keys.some((k) => permissions.has(k));
}

/** Human-readable capability summary — never exposes raw permission keys. */
export function buildStaffCapabilitySummary(role: Role, permissions: string[]): CapabilityDomain[] {
  if (role === "OWNER") {
    return [
      {
        domain: "Access",
        items: [{ label: "Full venue access", allowed: true }]
      }
    ];
  }

  const held = new Set(permissions);
  const domains: CapabilityDomain[] = [];

  for (const group of CAPABILITY_CATALOG) {
    const items = group.items.map((item) => ({
      label: item.label,
      allowed: hasAny(held, item.keys)
    }));
    if (items.some((i) => i.allowed) || group.domain === "Staff" || group.domain === "Menu") {
      domains.push({ domain: group.domain, items });
    }
  }

  return domains;
}
