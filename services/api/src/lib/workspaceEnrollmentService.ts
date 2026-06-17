import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { logStaffAudit } from "./staffAuditService.js";

const INVITE_TTL_DAYS = 14;

const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
  KITCHEN: "Kitchen",
  CASHIER: "Cashier",
  CUSTOMER: "Customer"
};

const ROLE_RANK: Record<Role, number> = {
  OWNER: 6,
  MANAGER: 5,
  STAFF: 4,
  KITCHEN: 3,
  CASHIER: 3,
  CUSTOMER: 1
};

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskInviteEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "••••@••••";
  const visible = local.length <= 2 ? local[0] ?? "•" : `${local.slice(0, 2)}•••`;
  return `${visible}@${domain}`;
}

export function buildWorkspaceInviteAcceptUrl(token: string): string {
  const base = process.env.SERVEOS_INVITE_BASE_URL?.trim() || "https://app.serveos.com/invite";
  const normalized = base.replace(/\/+$/, "");
  const sep = normalized.includes("?") ? "&" : "?";
  return `${normalized}${sep}token=${encodeURIComponent(token)}`;
}

type InviteKind = "staff" | "customer";

type LoadedInvite = {
  kind: InviteKind;
  id: string;
  restaurantId: string;
  restaurantName: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  intendedRole: Role;
  permissions: string[];
  expiresAt: Date;
  invitedByUserId: string | null;
  status: string;
};

async function loadInviteByToken(prisma: PrismaClient, token: string): Promise<LoadedInvite | null> {
  const hash = hashInviteToken(token);
  const staff = await prisma.staffInvitation.findUnique({
    where: { tokenHash: hash },
    include: { restaurant: { select: { name: true } } }
  });
  if (staff) {
    return {
      kind: "staff",
      id: staff.id,
      restaurantId: staff.restaurantId,
      restaurantName: staff.restaurant.name,
      email: staff.email,
      fullName: staff.fullName,
      phone: staff.phone,
      intendedRole: staff.intendedRole,
      permissions: Array.isArray(staff.permissions) ? (staff.permissions as string[]) : [],
      expiresAt: staff.expiresAt,
      invitedByUserId: staff.invitedByUserId,
      status: staff.status
    };
  }

  const customer = await prisma.customerInvitation.findUnique({
    where: { tokenHash: hash },
    include: { restaurant: { select: { name: true } } }
  });
  if (!customer) return null;

  return {
    kind: "customer",
    id: customer.id,
    restaurantId: customer.restaurantId,
    restaurantName: customer.restaurant.name,
    email: customer.email,
    fullName: customer.fullName,
    phone: customer.phone,
    intendedRole: "CUSTOMER",
    permissions: [],
    expiresAt: customer.expiresAt,
    invitedByUserId: customer.invitedByUserId,
    status: customer.status
  };
}

async function markInviteExpired(prisma: PrismaClient, invite: LoadedInvite) {
  if (invite.kind === "staff") {
    await prisma.staffInvitation.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
  } else {
    await prisma.customerInvitation.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
  }
}

