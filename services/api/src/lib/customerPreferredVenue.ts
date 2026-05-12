import type { Prisma } from "@prisma/client";

const KEY = "preferredRestaurantId";

/** Stored inside `User.signupProfile` so venue preference works without a dedicated DB column. */
export function readPreferredRestaurantIdFromProfile(signupProfile: unknown): string | null {
  if (!signupProfile || typeof signupProfile !== "object" || Array.isArray(signupProfile)) return null;
  const v = (signupProfile as Record<string, unknown>)[KEY];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export function mergePreferredRestaurantIntoProfile(current: unknown, restaurantId: string): Prisma.InputJsonValue {
  const rid = restaurantId.trim();
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  base[KEY] = rid;
  return base as Prisma.InputJsonValue;
}
