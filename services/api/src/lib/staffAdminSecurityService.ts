import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import { requestPasswordReset } from "./account/passwordResetService.js";
import { revokeAllSessions } from "./account/sessionService.js";
import { logStaffAudit } from "./staffAuditService.js";
import { requireActiveAdminAtVenue } from "./venueAccessGuard.js";
import type { MobileAuthContext } from "./mobileAuthContext.js";
import {
  assertActorCanManageTarget,
  assertNotSelf,
  isManagerBlockedFromTarget
} from "./staffTargetPolicy.js";
import { VENUE_PERMISSION, isAdminMembershipRole } from "./venuePermissions.js";

async function assertCanRunSecurityAction(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string
) {
  const admin = await requireActiveAdminAtVenue(prisma, ctx, restaurantId);
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId },
    select: { id: true, userId: true, role: true }
  });
  if (!membership) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });
  assertNotSelf(ctx.userId, membership.userId, "cannot_manage_self_security");
  assertActorCanManageTarget(admin, membership, ctx.userId);
  if (
    !isAdminMembershipRole(admin.role) &&
    !admin.permissions.includes(VENUE_PERMISSION.staffMgmt)
  ) {
    throw Object.assign(new Error("permission_denied"), { statusCode: 403 });
  }
  if (isManagerBlockedFromTarget(admin.role, membership.role)) {
    throw Object.assign(new Error("manager_cannot_manage_role"), { statusCode: 403 });
  }
  return membership;
}

export async function assertActorPassword(prisma: PrismaClient, actorUserId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { password: true }
  });
  if (!user) throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw Object.assign(new Error("invalid_password"), { statusCode: 401 });
}

export async function adminRequestStaffPasswordReset(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string,
  password: string
) {
  await assertCanRunSecurityAction(prisma, ctx, restaurantId, membershipId);
  await assertActorPassword(prisma, ctx.userId, password);

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId },
    include: { user: { select: { id: true, email: true } } }
  });
  if (!membership?.user.email) throw Object.assign(new Error("membership_not_found"), { statusCode: 404 });

  await requestPasswordReset(prisma, membership.user.email);
  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "PASSWORD_RESET_REQUESTED",
    targetUserId: membership.userId,
    targetMembershipId: membership.id,
    metadata: { email: membership.user.email }
  });

  return { ok: true as const };
}

export async function adminRevokeStaffSessions(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string,
  membershipId: string,
  password: string
) {
  const membership = await assertCanRunSecurityAction(prisma, ctx, restaurantId, membershipId);
  await assertActorPassword(prisma, ctx.userId, password);

  const count = await revokeAllSessions(prisma, membership.userId);
  await logStaffAudit(prisma, {
    restaurantId,
    actorUserId: ctx.userId,
    action: "SESSIONS_REVOKED",
    targetUserId: membership.userId,
    targetMembershipId: membership.id,
    metadata: { sessionsRevoked: count }
  });

  return { ok: true as const, sessionsRevoked: count };
}