function pickHigherRole(a: Role, b: Role): Role {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

export type InviteResolveResult =
  | { ok: false; status: "INVALID" | "EXPIRED" | "REVOKED" | "ALREADY_USED"; error: string }
  | {
      ok: true;
      status: "VALID";
      invite: {
        kind: InviteKind;
        invitationId: string;
        restaurantId: string;
        restaurantName: string;
        inviteEmailMasked: string;
        fullName: string | null;
        intendedRole: Role;
        roleLabel: string;
        expiresAt: string;
      };
      identity: {
        state: "NEW" | "EXISTING" | "DUAL_ACCOUNT" | "ALREADY_JOINED";
      };
      session: {
        state: "NONE" | "MATCHES_INVITE" | "MISMATCH";
        user?: { emailMasked: string; fullName: string | null };
      };
      actions: {
        canCreateAccount: boolean;
        canUseExisting: boolean;
        canMerge: boolean;
        requiresLogin: boolean;
        requiresSwitchAccount: boolean;
      };
    };

export async function inviteEmailForToken(prisma: PrismaClient, token: string): Promise<string | null> {
  const invite = await loadInviteByToken(prisma, token);
  return invite?.email ?? null;
}

export async function resolveWorkspaceInvite(
  prisma: PrismaClient,
  token: string,
  sessionUserId?: string | null
): Promise<InviteResolveResult> {
  const invite = await loadInviteByToken(prisma, token.trim());
  if (!invite) return { ok: false, status: "INVALID", error: "invalid_token" };

  if (invite.status === "ACCEPTED") {
    return { ok: false, status: "ALREADY_USED", error: "invitation_already_used" };
  }
  if (invite.status === "CANCELLED") {
    return { ok: false, status: "REVOKED", error: "invitation_revoked" };
  }
  if (invite.status === "EXPIRED" || invite.expiresAt < new Date()) {
    if (invite.status === "PENDING") await markInviteExpired(prisma, invite);
    return { ok: false, status: "EXPIRED", error: "invitation_expired" };
  }
  if (invite.status !== "PENDING") {
    return { ok: false, status: "INVALID", error: "invitation_not_pending" };
  }

  const inviteUser = await prisma.user.findFirst({
    where: { email: invite.email },
    select: {
      id: true,
      email: true,
      signupProfile: true,
      accountProfile: { select: { fullName: true } }
    }
  });

  const existingMembership = inviteUser
    ? await prisma.membership.findUnique({
        where: {
          userId_restaurantId: { userId: inviteUser.id, restaurantId: invite.restaurantId }
        }
      })
    : null;

  const activeMembership =
    existingMembership && ["ACTIVE", "PENDING_APPROVAL", "SUSPENDED"].includes(existingMembership.status);

  let identityState: "NEW" | "EXISTING" | "DUAL_ACCOUNT" | "ALREADY_JOINED" = inviteUser ? "EXISTING" : "NEW";
  if (activeMembership) identityState = "ALREADY_JOINED";

  let sessionState: "NONE" | "MATCHES_INVITE" | "MISMATCH" = "NONE";
  let sessionUser: { emailMasked: string; fullName: string | null } | undefined;

  if (sessionUserId) {
    const sessionUserRow = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: {
        email: true,
        signupProfile: true,
        accountProfile: { select: { fullName: true } }
      }
    });
    if (sessionUserRow?.email) {
      const sessionEmail = normalizeInviteEmail(sessionUserRow.email);
      sessionUser = {
        emailMasked: maskInviteEmail(sessionEmail),
        fullName:
          sessionUserRow.accountProfile?.fullName ??
          (typeof (sessionUserRow.signupProfile as { fullName?: string } | null)?.fullName === "string"
            ? (sessionUserRow.signupProfile as { fullName: string }).fullName
            : null)
      };
      if (sessionEmail === invite.email) {
        sessionState = "MATCHES_INVITE";
      } else {
        sessionState = "MISMATCH";
        if (inviteUser && inviteUser.id !== sessionUserId) {
          identityState = "DUAL_ACCOUNT";
        }
      }
    }
  }

  const alreadyJoined = identityState === "ALREADY_JOINED";

  return {
    ok: true,
    status: "VALID",
    invite: {
      kind: invite.kind,
      invitationId: invite.id,
      restaurantId: invite.restaurantId,
      restaurantName: invite.restaurantName,
      inviteEmailMasked: maskInviteEmail(invite.email),
      fullName: invite.fullName,
      intendedRole: invite.intendedRole,
      roleLabel: ROLE_LABELS[invite.intendedRole],
      expiresAt: invite.expiresAt.toISOString()
    },
    identity: { state: identityState },
    session: sessionUser ? { state: sessionState, user: sessionUser } : { state: sessionState },
    actions: {
      canCreateAccount: !alreadyJoined && identityState === "NEW" && sessionState === "NONE",
      canUseExisting:
        !alreadyJoined &&
        (identityState === "EXISTING" || sessionState === "MATCHES_INVITE") &&
        identityState !== "DUAL_ACCOUNT",
      canMerge: !alreadyJoined && identityState === "DUAL_ACCOUNT" && sessionState === "MISMATCH",
      requiresLogin:
        !alreadyJoined &&
        identityState === "EXISTING" &&
        sessionState === "NONE",
      requiresSwitchAccount:
        !alreadyJoined &&
        sessionState === "MISMATCH" &&
        identityState !== "DUAL_ACCOUNT"
    }
  };
}

