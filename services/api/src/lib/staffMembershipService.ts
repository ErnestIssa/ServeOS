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
  loadRestaurantPolicy,
  requireActiveAdminAtVenue,
  requireActiveMembershipAtVenue
} from "./venueAccessGuard.js";
import type { MobileAuthContext } from "./mobileAuthContext.js";
import { logStaffAudit, listStaffAuditLogs } from "./staffAuditService.js";
import { loadMemberRuntime } from "./staffMemberRuntime.js";
import { revokeAllSessions } from "./account/sessionService.js";
import {
  assertActorCanManageTarget,
  assertAtLeastOneOwnerRemains,
  assertCallerCanGrantPermissions,
  assertCanEditTargetPermissions,
  assertNotSelf,
  buildMemberCapabilities,
  countActiveOwners,
  type StaffMemberCapabilities
} from "./staffTargetPolicy.js";
import {
  membershipRoleLabel,
  readUserDisplayName,
  resolveInviterAtRestaurant
} from "./userDisplayName.js";
import { buildStaffCapabilitySummary } from "./staffCapabilitySummary.js";
import { membershipRecoveryCutoff } from "./membershipLifecycle.js";

function removalRecoveryCutoff(): Date {
  return membershipRecoveryCutoff();
}

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
  const fullName = readUserDisplayName({
    email: m.user.email,
    signupProfile: m.user.signupProfile,
    accountFullName: m.user.accountProfile?.fullName
  });
  const capabilitySummary = buildStaffCapabilitySummary(m.role, permissions);

  return {
    id: m.id,
    userId: m.userId,
    role: m.role,
    status: m.status,
    permissions,
    permissionSummary: permissionSummary(permissions),
    capabilitySummary,
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
    devices: runtime.devices,
    capabilities: null as StaffMemberCapabilities | null
  };
}

function attachCapabilities(
  member: Awaited<ReturnType<typeof mapMember>>,
  params: {
    actorUserId: string;
    actorRole: Role;
    actorPermissions: string[];
    activeOwnerCount: number;
  }
) {
  return {
    ...member,
    capabilities: buildMemberCapabilities({
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      actorPermissions: params.actorPermissions,
      target: {
        id: member.id,
        userId: member.userId,
        role: member.role,
        status: member.status as import("@prisma/client").MembershipStatus
      },
      activeOwnerCount: params.activeOwnerCount
    })
  };
}

