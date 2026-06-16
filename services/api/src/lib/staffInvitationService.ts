import { createHash, randomBytes } from "node:crypto";
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

const INVITE_TTL_DAYS = 14;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildInvitationAcceptUrl(token: string): string {
  const base = process.env.SERVEOS_INVITE_BASE_URL?.trim() || "https://app.serveos.com/invite";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${encodeURIComponent(token)}`;
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
  const preview = await previewInvitation(prisma, input.token);
  if (!preview.ok) throw Object.assign(new Error(preview.error), { statusCode: 400 });

  const inv = await prisma.staffInvitation.findUnique({
    where: { tokenHash: hashToken(input.token.trim()) }
  });
  if (!inv || inv.status !== "PENDING") {
    throw Object.assign(new Error("invalid_token"), { statusCode: 400 });
  }

  const email = normalizeEmail(input.email ?? inv.email);
  if (email !== inv.email) {
    throw Object.assign(new Error("email_mismatch"), { statusCode: 400 });
  }

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, input.phone ? { phone: input.phone } : undefined].filter(Boolean) as any },
    select: { id: true }
  });

  return prisma.$transaction(async (tx) => {
    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      const dup = await tx.membership.findUnique({
        where: { userId_restaurantId: { userId, restaurantId: inv.restaurantId } }
      });
      if (dup && dup.status !== "REJECTED") {
        throw Object.assign(new Error("already_member"), { statusCode: 409 });
      }
    } else {
      const created = await tx.user.create({
        data: {
          email,
          phone: input.phone?.trim() || inv.phone,
          password: input.passwordHash,
          role: inv.intendedRole === "MANAGER" ? "MANAGER" : "STAFF",
          signupProfile: {
            fullName: (input.fullName ?? inv.fullName).trim(),
            invitedToRestaurantId: inv.restaurantId
          } as Prisma.InputJsonValue
        },
        select: { id: true }
      });
      userId = created.id;
    }

    const membership = await tx.membership.upsert({
      where: { userId_restaurantId: { userId, restaurantId: inv.restaurantId } },
      create: {
        userId,
        restaurantId: inv.restaurantId,
        role: inv.intendedRole,
        status: "PENDING_APPROVAL",
        permissions: inv.permissions as Prisma.InputJsonValue,
        invitedByUserId: inv.invitedByUserId,
        staffInvitationId: inv.id
      },
      update: {
        role: inv.intendedRole,
        status: "PENDING_APPROVAL",
        permissions: inv.permissions as Prisma.InputJsonValue,
        invitedByUserId: inv.invitedByUserId,
        staffInvitationId: inv.id,
        rejectedAt: null,
        suspendedAt: null
      }
    });

    await tx.staffInvitation.update({
      where: { id: inv.id },
      data: {
        status: "ACCEPTED",
        acceptedByUserId: userId,
        acceptedAt: new Date()
      }
    });

    return { userId, membershipId: membership.id, restaurantId: inv.restaurantId };
  });
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