async function mergeUserIdentities(
  tx: Prisma.TransactionClient,
  survivorUserId: string,
  absorbedUserId: string
) {
  if (survivorUserId === absorbedUserId) return;

  const absorbedMemberships = await tx.membership.findMany({ where: { userId: absorbedUserId } });
  for (const membership of absorbedMemberships) {
    const existing = await tx.membership.findUnique({
      where: {
        userId_restaurantId: { userId: survivorUserId, restaurantId: membership.restaurantId }
      }
    });
    if (!existing) {
      await tx.membership.update({ where: { id: membership.id }, data: { userId: survivorUserId } });
      continue;
    }
    const mergedRole = pickHigherRole(existing.role, membership.role);
    await tx.membership.update({
      where: { id: existing.id },
      data: {
        role: mergedRole,
        status: existing.status === "ACTIVE" || membership.status === "ACTIVE" ? "ACTIVE" : existing.status
      }
    });
    if (existing.id !== membership.id) {
      await tx.membership.delete({ where: { id: membership.id } });
    }
  }

  const absorbed = await tx.user.findUnique({
    where: { id: absorbedUserId },
    select: { email: true, signupProfile: true }
  });
  if (!absorbed) return;

  await tx.user.update({
    where: { id: absorbedUserId },
    data: {
      email: `merged+${absorbedUserId}@serveos.invalid`,
      signupProfile: {
        ...(typeof absorbed.signupProfile === "object" && absorbed.signupProfile
          ? (absorbed.signupProfile as Record<string, unknown>)
          : {}),
        mergedIntoUserId: survivorUserId,
        mergedAt: new Date().toISOString(),
        previousEmail: absorbed.email
      } as Prisma.InputJsonValue
    }
  });
}

type CompleteEnrollmentInput = {
  token: string;
  action: "create_account" | "use_existing" | "merge_accounts";
  sessionUserId?: string | null;
  passwordHash?: string;
  fullName?: string;
  phone?: string;
  mergeConfirm?: boolean;
};

export type EnrollmentCompleteResult = {
  userId: string;
  membershipId: string;
  restaurantId: string;
  intendedRole: Role;
  pendingApproval: boolean;
  redirectPath: string;
  merged?: boolean;
};

export async function completeWorkspaceEnrollment(
  prisma: PrismaClient,
  input: CompleteEnrollmentInput
): Promise<EnrollmentCompleteResult> {
  const resolved = await resolveWorkspaceInvite(prisma, input.token, input.sessionUserId);
  if (!resolved.ok) throw Object.assign(new Error(resolved.error), { statusCode: 400 });

  const invite = await loadInviteByToken(prisma, input.token);
  if (!invite || invite.status !== "PENDING") {
    throw Object.assign(new Error("invalid_token"), { statusCode: 400 });
  }

  if (resolved.identity.state === "ALREADY_JOINED") {
    throw Object.assign(new Error("already_member"), { statusCode: 409 });
  }

  const inviteEmailUser = await prisma.user.findFirst({
    where: { email: invite.email },
    select: { id: true }
  });

  let targetUserId: string | null = null;
  let merged = false;

  if (input.action === "create_account") {
    if (!input.passwordHash) throw Object.assign(new Error("password_required"), { statusCode: 400 });
    if (inviteEmailUser) throw Object.assign(new Error("account_already_exists"), { statusCode: 409 });
    if (input.sessionUserId) throw Object.assign(new Error("logout_required"), { statusCode: 400 });
  } else if (input.action === "use_existing") {
    if (!input.sessionUserId && !inviteEmailUser) {
      throw Object.assign(new Error("login_required"), { statusCode: 401 });
    }
    targetUserId = input.sessionUserId ?? inviteEmailUser?.id ?? null;
    if (!targetUserId) throw Object.assign(new Error("login_required"), { statusCode: 401 });

    const sessionUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { email: true }
    });
    if (!sessionUser?.email || normalizeInviteEmail(sessionUser.email) !== invite.email) {
      throw Object.assign(new Error("email_mismatch"), { statusCode: 403 });
    }
  } else if (input.action === "merge_accounts") {
    if (!input.mergeConfirm) throw Object.assign(new Error("merge_not_confirmed"), { statusCode: 400 });
    if (!input.sessionUserId) throw Object.assign(new Error("login_required"), { statusCode: 401 });
    if (!inviteEmailUser || inviteEmailUser.id === input.sessionUserId) {
      throw Object.assign(new Error("merge_not_available"), { statusCode: 400 });
    }
    targetUserId = input.sessionUserId;
    merged = true;
  } else {
    throw Object.assign(new Error("invalid_action"), { statusCode: 400 });
  }

  const staffNeedsApproval = invite.kind === "staff";
  const membershipStatus = staffNeedsApproval ? "PENDING_APPROVAL" : "ACTIVE";
  const globalRole =
    invite.intendedRole === "MANAGER"
      ? "MANAGER"
      : invite.intendedRole === "CUSTOMER"
        ? "CUSTOMER"
        : "STAFF";

  const result = await prisma.$transaction(async (tx) => {
    if (merged && targetUserId && inviteEmailUser) {
      await mergeUserIdentities(tx, targetUserId, inviteEmailUser.id);
      await tx.userSession.updateMany({
        where: { userId: inviteEmailUser.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    let userId = targetUserId;
    if (input.action === "create_account") {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          phone: input.phone?.trim() || invite.phone,
          password: input.passwordHash!,
          role: globalRole,
          signupProfile: {
            fullName: (input.fullName ?? invite.fullName ?? "").trim(),
            enrolledViaInvite: invite.id,
            enrolledRestaurantId: invite.restaurantId
          } as Prisma.InputJsonValue
        },
        select: { id: true }
      });
      userId = created.id;
    }

    if (!userId) throw Object.assign(new Error("user_resolution_failed"), { statusCode: 500 });

    const membership = await tx.membership.upsert({
      where: { userId_restaurantId: { userId, restaurantId: invite.restaurantId } },
      create: {
        userId,
        restaurantId: invite.restaurantId,
        role: invite.intendedRole,
        status: membershipStatus,
        permissions: invite.permissions as Prisma.InputJsonValue,
        invitedByUserId: invite.invitedByUserId,
        ...(invite.kind === "staff"
          ? { staffInvitationId: invite.id }
          : { customerInvitationId: invite.id })
      },
      update: {
        role: invite.intendedRole,
        status: membershipStatus,
        permissions: invite.permissions as Prisma.InputJsonValue,
        invitedByUserId: invite.invitedByUserId,
        rejectedAt: null,
        suspendedAt: null,
        ...(invite.kind === "staff"
          ? { staffInvitationId: invite.id }
          : { customerInvitationId: invite.id })
      }
    });

    if (invite.kind === "staff") {
      const claimed = await tx.staffInvitation.updateMany({
        where: { id: invite.id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "ACCEPTED", acceptedByUserId: userId, acceptedAt: new Date() }
      });
      if (claimed.count !== 1) {
        throw Object.assign(new Error("invitation_already_used"), { statusCode: 409 });
      }
    } else {
      const claimed = await tx.customerInvitation.updateMany({
        where: { id: invite.id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "ACCEPTED", acceptedByUserId: userId, acceptedAt: new Date() }
      });
      if (claimed.count !== 1) {
        throw Object.assign(new Error("invitation_already_used"), { statusCode: 409 });
      }
    }

    return { userId, membershipId: membership.id, restaurantId: invite.restaurantId };
  });

  if (merged && inviteEmailUser && input.sessionUserId) {
    await logStaffAudit(prisma, {
      restaurantId: invite.restaurantId,
      actorUserId: input.sessionUserId,
      targetUserId: inviteEmailUser.id,
      action: "IDENTITY_MERGED",
      metadata: {
        survivorUserId: input.sessionUserId,
        absorbedUserId: inviteEmailUser.id,
        invitationId: invite.id,
        kind: invite.kind
      }
    });
  }

  await logStaffAudit(prisma, {
    restaurantId: invite.restaurantId,
    actorUserId: result.userId,
    targetUserId: result.userId,
    targetMembershipId: result.membershipId,
    action: "INVITE_ACCEPTED",
    metadata: { invitationId: invite.id, kind: invite.kind, merged }
  });

  const redirectPath =
    invite.intendedRole === "CUSTOMER"
      ? "/"
      : staffNeedsApproval && membershipStatus === "PENDING_APPROVAL"
        ? "/admin"
        : "/admin";

  return {
    ...result,
    intendedRole: invite.intendedRole,
    pendingApproval: staffNeedsApproval && membershipStatus === "PENDING_APPROVAL",
    redirectPath,
    merged
  };
}

