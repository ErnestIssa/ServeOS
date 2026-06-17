import type { MembershipStatus, PrismaClient, Role } from "@prisma/client";
import type { ActiveVenueMembership } from "./venueAccessGuard.js";
import { VENUE_PERMISSION, isAdminMembershipRole } from "./venuePermissions.js";

export type StaffActionId =
  | "profile"
  | "permissions"
  | "approve"
  | "suspend"
  | "activate"
  | "remove"
  | "reset_password"
  | "force_logout"
  | "revoke_sessions";

export type StaffActionCapability = {
  allowed: boolean;
  reason: string | null;
};

export type StaffMemberCapabilities = {
  isSelf: boolean;
  canEditPermissions: boolean;
  permissionsReadOnly: boolean;
  readOnlyReason: string | null;
  canSavePermissions: boolean;
  actions: Record<StaffActionId, StaffActionCapability>;
};

export async function countActiveOwners(prisma: PrismaClient, restaurantId: string): Promise<number> {
  return prisma.membership.count({
    where: { restaurantId, role: "OWNER", status: "ACTIVE" }
  });
}

/** Reject if suspending/removing this owner would leave zero active owners. */
export async function assertAtLeastOneOwnerRemains(
  prisma: PrismaClient,
  restaurantId: string,
  targetMembershipId: string,
  targetRole: Role
): Promise<void> {
  if (targetRole !== "OWNER") return;
  const remaining = await prisma.membership.count({
    where: {
      restaurantId,
      role: "OWNER",
      status: "ACTIVE",
      id: { not: targetMembershipId }
    }
  });
  if (remaining < 1) {
    throw Object.assign(new Error("last_owner_protected"), { statusCode: 403 });
  }
}

export function assertNotSelf(actorUserId: string, targetUserId: string, errorCode: string): void {
  if (actorUserId === targetUserId) {
    throw Object.assign(new Error(errorCode), { statusCode: 403 });
  }
}

export function isManagerBlockedFromTarget(actorRole: Role, targetRole: Role): boolean {
  if (actorRole !== "MANAGER") return false;
  return targetRole === "OWNER" || targetRole === "MANAGER";
}

export function assertActorCanManageTarget(
  actor: ActiveVenueMembership,
  target: { role: Role; userId: string },
  actorUserId: string
): void {
  if (actor.userId === target.userId) return;
  if (isManagerBlockedFromTarget(actor.role, target.role)) {
    throw Object.assign(new Error("manager_cannot_manage_role"), { statusCode: 403 });
  }
}

export function assertCanEditTargetPermissions(
  actor: ActiveVenueMembership,
  target: { role: Role; userId: string },
  actorUserId: string
): void {
  assertNotSelf(actorUserId, target.userId, "cannot_edit_own_permissions");
  if (target.role === "OWNER") {
    throw Object.assign(new Error("cannot_edit_owner_permissions"), { statusCode: 403 });
  }
  if (isManagerBlockedFromTarget(actor.role, target.role)) {
    throw Object.assign(new Error("manager_cannot_manage_role"), { statusCode: 403 });
  }
  if (
    !isAdminMembershipRole(actor.role) &&
    !actor.permissions.includes(VENUE_PERMISSION.staffPermissionsEdit)
  ) {
    throw Object.assign(new Error("permission_denied"), { statusCode: 403 });
  }
}

export function assertCallerCanGrantPermissions(
  actorRole: Role,
  actorPermissions: string[],
  requestedKeys: string[]
): void {
  if (actorRole === "OWNER") return;
  const held = new Set(actorPermissions);
  const rejected = requestedKeys.filter((k) => !held.has(k));
  if (rejected.length > 0) {
    throw Object.assign(new Error("cannot_grant_permissions_not_held"), {
      statusCode: 403,
      metadata: { rejected }
    });
  }
}

function action(allowed: boolean, reason: string | null = null): StaffActionCapability {
  return { allowed, reason };
}

