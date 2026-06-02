import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  buildMobileExperienceManifest,
  userHasPermission,
  type MobileExperienceManifest,
  type MobileRoleType
} from "./mobileExperience.js";
import { readPreferredRestaurantIdFromProfile } from "./customerPreferredVenue.js";
import { mergePreferredRestaurantIntoProfile } from "./customerSignupProfile.js";

export type MobileAuthContext = {
  userId: string;
  dbRole: string;
  experience: MobileExperienceManifest;
  membershipRoles: string[];
  memberships: Array<{ restaurantId: string; role: string; restaurantName: string }>;
  activeRestaurantId: string | null;
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
        select: { restaurantId: true, role: true, restaurant: { select: { name: true } } }
      }
    }
  });
  if (!user) return null;

  const membershipRoles = user.memberships.map((m) => m.role);
  const experience = buildMobileExperienceManifest({
    userRole: user.role,
    membershipRoles,
    signupProfile: user.signupProfile
  });

  const preferred = readPreferredRestaurantIdFromProfile(user.signupProfile);
  const firstMembership = user.memberships[0]?.restaurantId ?? null;
  let activeRestaurantId = preferred ?? firstMembership;

  if (
    activeRestaurantId &&
    !user.memberships.some((m) => m.restaurantId === activeRestaurantId)
  ) {
    activeRestaurantId = firstMembership;
  }

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
      restaurantName: m.restaurant.name
    })),
    activeRestaurantId
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
  const m = ctx.memberships.find((x) => x.restaurantId === rid);
  if (!m) throw Object.assign(new Error("venue_access_denied"), { statusCode: 403 });
  return { restaurantId: rid, role: m.role };
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
    data: { signupProfile: mergePreferredRestaurantIntoProfile(u.signupProfile, restaurantId) }
  });
}
