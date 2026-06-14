import type { PrismaClient } from "@prisma/client";
import { PERMISSION_GROUPS, resolveMembershipPermissions } from "../venuePermissions.js";

const PERMISSION_LABELS: Record<string, string> = {
  "admin.billing": "Billing",
  "admin.staff_management": "Staff management",
  "admin.staff_invite": "Invite staff",
  "admin.devices": "Devices",
  "admin.analytics": "Analytics",
  "admin.restaurant_settings": "Settings",
  "admin.menu": "Menu",
  "admin.dashboard": "Dashboard",
  "admin.payment_settings": "Payments",
  "admin.integrations": "Integrations"
};

const HIGHLIGHT_KEYS = [
  "admin.billing",
  "admin.staff_management",
  "admin.devices",
  "admin.analytics",
  "admin.restaurant_settings"
];

export async function buildPermissionsOverview(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      memberships: {
        where: { status: "ACTIVE" },
        select: { role: true, permissions: true, restaurant: { select: { name: true } } },
        take: 1
      }
    }
  });
  if (!user) return null;

  const membership = user.memberships[0];
  const venueRole = membership?.role ?? user.role;
  const granted = membership
    ? resolveMembershipPermissions(membership.role, membership.permissions)
    : resolveMembershipPermissions(user.role, null);

  const highlights = HIGHLIGHT_KEYS.map((key) => ({
    key,
    label: PERMISSION_LABELS[key] ?? key,
    granted: granted.includes(key)
  }));

  const groups = PERMISSION_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    permissions: g.keys.map((key) => ({
      key,
      label: PERMISSION_LABELS[key] ?? key.replace(/^admin\.|^staff\./, "").replace(/_/g, " "),
      granted: granted.includes(key)
    }))
  }));

  return {
    platformRole: user.role,
    venueRole,
    venueName: membership?.restaurant.name ?? null,
    highlights,
    groups
  };
}