export function buildMemberCapabilities(params: {
  actorUserId: string;
  actorRole: Role;
  actorPermissions: string[];
  target: { id: string; userId: string; role: Role; status: MembershipStatus };
  activeOwnerCount: number;
}): StaffMemberCapabilities {
  const { actorUserId, actorRole, actorPermissions, target, activeOwnerCount } = params;
  const isSelf = actorUserId === target.userId;
  const isTargetOwner = target.role === "OWNER";
  const isActorOwner = actorRole === "OWNER";
  const managerBlocked = isManagerBlockedFromTarget(actorRole, target.role);
  const wouldLeaveNoOwner = isTargetOwner && activeOwnerCount <= 1;

  let readOnlyReason: string | null = null;
  if (isSelf) {
    readOnlyReason = "You cannot change your own permissions.";
  } else if (isTargetOwner) {
    readOnlyReason = "Owner permissions are protected and cannot be edited here.";
  } else if (managerBlocked) {
    readOnlyReason = "Managers cannot edit permissions for this role.";
  } else if (
    !isActorOwner &&
    !actorPermissions.includes(VENUE_PERMISSION.staffPermissionsEdit)
  ) {
    readOnlyReason = "You do not have permission to edit staff permissions.";
  }

  const canEditPermissions = readOnlyReason === null;

  const selfReason = isSelf ? "You cannot perform this action on your own account here." : null;
  const lastOwnerReason = wouldLeaveNoOwner ? "At least one active owner must remain for this venue." : null;
  const managerReason = managerBlocked ? "Managers cannot manage this role." : null;
  const ownerOnlyReason = isTargetOwner && !isActorOwner ? "Only owners can manage other owners." : null;

  const canApprove =
    target.status === "PENDING_APPROVAL" &&
    !isSelf &&
    !managerBlocked &&
    (isActorOwner || actorPermissions.includes(VENUE_PERMISSION.staffApprove));

  const canSuspend =
    target.status === "ACTIVE" &&
    !isSelf &&
    !lastOwnerReason &&
    !managerReason &&
    !(isTargetOwner && !isActorOwner);

  const canActivate = target.status === "SUSPENDED" && !isSelf && !managerBlocked;

  const canRemove =
    !isSelf && !lastOwnerReason && !managerReason && !(isTargetOwner && !isActorOwner);

  const canSecurity =
    !isSelf && !managerBlocked && (isActorOwner || actorPermissions.includes(VENUE_PERMISSION.staffMgmt));

  return {
    isSelf,
    canEditPermissions,
    permissionsReadOnly: !canEditPermissions,
    readOnlyReason,
    canSavePermissions: canEditPermissions,
    actions: {
      profile: action(true),
      permissions: action(canEditPermissions, readOnlyReason),
      approve: action(
        canApprove,
        isSelf
          ? selfReason
          : managerReason ?? (canApprove ? null : "This member does not need approval.")
      ),
      suspend: action(
        canSuspend,
        selfReason ?? lastOwnerReason ?? managerReason ?? ownerOnlyReason ?? "This member cannot be suspended."
      ),
      activate: action(
        canActivate,
        selfReason ?? managerReason ?? "This member cannot be reactivated."
      ),
      remove: action(
        canRemove,
        selfReason ?? lastOwnerReason ?? managerReason ?? ownerOnlyReason ?? "This member cannot be removed."
      ),
      reset_password: action(
        canSecurity,
        selfReason ?? managerReason ?? "You cannot reset this account password."
      ),
      force_logout: action(
        canSecurity,
        selfReason ?? managerReason ?? "You cannot force logout for this account."
      ),
      revoke_sessions: action(
        canSecurity,
        selfReason ?? managerReason ?? "You cannot revoke sessions for this account."
      )
    }
  };
}

export const STAFF_POLICY_ERROR_MESSAGES: Record<string, string> = {
  cannot_edit_own_permissions: "You cannot change your own permissions.",
  cannot_edit_owner_permissions: "Owner permissions cannot be edited here.",
  cannot_suspend_self: "You cannot suspend your own access.",
  cannot_remove_self: "You cannot remove your own access.",
  last_owner_protected: "At least one active owner must remain for this venue.",
  manager_cannot_manage_role: "Managers cannot manage this role.",
  cannot_grant_permissions_not_held: "You cannot grant permissions you do not have.",
  cannot_invite_owner: "Owners are added through ownership transfer, not invite.",
  staff_already_active: "This person is already an active member of this venue.",
  cannot_manage_self_security: "Use your account settings for your own security actions."
};
