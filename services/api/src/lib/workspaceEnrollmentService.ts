import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { isMergedIdentityEmail, readPendingAccountCompletion } from "./auth/identityNormalization.js";
import { normalizeAuthPhone } from "./auth/identityNormalization.js";
import { mergePreferredRestaurantIntoProfile } from "./customerSignupProfile.js";
import { customerWebBaseUrl } from "./emailUrls.js";
import { logStaffAudit } from "./staffAuditService.js";
import { membershipRoleLabel, readUserDisplayName, resolveInviterAtRestaurant } from "./userDisplayName.js";

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
  const base = process.env.SERVEOS_INVITE_BASE_URL?.trim() || `${customerWebBaseUrl()}/invite`;
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

const OPERATIONAL_ROLES: Role[] = ["OWNER", "MANAGER", "STAFF", "KITCHEN", "CASHIER"];

function isOperationalRole(role: Role): boolean {
  return OPERATIONAL_ROLES.includes(role);
}

function inviteSatisfiedByMembership(
  membership: { role: Role; status: string } | null | undefined,
  invite: LoadedInvite
): boolean {
  if (!membership) return false;
  if (!["ACTIVE", "PENDING_APPROVAL"].includes(membership.status)) return false;
  if (invite.kind === "customer") return false;
  if (!isOperationalRole(membership.role)) return false;
  return membership.role === invite.intendedRole;
}

