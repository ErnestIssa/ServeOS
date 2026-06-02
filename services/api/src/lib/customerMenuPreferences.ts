import type { Prisma } from "@prisma/client";

export const CUSTOMER_MENU_PREFS_KEY = "customerMenuPrefsByRestaurant";

export type RestaurantMenuPrefs = {
  likes: string[];
  lastOrdered: string[];
  browseEngagementScore?: number;
};

export const EMPTY_RESTAURANT_MENU_PREFS: RestaurantMenuPrefs = {
  likes: [],
  lastOrdered: []
};

function profileRecord(signupProfile: unknown): Record<string, unknown> {
  if (!signupProfile || typeof signupProfile !== "object" || Array.isArray(signupProfile)) return {};
  return { ...(signupProfile as Record<string, unknown>) };
}

function prefsStore(signupProfile: unknown): Record<string, RestaurantMenuPrefs> {
  const raw = profileRecord(signupProfile)[CUSTOMER_MENU_PREFS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, RestaurantMenuPrefs> = {};
  for (const [rid, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    const likes = Array.isArray(o.likes)
      ? o.likes.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    const lastOrdered = Array.isArray(o.lastOrdered)
      ? o.lastOrdered.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    const browseEngagementScore =
      typeof o.browseEngagementScore === "number" && Number.isFinite(o.browseEngagementScore)
        ? Math.max(0, Math.floor(o.browseEngagementScore))
        : undefined;
    out[rid] = { likes, lastOrdered, browseEngagementScore };
  }
  return out;
}

export function readRestaurantMenuPrefs(
  signupProfile: unknown,
  restaurantId: string
): RestaurantMenuPrefs {
  const rid = restaurantId.trim();
  if (!rid) return { ...EMPTY_RESTAURANT_MENU_PREFS };
  const hit = prefsStore(signupProfile)[rid];
  return hit ? { ...EMPTY_RESTAURANT_MENU_PREFS, ...hit } : { ...EMPTY_RESTAURANT_MENU_PREFS };
}

export function mergeRestaurantMenuPrefs(
  current: unknown,
  restaurantId: string,
  patch: Partial<RestaurantMenuPrefs>
): Prisma.InputJsonValue {
  const rid = restaurantId.trim();
  const base = profileRecord(current);
  const store = prefsStore(current);
  const prev = store[rid] ?? { ...EMPTY_RESTAURANT_MENU_PREFS };
  store[rid] = {
    likes: patch.likes ?? prev.likes,
    lastOrdered: patch.lastOrdered ?? prev.lastOrdered,
    browseEngagementScore:
      patch.browseEngagementScore !== undefined
        ? patch.browseEngagementScore
        : prev.browseEngagementScore
  };
  base[CUSTOMER_MENU_PREFS_KEY] = store;
  return base as Prisma.InputJsonValue;
}

export function toggleMenuItemLike(
  signupProfile: unknown,
  restaurantId: string,
  menuItemId: string
): { profile: Prisma.InputJsonValue; nowLiked: boolean; prefs: RestaurantMenuPrefs } {
  const rid = restaurantId.trim();
  const mid = menuItemId.trim();
  const prev = readRestaurantMenuPrefs(signupProfile, rid);
  const idx = prev.likes.indexOf(mid);
  let likes: string[];
  let nowLiked: boolean;
  if (idx >= 0) {
    likes = prev.likes.filter((id) => id !== mid);
    nowLiked = false;
  } else {
    likes = [mid, ...prev.likes.filter((id) => id !== mid)];
    nowLiked = true;
  }
  const prefs: RestaurantMenuPrefs = { ...prev, likes };
  return {
    profile: mergeRestaurantMenuPrefs(signupProfile, rid, prefs),
    nowLiked,
    prefs
  };
}

export function bumpMenuBrowseEngagement(
  signupProfile: unknown,
  restaurantId: string
): { profile: Prisma.InputJsonValue; prefs: RestaurantMenuPrefs } {
  const rid = restaurantId.trim();
  const prev = readRestaurantMenuPrefs(signupProfile, rid);
  const prefs: RestaurantMenuPrefs = {
    ...prev,
    browseEngagementScore: (prev.browseEngagementScore ?? 0) + 1
  };
  return { profile: mergeRestaurantMenuPrefs(signupProfile, rid, prefs), prefs };
}

export function appendMenuLastOrdered(
  signupProfile: unknown,
  restaurantId: string,
  menuItemIds: string[]
): { profile: Prisma.InputJsonValue; prefs: RestaurantMenuPrefs } {
  const rid = restaurantId.trim();
  const prev = readRestaurantMenuPrefs(signupProfile, rid);
  if (!menuItemIds.length) {
    return { profile: profileRecord(signupProfile) as Prisma.InputJsonValue, prefs: prev };
  }
  const merged = [...menuItemIds.filter(Boolean), ...prev.lastOrdered.filter((id) => !menuItemIds.includes(id))];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const id of merged) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= 32) break;
  }
  const prefs: RestaurantMenuPrefs = { ...prev, lastOrdered: uniq };
  return { profile: mergeRestaurantMenuPrefs(signupProfile, rid, prefs), prefs };
}
