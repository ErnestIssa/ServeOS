import type { PrismaClient } from "@prisma/client";
import { readPreferredRestaurantIdFromProfile } from "../customerPreferredVenue.js";
import { loadMobileAuthContext } from "../mobileAuthContext.js";
import { readUserDisplayName } from "../userDisplayName.js";

export function publicUserFromDbRow(row: {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  signupProfile?: unknown | null;
  accountFullName?: string | null;
}) {
  const displayName = readUserDisplayName({
    email: row.email,
    signupProfile: row.signupProfile,
    accountFullName: row.accountFullName
  });
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    role: row.role,
    displayName,
    fullName: displayName,
    signupProfile: row.signupProfile ?? null,
    preferredRestaurantId: readPreferredRestaurantIdFromProfile(row.signupProfile)
  };
}

export async function enrichUserWithExperience(
  prisma: PrismaClient,
  userId: string,
  base: ReturnType<typeof publicUserFromDbRow>
) {
  const ctx = await loadMobileAuthContext(prisma, userId);
  if (!ctx) return base;
  return {
    ...base,
    roleType: ctx.experience.roleType,
    mobileExperience: ctx.experience,
    venueAccessState: ctx.venueAccessState
  };
}