export function generateCustomerInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createCustomerInvitation(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    email: string;
    fullName?: string;
    phone?: string;
    invitedByUserId?: string | null;
  }
): Promise<{ invitationId: string; token: string; expiresAt: Date; acceptUrl: string }> {
  const email = normalizeInviteEmail(params.email);
  const pending = await prisma.customerInvitation.findFirst({
    where: {
      restaurantId: params.restaurantId,
      email,
      status: "PENDING",
      expiresAt: { gt: new Date() }
    }
  });
  if (pending) throw Object.assign(new Error("invitation_already_pending"), { statusCode: 409 });

  const existingUser = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (existingUser) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId: existingUser.id,
        restaurantId: params.restaurantId,
        status: { in: ["ACTIVE", "PENDING_APPROVAL"] }
      }
    });
    if (membership) throw Object.assign(new Error("customer_already_enrolled"), { statusCode: 409 });
  }

  const token = generateCustomerInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const row = await prisma.customerInvitation.create({
    data: {
      restaurantId: params.restaurantId,
      email,
      fullName: params.fullName?.trim() || null,
      phone: params.phone?.trim() || null,
      tokenHash: hashInviteToken(token),
      expiresAt,
      invitedByUserId: params.invitedByUserId ?? null
    }
  });

  return {
    invitationId: row.id,
    token,
    expiresAt,
    acceptUrl: buildWorkspaceInviteAcceptUrl(token)
  };
}
