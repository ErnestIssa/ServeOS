import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  buildMobileExperienceManifest,
  userHasPermission,
  type MobileExperienceManifest,
  type MobileRoleType,
  type VenueAccessState
} from "./mobileExperience.js";
import { readPreferredRestaurantIdFromProfile, readActiveExperienceModeFromProfile, mergeActiveExperienceIntoProfile, type ActiveExperienceMode } from "./customerSignupProfile.js";
import { resolveMembershipPermissions } from "./venuePermissions.js";

export type MobileAuthContext = {
  userId: string;
  dbRole: string;
  experience: MobileExperienceManifest;
  membershipRoles: string[];
  memberships: Array<{ restaurantId: string; role: string; restaurantName: string; status: string }>;
  activeRestaurantId: string | null;
  grantedPermissions: string[];
  venueAccessState: VenueAccessState;
};

export async function loadMobileAuthContext(
  prisma: PrismaClient,
  userId: string
): Promise<MobileAuthContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      signupProfile: true,
      memberships: {
        select: {
          restaurantId: true,
          role: true,
          status: true,
          permissions: true,
          restaurant: { select: { name: true } }
        }
      }
    }
  });
  if (!user) return null;

  const activeMemberships = user.memberships.filter((m) => m.status === "ACTIVE");
  let signupProfile = user.signupProfile;
  const storedMode = readActiveExperienceModeFromProfile(signupProfile);
  const preferredStored = readPreferredRestaurantIdFromProfile(signupProfile);

  if (storedMode === "WORKSPACE") {
    if (activeMemberships.length === 0) {
      signupProfile = mergeActiveExperienceIntoProfile(signupProfile, { mode: "CUSTOMER" });
      await prisma.user.update({ where: { id: userId }, data: { signupProfile } });
    } else if (
      preferredStored &&
      !activeMemberships.some((m) => m.restaurantId === preferredStored)
    ) {
      signupProfile = mergeActiveExperienceIntoProfile(signupProfile, {
        mode: "WORKSPACE",
        restaurantId: activeMemberships[0]!.restaurantId
      });
      await prisma.user.update({ where: { id: userId }, data: { signupProfile } });
    }
  }

  const pendingMemberships = user.memberships.filter((m) => m.status === "PENDING_APPROVAL");
  const suspendedMemberships = user.memberships.filter((m) => m.status === "SUSPENDED");

  const explicitMode = readActiveExperienceModeFromProfile(signupProfile);
  const activeExperienceMode: ActiveExperienceMode =
    explicitMode ?? (activeMemberships.length > 0 ? "WORKSPACE" : "CUSTOMER");

  const preferred = readPreferredRestaurantIdFromProfile(signupProfile);
  const firstActive = activeMemberships[0]?.restaurantId ?? null;
  let activeRestaurantId = preferred ?? firstActive;

  if (
    activeRestaurantId &&
    !activeMemberships.some((m) => m.restaurantId === activeRestaurantId)
  ) {
    activeRestaurantId = firstActive;
  }

  let effectiveExperienceMode = activeExperienceMode;
  if (effectiveExperienceMode === "WORKSPACE" && activeMemberships.length === 0) {
    effectiveExperienceMode = "CUSTOMER";
  }

  let membershipRoles: string[] = [];
  let grantedPermissions: string[] = [];
  let venueAccessState: VenueAccessState = "none";
  let pendingVenueName: string | undefined;
  let suspendedVenueName: string | undefined;
  let manifestUserRole = user.role;

  if (effectiveExperienceMode === "CUSTOMER" && activeMemberships.length > 0) {
    manifestUserRole = "CUSTOMER";
    venueAccessState = "none";
    activeRestaurantId = preferred ?? null;
  } else if (effectiveExperienceMode === "WORKSPACE" && activeMemberships.length > 0) {
    venueAccessState = "active";
    const atVenue =
      activeMemberships.find((m) => m.restaurantId === activeRestaurantId) ?? activeMemberships[0]!;
    activeRestaurantId = atVenue.restaurantId;
    manifestUserRole = atVenue.role;
    membershipRoles = [atVenue.role];
    grantedPermissions = resolveMembershipPermissions(atVenue.role, atVenue.permissions);
  } else if (pendingMemberships.length > 0) {
    venueAccessState = "pending_approval";
    pendingVenueName = pendingMemberships[0]!.restaurant.name;
    activeRestaurantId = pendingMemberships[0]!.restaurantId;
  } else if (suspendedMemberships.length > 0) {
    const preferredSuspended =
      suspendedMemberships.find((m) => m.restaurantId === preferred) ?? suspendedMemberships[0]!;
    venueAccessState = "suspended";
    suspendedVenueName = preferredSuspended.restaurant.name;
    activeRestaurantId = preferredSuspended.restaurantId;
  }

  const experience = buildMobileExperienceManifest({
    userRole: manifestUserRole,
    membershipRoles,
    signupProfile,
    grantedPermissions,
    venueAccessState,
    pendingVenueName,
    suspendedVenueName
  });

  if (experience.roleType === "CUSTOMER") {
    activeRestaurantId = preferred ?? null;
  }

  return {
    userId,
    dbRole: user.role,
    experience,
    membershipRoles,
    memberships: user.memberships.map((m) => ({
      restaurantId: m.restaurantId,
      role: m.role,
      restaurantName: m.restaurant.name,
      status: m.status
    })),
    activeRestaurantId,
    grantedPermissions,
    venueAccessState
  };
}

export function bearerUserId(headers: { authorization?: string }, app: FastifyInstance): string {
  const auth = headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw Object.assign(new Error("missing_token"), { statusCode: 401 });
  }
  const pl = app.verifyJwt(auth.slice("Bearer ".length));
  return pl.sub;
}

export async function requireMobileAuth(
  req: { headers: { authorization?: string } },
  app: FastifyInstance,
  prisma: PrismaClient
): Promise<MobileAuthContext> {
  const userId = bearerUserId(req.headers as { authorization?: string }, app);
  const ctx = await loadMobileAuthContext(prisma, userId);
  if (!ctx) throw Object.assign(new Error("user_not_found"), { statusCode: 404 });
  return ctx;
}

export function assertRoleType(ctx: MobileAuthContext, allowed: MobileRoleType[]): void {
  if (!allowed.includes(ctx.experience.roleType)) {
    throw Object.assign(new Error("role_not_allowed"), { statusCode: 403 });
  }
}

export function assertPermission(ctx: MobileAuthContext, permission: string): void {
  if (!userHasPermission(ctx.experience, permission)) {
    throw Object.assign(new Error("permission_denied"), { statusCode: 403 });
  }
}

export async function requireVenueMembership(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  restaurantId: string
): Promise<{ restaurantId: string; role: string }> {
  const rid = restaurantId.trim();
  const row = await prisma.membership.findFirst({
    where: { userId: ctx.userId, restaurantId: rid, status: "ACTIVE" }
  });
  if (!row) throw Object.assign(new Error("venue_access_denied"), { statusCode: 403 });
  return { restaurantId: rid, role: row.role };
}

export async function setActiveRestaurantForUser(
  prisma: PrismaClient,
  userId: string,
  restaurantId: string
): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupProfile: true }
  });
  if (!u) throw Object.assign(new Error("user_not_found"), { statusCode: 404 });
  await prisma.user.update({
    where: { id: userId },
    data: {
      signupProfile: mergeActiveExperienceIntoProfile(u.signupProfile, {
        mode: "WORKSPACE",
        restaurantId
      })
    }
  });
}
