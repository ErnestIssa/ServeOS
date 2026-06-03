import type { Prisma, PrismaClient } from "@prisma/client";
import {
  resolveMembershipPermissions,
  validatePermissionKeys,
  VENUE_PERMISSION,
  isAdminMembershipRole
} from "./venuePermissions.js";
import {
  assertManagerSlotAvailable,
  assertSingleOwner,
  loadRestaurantPolicy,
  requireActiveAdminAtVenue,
  requireActiveMembershipAtVenue
} from "./venueAccessGuard.js";
import type { MobileAuthContext } from "./mobileAuthContext.js";

export async function listVenueStaff(prisma: PrismaClient, ctx: MobileAuthContext, restaurantId: string) {
  await requireActiveAdminAtVenue(prisma, ctx, restaurantId);

  const [members, pendingInvites] = await Promise.all([
    prisma.membership.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, email: true, phone: true, signupProfile: true } }
      }
    }),
    prisma.staffInvitation.findMany({
      where: { restaurantId, status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return {
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      permissions: resolveMembershipPermissions(m.role, m.permissions),
      email: m.user.email,
      phone: m.user.phone,
      fullName: readFullName(m.user.signupProfile),
      approvedAt: m.approvedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString()
    })),
    pendingApprovals: members
      .filter((m) => m.status === "PENDING_APPROVAL")
      .map((m) => ({
        membershipId: m.id,
        userId: m.userId,
        role: m.role,
        email: m.user.email,
        fullName: readFullName(m.user.signupProfile),
        permissions: resolveMembershipPermissions(m.role, m.permissions),
        createdAt: m.createdAt.toISOString()
      })),
    pendingInvitations: pendingInvites.map((i) => ({
      id: i.id,
      fullName: i.fullName,
      email: i.email,
      phone: i.phone,
      intendedRole: i.intendedRole,
      permissions: resolveMembershipPermissions(i.intendedRole, i.permissions),
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString()
    }))
  };
}

function readFullName(profile: unknown): string | null {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  const n = (profile as Record<string, unknown>).fullName;
  return typeof n === "string" ? n : null;
}

export async function approveMembership(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string
) {
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  if (!admin.permissions.includes(VENUE_PERMISSION.staffApprove) && !isAdminMembershipRole(admin.role)) {
    throw Object.assign(new Error("permission_denied"), { statusCode: 403 });
  }

  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId, status: "PENDING_APPROVAL" }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });

  if (m.role === "OWNER") {
    await assertSingleOwner(prisma, restaurantId, m.id);
  }
  if (m.role === "MANAGER") {
    const policy = await loadRestaurantPolicy(prisma, restaurantId);
    await assertManagerSlotAvailable(prisma, restaurantId, policy);
  }

  await prisma.membership.update({
    where: { id: m.id },
    data: {
      status: "ACTIVE",
      approvedByUserId: ctx.userId,
      approvedAt: new Date()
    }
  });

  return { ok: true as const, membershipId: m.id, status: "ACTIVE" };
}

export async function rejectMembership(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string
) {
  await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId, status: "PENDING_APPROVAL" }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });
  await prisma.membership.update({
    where: { id: m.id },
    data: { status: "REJECTED", rejectedAt: new Date() }
  });
  return { ok: true as const };
}

export async function suspendMembership(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string
) {
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId, status: "ACTIVE" }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });
  if (m.role === "OWNER") throw Object.assign(new Error("cannot_suspend_owner"), { statusCode: 400 });
  if (m.userId === ctx.userId) throw Object.assign(new Error("cannot_suspend_self"), { statusCode: 400 });

  await prisma.membership.update({
    where: { id: m.id },
    data: { status: "SUSPENDED", suspendedAt: new Date() }
  });
  return { ok: true as const };
}

export async function removeMembership(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string
) {
  await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });
  if (m.role === "OWNER") throw Object.assign(new Error("cannot_remove_owner"), { statusCode: 400 });

  await prisma.membership.delete({ where: { id: m.id } });
  return { ok: true as const };
}

export async function updateMembershipPermissions(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string,
  permissions: string[]
) {
  await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId, status: { in: ["ACTIVE", "PENDING_APPROVAL"] } }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });
  if (m.role === "OWNER") throw Object.assign(new Error("cannot_edit_owner_permissions"), { statusCode: 400 });

  const keys = validatePermissionKeys(permissions);
  await prisma.membership.update({
    where: { id: m.id },
    data: { permissions: keys as Prisma.InputJsonValue }
  });
  return { ok: true as const, permissions: keys };
}

export async function updateRestaurantAccessPolicy(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  policy: { maxManagers?: number; allowManagersToInviteManagers?: boolean }
) {
  const admin = await requireActiveMembershipAtVenue(prisma, ctx, restaurantId);
  if (admin.role !== "OWNER") {
    throw Object.assign(new Error("owner_only"), { statusCode: 403 });
  }
  const current = await loadRestaurantPolicy(prisma, restaurantId);
  const next = {
    maxManagers:
      typeof policy.maxManagers === "number" && policy.maxManagers >= 0
        ? Math.floor(policy.maxManagers)
        : current.maxManagers,
    allowManagersToInviteManagers:
      typeof policy.allowManagersToInviteManagers === "boolean"
        ? policy.allowManagersToInviteManagers
        : current.allowManagersToInviteManagers
  };
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { accessPolicy: next as Prisma.InputJsonValue }
  });
  return { ok: true as const, accessPolicy: next };
}