function pickHigherRole(a: Role, b: Role): Role {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

type InviteeUserRow = {
  id: string;
  email: string | null;
  password: string | null;
  signupProfile: unknown;
  accountProfile: { fullName: string | null } | null;
};

function hasUsableLoginAccount(user: InviteeUserRow): boolean {
  if (!user.email || isMergedIdentityEmail(user.email)) return false;
  if (readPendingAccountCompletion(user.signupProfile)) return false;
  if (!user.password?.trim()) return false;
  return true;
}

function readInviteeFullName(user: InviteeUserRow): string | null {
  if (user.accountProfile?.fullName?.trim()) return user.accountProfile.fullName.trim();
  const profile = user.signupProfile;
  if (profile && typeof profile === "object" && !Array.isArray(profile)) {
    const name = (profile as { fullName?: string }).fullName;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

function recommendedEnrollmentAction(input: {
  alreadyJoined: boolean;
  identityState: "NEW" | "EXISTING" | "DUAL_ACCOUNT" | "ALREADY_JOINED";
  sessionState: "NONE" | "MATCHES_INVITE" | "MISMATCH";
  canCreateAccount: boolean;
  canUseExisting: boolean;
  canMerge: boolean;
  requiresLogin: boolean;
  requiresSwitchAccount: boolean;
}):
  | "create_account"
  | "use_existing"
  | "login"
  | "switch_account"
  | "merge"
  | "none" {
  if (input.alreadyJoined) return "none";
  if (input.canUseExisting && input.sessionState === "MATCHES_INVITE") return "use_existing";
  if (input.requiresLogin) return "login";
  if (input.canCreateAccount && input.sessionState === "NONE") return "create_account";
  if (input.canMerge) return "merge";
  if (input.requiresSwitchAccount) return "switch_account";
  if (input.canCreateAccount) return "create_account";
  return "none";
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
        inviteEmail: string;
        fullName: string | null;
        intendedRole: Role;
        roleLabel: string;
        expiresAt: string;
      };
      identity: {
        state: "NEW" | "EXISTING" | "DUAL_ACCOUNT" | "ALREADY_JOINED";
        exists: boolean;
        hasUsableAccount: boolean;
      };
      membershipAtVenue: {
        role: Role;
        status: string;
        isOperational: boolean;
      } | null;
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
        requiresSignOutToCreate: boolean;
        recommended: "create_account" | "use_existing" | "login" | "switch_account" | "merge" | "none";
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
      password: true,
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

  const alreadyJoined = inviteSatisfiedByMembership(existingMembership, invite);

  const inviteHasUsableAccount = inviteUser ? hasUsableLoginAccount(inviteUser) : false;
  const identityExists = Boolean(inviteUser);

  let identityState: "NEW" | "EXISTING" | "DUAL_ACCOUNT" | "ALREADY_JOINED" = "NEW";
  if (alreadyJoined) {
    identityState = "ALREADY_JOINED";
  } else if (inviteUser && inviteHasUsableAccount) {
    identityState = "EXISTING";
  }

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

  const alreadyJoinedFlag = identityState === "ALREADY_JOINED";
  const canCreateAccount =
    !alreadyJoinedFlag && !inviteHasUsableAccount && sessionState !== "MATCHES_INVITE";
  const canUseExisting =
    !alreadyJoinedFlag &&
    inviteHasUsableAccount &&
    sessionState === "MATCHES_INVITE" &&
    identityState !== "DUAL_ACCOUNT";
  const canMerge = !alreadyJoinedFlag && identityState === "DUAL_ACCOUNT" && sessionState === "MISMATCH";
  const requiresLogin =
    !alreadyJoinedFlag && inviteHasUsableAccount && sessionState === "NONE" && identityState === "EXISTING";
  const requiresSwitchAccount =
    !alreadyJoinedFlag &&
    sessionState === "MISMATCH" &&
    identityState !== "DUAL_ACCOUNT" &&
    inviteHasUsableAccount;
  const requiresSignOutToCreate =
    !alreadyJoinedFlag && canCreateAccount && sessionState === "MISMATCH";

  const membershipAtVenue = existingMembership
    ? {
        role: existingMembership.role,
        status: existingMembership.status,
        isOperational: isOperationalRole(existingMembership.role)
      }
    : null;

  const actions = {
    canCreateAccount,
    canUseExisting,
    canMerge,
    requiresLogin,
    requiresSwitchAccount,
    requiresSignOutToCreate,
    recommended: recommendedEnrollmentAction({
      alreadyJoined: alreadyJoinedFlag,
      identityState,
      sessionState,
      canCreateAccount,
      canUseExisting,
      canMerge,
      requiresLogin,
      requiresSwitchAccount
    })
  };

  let invitedBy: { name: string; roleLabel: string } | null = null;
  if (invite.invitedByUserId) {
    const inviter = await resolveInviterAtRestaurant(prisma, {
      userId: invite.invitedByUserId,
      restaurantId: invite.restaurantId
    });
    if (inviter) {
      invitedBy = { name: inviter.name, roleLabel: inviter.roleLabel };
    }
  }

  return {
    ok: true,
    status: "VALID",
    invite: {
      kind: invite.kind,
      invitationId: invite.id,
      restaurantId: invite.restaurantId,
      restaurantName: invite.restaurantName,
      inviteEmailMasked: maskInviteEmail(invite.email),
      inviteEmail: invite.email,
      fullName: invite.fullName ?? (inviteUser ? readInviteeFullName(inviteUser) : null),
      intendedRole: invite.intendedRole,
      roleLabel: ROLE_LABELS[invite.intendedRole],
      expiresAt: invite.expiresAt.toISOString(),
      invitedBy
    },
    identity: {
      state: identityState,
      exists: identityExists,
      hasUsableAccount: inviteHasUsableAccount
    },
    membershipAtVenue,
    session: sessionUser ? { state: sessionState, user: sessionUser } : { state: sessionState },
    actions
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
  membershipId: string | null;
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
    select: {
      id: true,
      email: true,
      password: true,
      signupProfile: true,
      accountProfile: { select: { fullName: true } }
    }
  });

  let targetUserId: string | null = null;
  let merged = false;

  if (input.action === "create_account") {
    if (!input.passwordHash) throw Object.assign(new Error("password_required"), { statusCode: 400 });
    if (inviteEmailUser && hasUsableLoginAccount(inviteEmailUser)) {
      throw Object.assign(new Error("identity_exists_use_login"), { statusCode: 409 });
    }
    const phoneNorm = input.phone?.trim() ? normalizeAuthPhone(input.phone) : null;
    if (phoneNorm) {
      const phoneUser = await prisma.user.findFirst({
        where: { phone: phoneNorm },
        select: { id: true, email: true }
      });
      if (
        phoneUser &&
        normalizeInviteEmail(phoneUser.email ?? "") !== normalizeInviteEmail(invite.email)
      ) {
        throw Object.assign(new Error("phone_identity_conflict"), { statusCode: 409 });
      }
    }
    if (input.sessionUserId) {
      const sessionUser = await prisma.user.findUnique({
        where: { id: input.sessionUserId },
        select: { email: true }
      });
      if (
        sessionUser?.email &&
        normalizeInviteEmail(sessionUser.email) === invite.email
      ) {
        throw Object.assign(new Error("use_existing_account"), { statusCode: 400 });
      }
    }
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
  const globalRole: Role =
    invite.kind === "customer"
      ? "CUSTOMER"
      : invite.intendedRole === "MANAGER"
        ? "MANAGER"
        : invite.intendedRole === "OWNER"
          ? "OWNER"
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
      const profileName = (input.fullName ?? invite.fullName ?? "").trim();
      const signupProfile = {
        fullName: profileName,
        enrolledViaInvite: invite.id,
        enrolledRestaurantId: invite.restaurantId,
        pendingAccountCompletion: false
      } as Prisma.InputJsonValue;

      if (inviteEmailUser) {
        await tx.user.update({
          where: { id: inviteEmailUser.id },
          data: {
            phone: input.phone?.trim() || invite.phone,
            password: input.passwordHash!,
            role: globalRole,
            signupProfile,
            ...(profileName
              ? { accountProfile: { upsert: { create: { fullName: profileName }, update: { fullName: profileName } } } }
              : {})
          }
        });
        userId = inviteEmailUser.id;
      } else {
        const created = await tx.user.create({
          data: {
            email: invite.email,
            phone: input.phone?.trim() || invite.phone,
            password: input.passwordHash!,
            role: globalRole,
            signupProfile,
            ...(profileName
              ? { accountProfile: { create: { fullName: profileName } } }
              : {})
          },
          select: { id: true }
        });
        userId = created.id;
      }
    }

    if (!userId) throw Object.assign(new Error("user_resolution_failed"), { statusCode: 500 });

    let membershipId: string | null = null;

    if (invite.kind === "staff") {
      const membership = await tx.membership.upsert({
        where: { userId_restaurantId: { userId, restaurantId: invite.restaurantId } },
        create: {
          userId,
          restaurantId: invite.restaurantId,
          role: invite.intendedRole,
          status: membershipStatus,
          permissions: invite.permissions as Prisma.InputJsonValue,
          invitedByUserId: invite.invitedByUserId,
          staffInvitationId: invite.id
        },
        update: {
          role: invite.intendedRole,
          status: membershipStatus,
          permissions: invite.permissions as Prisma.InputJsonValue,
          invitedByUserId: invite.invitedByUserId,
          rejectedAt: null,
          suspendedAt: null,
          removedAt: null,
          staffInvitationId: invite.id
        }
      });
      membershipId = membership.id;

      const claimed = await tx.staffInvitation.updateMany({
        where: { id: invite.id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "ACCEPTED", acceptedByUserId: userId, acceptedAt: new Date() }
      });
      if (claimed.count !== 1) {
        throw Object.assign(new Error("invitation_already_used"), { statusCode: 409 });
      }
    } else {
      const userRow = await tx.user.findUnique({
        where: { id: userId },
        select: { signupProfile: true }
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          signupProfile: mergePreferredRestaurantIntoProfile(userRow?.signupProfile, invite.restaurantId)
        }
      });

      const existingMembership = await tx.membership.findUnique({
        where: { userId_restaurantId: { userId, restaurantId: invite.restaurantId } }
      });
      membershipId = existingMembership?.id ?? null;

      const claimed = await tx.customerInvitation.updateMany({
        where: { id: invite.id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "ACCEPTED", acceptedByUserId: userId, acceptedAt: new Date() }
      });
      if (claimed.count !== 1) {
        throw Object.assign(new Error("invitation_already_used"), { statusCode: 409 });
      }
    }

    return { userId, membershipId, restaurantId: invite.restaurantId };
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
    targetMembershipId: result.membershipId ?? undefined,
    action: "INVITE_ACCEPTED",
    metadata: { invitationId: invite.id, kind: invite.kind, merged }
  });

  const redirectPath =
    invite.kind === "customer"
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
