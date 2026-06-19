import type { PrismaClient } from "@prisma/client";
import {
  mergeActiveExperienceIntoProfile,
  readActiveExperienceModeFromProfile,
  type ActiveExperienceMode
} from "./customerSignupProfile.js";
import { loadMobileAuthContext } from "./mobileAuthContext.js";
import { buildWorkspaceContext } from "./mobileWorkspaceService.js";
import { membershipRoleLabel } from "./userDisplayName.js";

export type ExperienceSwitcherPayload = {
  customerAccess: true;
  activeMode: ActiveExperienceMode;
  customerMode: { available: true; selected: boolean };
  workspaces: Array<{
    restaurantId: string;
    restaurantName: string;
    role: string;
    roleLabel: string;
    status: string;
    selected: boolean;
  }>;
  activeWorkspace: {
    restaurantId: string;
    restaurantName: string;
    role: string;
    roleLabel: string;
  } | null;
  actions: {
    canCreateRestaurant: boolean;
    canJoinRestaurant: boolean;
  };
};

export async function buildExperienceSwitcherPayload(
  prisma: PrismaClient,
  userId: string
): Promise<ExperienceSwitcherPayload> {
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
          restaurant: { select: { name: true } }
        }
      }
    }
  });
  if (!user) throw Object.assign(new Error("user_not_found"), { statusCode: 404 });

  const ctx = await loadMobileAuthContext(prisma, userId);
  if (!ctx) throw Object.assign(new Error("user_not_found"), { statusCode: 404 });

  const activeMemberships = user.memberships.filter((m) => m.status === "ACTIVE");
  const explicitMode = readActiveExperienceModeFromProfile(user.signupProfile);
  const activeMode: ActiveExperienceMode = explicitMode ?? "CUSTOMER";

  const customerSelected = activeMode === "CUSTOMER" || ctx.experience.roleType === "CUSTOMER";

  const workspaces = activeMemberships.map((m) => ({
    restaurantId: m.restaurantId,
    restaurantName: m.restaurant.name,
    role: m.role,
    roleLabel: membershipRoleLabel(m.role),
    status: m.status,
    selected: activeMode === "WORKSPACE" && m.restaurantId === ctx.activeRestaurantId
  }));

  const activeWorkspace =
    workspaces.find((w) => w.selected) ??
    (activeMode === "WORKSPACE" && workspaces[0]
      ? {
          restaurantId: workspaces[0].restaurantId,
          restaurantName: workspaces[0].restaurantName,
          role: workspaces[0].role,
          roleLabel: workspaces[0].roleLabel
        }
      : null);

  const canCreateRestaurant = true;

  return {
    customerAccess: true,
    activeMode,
    customerMode: { available: true, selected: customerSelected },
    workspaces,
    activeWorkspace: activeWorkspace
      ? {
          restaurantId: activeWorkspace.restaurantId,
          restaurantName: activeWorkspace.restaurantName,
          role: activeWorkspace.role,
          roleLabel: activeWorkspace.roleLabel
        }
      : null,
    actions: {
      canCreateRestaurant,
      canJoinRestaurant: true
    }
  };
}

export async function setMobileActiveExperience(
  prisma: PrismaClient,
  userId: string,
  input: { mode: "CUSTOMER" } | { mode: "WORKSPACE"; restaurantId: string }
) {
  if (input.mode === "WORKSPACE") {
    const rid = input.restaurantId.trim();
    const membership = await prisma.membership.findFirst({
      where: { userId, restaurantId: rid, status: "ACTIVE" }
    });
    if (!membership) {
      throw Object.assign(new Error("venue_access_denied"), { statusCode: 403 });
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupProfile: true }
  });
  if (!user) throw Object.assign(new Error("user_not_found"), { statusCode: 404 });

  await prisma.user.update({
    where: { id: userId },
    data: {
      signupProfile: mergeActiveExperienceIntoProfile(user.signupProfile, {
        mode: input.mode,
        restaurantId: input.mode === "WORKSPACE" ? input.restaurantId : undefined
      })
    }
  });

  const ctx = await loadMobileAuthContext(prisma, userId);
  if (!ctx) throw Object.assign(new Error("user_not_found"), { statusCode: 404 });

  const switcher = await buildExperienceSwitcherPayload(prisma, userId);
  const workspace =
    ctx.experience.roleType !== "CUSTOMER" && ctx.venueAccessState === "active"
      ? await buildWorkspaceContext(prisma, ctx)
      : null;

  return { ctx, switcher, workspace };
}