export async function listVenueStaff(prisma: PrismaClient, ctx: MobileAuthContext, restaurantId: string) {
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true }
  });
  const restaurantName = restaurant?.name ?? "Venue";

  const [activeMembers, pendingApprovalRows, pendingInvites, inviteHistory, recentlyRemovedRows] =
    await Promise.all([
    prisma.membership.findMany({
      where: { restaurantId, status: { in: ["ACTIVE", "SUSPENDED"] } },
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
    prisma.membership.findMany({
      where: { restaurantId, status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "desc" },
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
    }),
    prisma.staffInvitation.findMany({
      where: {
        restaurantId,
        OR: [{ status: { not: "PENDING" } }, { expiresAt: { lte: new Date() } }]
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        membership: { select: { id: true, status: true } }
      }
    }),
    prisma.membership.findMany({
      where: {
        restaurantId,
        status: "REMOVED",
        removedAt: { gte: removalRecoveryCutoff() }
      },
      orderBy: { removedAt: "desc" },
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
    })
  ]);

  const activeOwnerCount = await countActiveOwners(prisma, restaurantId);
  const mappedMembers = await Promise.all(
    activeMembers.map(async (m) => {
      const base = await mapMember(prisma, m, restaurantName);
      return attachCapabilities(base, {
        actorUserId: ctx.userId,
        actorRole: admin.role,
        actorPermissions: admin.permissions,
        activeOwnerCount
      });
    })
  );

  const pendingApprovals = await Promise.all(
    pendingApprovalRows.map(async (m) => {
      const base = await mapMember(prisma, m, restaurantName);
      return {
        membershipId: m.id,
        userId: m.userId,
        role: m.role,
        roleLabel: membershipRoleLabel(m.role),
        email: m.user.email,
        phone: m.user.phone,
        fullName: base.fullName,
        permissions: base.permissions,
        createdAt: m.createdAt.toISOString(),
        capabilities: buildMemberCapabilities({
          actorUserId: ctx.userId,
          actorRole: admin.role,
          actorPermissions: admin.permissions,
          target: {
            id: m.id,
            userId: m.userId,
            role: m.role,
            status: m.status
          },
          activeOwnerCount
        })
      };
    })
  );

  const historyRows = await Promise.all(
    inviteHistory.map(async (i) => {
      const inviter = i.invitedByUserId
        ? await resolveInviterAtRestaurant(prisma, {
            userId: i.invitedByUserId,
            restaurantId
          })
        : null;
      const effectiveStatus =
        i.status === "PENDING" && i.expiresAt <= new Date() ? "EXPIRED" : i.status;
      return {
        id: i.id,
        fullName: i.fullName,
        email: i.email,
        phone: i.phone,
        intendedRole: i.intendedRole,
        roleLabel: membershipRoleLabel(i.intendedRole),
        status: effectiveStatus,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
        acceptedAt: i.acceptedAt?.toISOString() ?? null,
        invitedByName: inviter?.name ?? null,
        invitedByRole: inviter?.roleLabel ?? null,
        membershipId: i.membership?.id ?? null,
        membershipStatus: i.membership?.status ?? null
      };
    })
  );

  const recentlyRemoved = await Promise.all(
    recentlyRemovedRows.map(async (m) => {
      const base = await mapMember(prisma, m, restaurantName);
      return {
        membershipId: m.id,
        userId: m.userId,
        role: m.role,
        roleLabel: membershipRoleLabel(m.role),
        email: m.user.email,
        phone: m.user.phone,
        fullName: base.fullName,
        removedAt: m.removedAt?.toISOString() ?? null,
        capabilities: buildMemberCapabilities({
          actorUserId: ctx.userId,
          actorRole: admin.role,
          actorPermissions: admin.permissions,
          target: {
            id: m.id,
            userId: m.userId,
            role: m.role,
            status: m.status
          },
          activeOwnerCount
        })
      };
    })
  );

  return {
    members: mappedMembers,
    pendingApprovals,
    recentlyRemoved,
    pendingInvitations: pendingInvites.map((i) => ({
      id: i.id,
      fullName: i.fullName,
      email: i.email,
      phone: i.phone,
      intendedRole: i.intendedRole,
      roleLabel: membershipRoleLabel(i.intendedRole),
      permissions: resolveMembershipPermissions(i.intendedRole, i.permissions),
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString()
    })),
    inviteHistory: historyRows
  };
}

export async function getMembershipDetail(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string
) {
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);

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

  const activeOwnerCount = await countActiveOwners(prisma, restaurantId);
  const member = attachCapabilities(await mapMember(prisma, m, m.restaurant.name), {
    actorUserId: ctx.userId,
    actorRole: admin.role,
    actorPermissions: admin.permissions,
    activeOwnerCount
  });
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

  assertActorCanManageTarget(admin, m, ctx.userId);
  assertNotSelf(ctx.userId, m.userId, "cannot_approve_self");
  if (m.role === "OWNER" && admin.role !== "OWNER") {
    throw Object.assign(new Error("manager_cannot_manage_role"), { statusCode: 403 });
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
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId, status: "PENDING_APPROVAL" }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });
  assertActorCanManageTarget(admin, m, ctx.userId);
  assertNotSelf(ctx.userId, m.userId, "cannot_reject_self");
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
  assertActorCanManageTarget(admin, m, ctx.userId);
  assertNotSelf(ctx.userId, m.userId, "cannot_suspend_self");
  await assertAtLeastOneOwnerRemains(prisma, restaurantId, m.id, m.role);

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
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId, status: "SUSPENDED" }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });
  assertActorCanManageTarget(admin, m, ctx.userId);
  assertNotSelf(ctx.userId, m.userId, "cannot_activate_self");

  await prisma.membership.update({
    where: { id: m.id },
    data: { status: "ACTIVE", suspendedAt: null, removedAt: null }
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

export async function restoreMembership(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string
) {
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const m = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      restaurantId,
      status: "REMOVED",
      removedAt: { gte: removalRecoveryCutoff() }
    }
  });
  if (!m) throw Object.assign(new Error("membership_restore_expired"), { statusCode: 404 });
  assertActorCanManageTarget(admin, m, ctx.userId);
  assertNotSelf(ctx.userId, m.userId, "cannot_restore_self");

  await prisma.membership.update({
    where: { id: m.id },
    data: { status: "ACTIVE", removedAt: null, suspendedAt: null }
  });

  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "MEMBERSHIP_RESTORED",
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
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const m = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      restaurantId,
      status: { in: ["ACTIVE", "SUSPENDED"] }
    }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });
  assertActorCanManageTarget(admin, m, ctx.userId);
  assertNotSelf(ctx.userId, m.userId, "cannot_remove_self");
  await assertAtLeastOneOwnerRemains(prisma, restaurantId, m.id, m.role);

  await prisma.membership.update({
    where: { id: m.id },
    data: { status: "REMOVED", removedAt: new Date(), suspendedAt: null }
  });

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
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId, status: { in: ["ACTIVE", "PENDING_APPROVAL"] } }
  });
  if (!m) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });
  assertCanEditTargetPermissions(admin, m, ctx.userId);

  const keys = validatePermissionKeys(permissions);
  assertCallerCanGrantPermissions(admin.role, admin.permissions, keys);
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
