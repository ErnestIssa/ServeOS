import type { Prisma, PrismaClient, Role } from "@prisma/client";
import {
  resolveMembershipPermissions,
  validatePermissionKeys,
  VENUE_PERMISSION,
  isAdminMembershipRole,
  PERMISSION_GROUPS
} from "./venuePermissions.js";
import {
  assertManagerSlotAvailable,
  assertSingleOwner,
  loadRestaurantPolicy,
  requireActiveAdminAtVenue,
  requireActiveMembershipAtVenue
} from "./venueAccessGuard.js";
import type { MobileAuthContext } from "./mobileAuthContext.js";
import { logStaffAudit, listStaffAuditLogs } from "./staffAuditService.js";
import { loadMemberRuntime } from "./staffMemberRuntime.js";

function readFullName(profile: unknown, accountFullName?: string | null): string | null {
  if (accountFullName?.trim()) return accountFullName.trim();
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  const n = (profile as Record<string, unknown>).fullName;
  return typeof n === "string" ? n : null;
}

function roleTemplateLabel(role: Role): string {
  if (role === "MANAGER") return "Venue manager";
  if (role === "KITCHEN") return "Kitchen";
  if (role === "CASHIER") return "Cashier";
  if (role === "OWNER") return "Owner";
  return "Floor staff";
}

function permissionSummary(permissions: string[]): string {
  const labels: string[] = [];
  if (permissions.some((p) => p.includes("staff"))) labels.push("Staff");
  if (permissions.includes(VENUE_PERMISSION.ordersView) || permissions.includes(VENUE_PERMISSION.ordersUpdateStatus)) {
    labels.push("Orders");
  }
  if (permissions.includes(VENUE_PERMISSION.kds) || permissions.includes(VENUE_PERMISSION.kitchenOverview)) {
    labels.push("Kitchen");
  }
  if (permissions.includes(VENUE_PERMISSION.tables) || permissions.includes(VENUE_PERMISSION.tablesMgmt)) {
    labels.push("Tables");
  }
  if (permissions.includes(VENUE_PERMISSION.checkout) || permissions.includes(VENUE_PERMISSION.paymentSettings)) {
    labels.push("Payments");
  }
  if (permissions.includes(VENUE_PERMISSION.menuEdit) || permissions.includes(VENUE_PERMISSION.menuView)) {
    labels.push("Menu");
  }
  if (permissions.includes(VENUE_PERMISSION.analytics)) labels.push("Analytics");
  return labels.length ? labels.join(" + ") : "Basic access";
}

async function mapMember(
  prisma: PrismaClient,
  m: {
    id: string;
    userId: string;
    restaurantId: string;
    role: Role;
    status: import("@prisma/client").MembershipStatus;
    permissions: unknown;
    approvedAt: Date | null;
    createdAt: Date;
    user: {
      email: string | null;
      phone: string | null;
      signupProfile: unknown;
      accountProfile: { fullName: string | null } | null;
    };
  },
  restaurantName: string
) {
  const permissions = resolveMembershipPermissions(m.role, m.permissions);
  const runtime = await loadMemberRuntime(prisma, m.userId, m.restaurantId, m.status);
  const fullName = readFullName(m.user.signupProfile, m.user.accountProfile?.fullName) ?? m.user.email ?? "Staff member";

  return {
    id: m.id,
    userId: m.userId,
    role: m.role,
    status: m.status,
    permissions,
    permissionSummary: permissionSummary(permissions),
    roleTemplate: roleTemplateLabel(m.role),
    email: m.user.email,
    phone: m.user.phone,
    fullName,
    approvedAt: m.approvedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    assignedLocations: [restaurantName],
    presence: runtime.presence,
    lastActiveAt: runtime.lastActiveAt,
    lastActiveLabel: runtime.lastActiveLabel,
    activeSessionsCount: runtime.activeSessionsCount,
    currentShift: runtime.currentShift,
    sessions: runtime.sessions,
    devices: runtime.devices
  };
}

export async function listVenueStaff(prisma: PrismaClient, ctx: MobileAuthContext, restaurantId: string) {
  await requireActiveAdminAtVenue(prisma, ctx, restaurantId);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true }
  });
  const restaurantName = restaurant?.name ?? "Venue";

  const [members, pendingInvites] = await Promise.all([
    prisma.membership.findMany({
      where: { restaurantId, status: { not: "REJECTED" } },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            signupProfile: true,
            accountProfile: { select: { fullName: true } }
          }
        }
      }
    }),
    prisma.staffInvitation.findMany({
      where: { restaurantId, status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const mappedMembers = await Promise.all(members.map((m) => mapMember(prisma, m, restaurantName)));

  return {
    members: mappedMembers,
    pendingApprovals: mappedMembers
      .filter((m) => m.status === "PENDING_APPROVAL")
      .map((m) => ({
        membershipId: m.id,
        userId: m.userId,
        role: m.role,
        email: m.email,
        fullName: m.fullName,
        permissions: m.permissions,
        createdAt: m.createdAt
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

export async function getMembershipDetail(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string
) {
  await requireActiveAdminAtVenue(prisma, ctx, restaurantId);

  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          signupProfile: true,
          accountProfile: { select: { fullName: true } }
        }
      },
      restaurant: { select: { name: true } }
    }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });

  const member = await mapMember(prisma, m, m.restaurant.name);
  const auditLogs = await listStaffAuditLogs(prisma, {
    restaurantId,
    targetMembershipId: membershipId,
    limit: 30
  });

  return {
    ok: true as const,
    member,
    permissionGroups: PERMISSION_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      keys: group.keys,
      enabled: group.keys.some((key) => member.permissions.includes(key))
    })),
    auditLogs
  };
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

  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "MEMBERSHIP_APPROVED",
    targetUserId: m.userId,
    targetMembershipId: m.id
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

  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "MEMBERSHIP_REJECTED",
    targetUserId: m.userId,
    targetMembershipId: m.id
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

  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "MEMBERSHIP_SUSPENDED",
    targetUserId: m.userId,
    targetMembershipId: m.id
  });

  return { ok: true as const };
}

export async function activateMembership(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string
) {
  await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId, status: "SUSPENDED" }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });

  await prisma.membership.update({
    where: { id: m.id },
    data: { status: "ACTIVE", suspendedAt: null }
  });

  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "MEMBERSHIP_ACTIVATED",
    targetUserId: m.userId,
    targetMembershipId: m.id
  });

  return { ok: true as const, status: "ACTIVE" };
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

  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "MEMBERSHIP_REMOVED",
    targetUserId: m.userId,
    targetMembershipId: m.id
  });

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

  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "PERMISSIONS_UPDATED",
    targetUserId: m.userId,
    targetMembershipId: m.id,
    metadata: { permissions: keys }
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
