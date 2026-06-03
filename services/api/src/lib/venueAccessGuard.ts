import type { PrismaClient, Role } from "@prisma/client";
import type { MobileAuthContext } from "./mobileAuthContext.js";
import { isAdminMembershipRole, canManageStaff, VENUE_PERMISSION } from "./venuePermissions.js";
import { readRestaurantAccessPolicy, type RestaurantAccessPolicy } from "./venueAccessPolicy.js";

export type ActiveVenueMembership = {
  id: string;
  restaurantId: string;
  role: Role;
  permissions: string[];
};

export async function loadRestaurantPolicy(
  prisma: PrismaClient,
  restaurantId: string
): Promise<RestaurantAccessPolicy> {
  const row = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { accessPolicy: true }
  });
  if (!row) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });
  return readRestaurantAccessPolicy(row.accessPolicy);
}

export async function requireActiveAdminAtVenue(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string
): Promise<ActiveVenueMembership> {
  const m = await requireActiveMembershipAtVenue(prisma, ctx, restaurantId);
  if (!isAdminMembershipRole(m.role)) {
    throw Object.assign(new Error("admin_only"), { statusCode: 403 });
  }
  return m;
}

export async function requireActiveMembershipAtVenue(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string
): Promise<ActiveVenueMembership> {
  const rid = restaurantId.trim();
  const row = await prisma.membership.findFirst({
    where: { userId: ctx.userId, restaurantId: rid, status: "ACTIVE" },
    select: { id: true, restaurantId: true, role: true, permissions: true }
  });
  if (!row) throw Object.assign(new Error("venue_access_denied"), { statusCode: 403 });
  const { resolveMembershipPermissions } = await import("./venuePermissions.js");
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    role: row.role,
    permissions: resolveMembershipPermissions(row.role, row.permissions)
  };
}

export function assertStaffManagementPermission(m: ActiveVenueMembership, perm: string): void {
  if (!canManageStaff(m.permissions) && !m.permissions.includes(perm)) {
    if (!m.permissions.includes(perm)) {
      throw Object.assign(new Error("permission_denied"), { statusCode: 403 });
    }
  }
}

export async function assertCanInviteManager(
  prisma: PrismaClient,
  admin: ActiveVenueMembership,
  policy: RestaurantAccessPolicy
): Promise<void> {
  if (admin.role === "OWNER") return;
  if (admin.role === "MANAGER" && policy.allowManagersToInviteManagers) {
    if (
      admin.permissions.includes(VENUE_PERMISSION.staffInviteManager) ||
      admin.permissions.includes(VENUE_PERMISSION.staffInvite)
    ) {
      return;
    }
  }
  throw Object.assign(new Error("only_owner_can_invite_manager"), { statusCode: 403 });
}

export async function assertManagerSlotAvailable(
  prisma: PrismaClient,
  restaurantId: string,
  policy: RestaurantAccessPolicy
): Promise<void> {
  const count = await prisma.membership.count({
    where: { restaurantId, role: "MANAGER", status: "ACTIVE" }
  });
  if (count >= policy.maxManagers) {
    throw Object.assign(new Error("manager_limit_reached"), { statusCode: 409 });
  }
}

export async function assertSingleOwner(
  prisma: PrismaClient,
  restaurantId: string,
  excludeMembershipId?: string
): Promise<void> {
  const owners = await prisma.membership.count({
    where: {
      restaurantId,
      role: "OWNER",
      status: "ACTIVE",
      ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {})
    }
  });
  if (owners > 1) {
    throw Object.assign(new Error("multiple_owners_not_allowed"), { statusCode: 409 });
  }
}
