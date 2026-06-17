import { randomBytes } from "node:crypto";
import type { PrismaClient, Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import {
  defaultPermissionsForRole,
  INVITABLE_OPERATIONAL_ROLES,
  validatePermissionKeys,
  VENUE_PERMISSION
} from "./venuePermissions.js";
import {
  assertCanInviteManager,
  assertManagerSlotAvailable,
  loadRestaurantPolicy,
  requireActiveAdminAtVenue,
  type ActiveVenueMembership
} from "./venueAccessGuard.js";
import type { MobileAuthContext } from "./mobileAuthContext.js";
import { logStaffAudit } from "./staffAuditService.js";
import { buildWorkspaceInviteAcceptUrl, completeWorkspaceEnrollment, hashInviteToken } from "./workspaceEnrollmentService.js";

const INVITE_TTL_DAYS = 14;

function hashToken(token: string): string {
  return hashInviteToken(token);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildInvitationAcceptUrl(token: string): string {
  return buildWorkspaceInviteAcceptUrl(token);
}

export type CreateInvitationInput = {
  fullName: string;
  email: string;
  phone?: string;
  intendedRole: Role;
  permissions?: string[];
};

export async function createStaffInvitation(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  input: CreateInvitationInput
): Promise<{ invitationId: string; token: string; expiresAt: Date; acceptUrl: string }> {
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const policy = await loadRestaurantPolicy(prisma, restaurantId);
  const role = input.intendedRole;

  if (role === "OWNER") {
    throw Object.assign(new Error("cannot_invite_owner"), { statusCode: 400 });
  }

  if (role === "MANAGER") {
    await assertCanInviteManager(prisma, admin, policy);
    await assertManagerSlotAvailable(prisma, restaurantId, policy);
  } else if (!INVITABLE_OPERATIONAL_ROLES.includes(role)) {
    throw Object.assign(new Error("invalid_invite_role"), { statusCode: 400 });
  }

  const email = normalizeEmail(input.email);
  const perms =
    input.permissions && input.permissions.length > 0
      ? validatePermissionKeys(input.permissions)
      : defaultPermissionsForRole(role);

  if (role === "MANAGER") {
    perms.push(
      ...[VENUE_PERMISSION.staffInvite, VENUE_PERMISSION.staffApprove, VENUE_PERMISSION.staffMgmt].filter(
        (p) => !perms.includes(p)
      )
    );
  }

  const pendingInvite = await prisma.staffInvitation.findFirst({
    where: {
      restaurantId,
      email,
      status: "PENDING",
      expiresAt: { gt: new Date() }
    }
  });
  if (pendingInvite) {
    throw Object.assign(new Error("invitation_already_pending"), { statusCode: 409 });
  }

  const existingUser = await prisma.user.findFirst({
    where: { email },
    select: { id: true }
  });
  if (existingUser) {
    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId: existingUser.id,
        restaurantId,
        status: { in: ["ACTIVE", "PENDING_APPROVAL", "SUSPENDED"] }
      }
    });
    if (existingMembership) {
      throw Object.assign(new Error("staff_already_active"), { statusCode: 409 });
    }
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await prisma.staffInvitation.create({
    data: {
      restaurantId,
      fullName: input.fullName.trim(),
      email,
      phone: input.phone?.trim() || null,
      intendedRole: role,
      permissions: perms as Prisma.InputJsonValue,
      tokenHash: hashToken(token),
      expiresAt,
      invitedByUserId: ctx.userId
    }
  });

  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "INVITE_SENT",
    metadata: {
      invitationId: invitation.id,
      email,
      intendedRole: role
    }
  });

  return {
    invitationId: invitation.id,
    token,
    expiresAt,
    acceptUrl: buildInvitationAcceptUrl(token)
  };
}

export async function previewInvitation(prisma: PrismaClient, token: string) {
  const row = await prisma.staffInvitation.findUnique({
    where: { tokenHash: hashToken(token.trim()) },
    include: { restaurant: { select: { id: true, name: true } } }
  });
  if (!row) return { ok: false as const, error: "invalid_token" };
  if (row.status !== "PENDING") return { ok: false as const, error: "invitation_not_pending" };
  if (row.expiresAt < new Date()) {
    await prisma.staffInvitation.update({
      where: { id: row.id },
      data: { status: "EXPIRED" }
    });
    return { ok: false as const, error: "invitation_expired" };
  }
  return {
    ok: true as const,
    invitation: {
      id: row.id,
      restaurantId: row.restaurantId,
      restaurantName: row.restaurant.name,
      fullName: row.fullName,
      email: row.email,
      intendedRole: row.intendedRole,
      expiresAt: row.expiresAt.toISOString()
    }
  };
}

export async function acceptStaffInvitation(
  prisma: PrismaClient,
  input: {
    token: string;
    passwordHash: string;
    email?: string;
    phone?: string;
    fullName?: string;
  }
): Promise<{ userId: string; membershipId: string; restaurantId: string }> {
  const result = await completeWorkspaceEnrollment(prisma, {
    token: input.token,
    action: "create_account",
    passwordHash: input.passwordHash,
    phone: input.phone,
    fullName: input.fullName
  });
  return {
    userId: result.userId,
    membershipId: result.membershipId,
    restaurantId: result.restaurantId
  };
}

export async function cancelStaffInvitation(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  invitationId: string
): Promise<void> {
  await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const inv = await prisma.staffInvitation.findFirst({
    where: { id: invitationId, restaurantId, status: "PENDING" }
  });
  if (!inv) throw Object.assign(new Error("invitation_not_found"), { statusCode: 404 });
  await prisma.staffInvitation.update({
    where: { id: inv.id },
    data: { status: "CANCELLED" }
  });

  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "INVITE_CANCELLED",
    metadata: { invitationId: inv.id, email: inv.email }
  });
}
