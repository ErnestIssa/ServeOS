import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchRestaurantMenuPrefs, patchRestaurantMenuPrefs } from "./menuPreferencesApi";

const STORAGE_KEY = "serveos.customer.menu_prefs_v1";

export type RestaurantPrefs = {
  likes: string[];
  lastOrdered: string[];
  /** Menu + taps / hearts for this venue (drives empty Orders CTA tone). */
  browseEngagementScore?: number;
};
type Store = Record<string, RestaurantPrefs | undefined>;

function emptyRestaurant(): RestaurantPrefs {
  return { likes: [], lastOrdered: [] };
}

async function loadAll(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveAll(store: Store): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

async function cacheRestaurantPrefs(restaurantId: string, prefs: RestaurantPrefs): Promise<void> {
  const store = await loadAll();
  store[restaurantId] = prefs;
  await saveAll(store);
}

/** Server SST with local cache (likes, last ordered, browse score). */
export async function getRestaurantPrefsForCustomer(
  restaurantId: string,
  authToken?: string | null
): Promise<RestaurantPrefs> {
  const rid = restaurantId.trim();
  if (!rid) return emptyRestaurant();
  const tok = authToken?.trim();
  if (tok) {
    try {
      const res = await fetchRestaurantMenuPrefs(tok, rid);
      if (res.ok) {
        await cacheRestaurantPrefs(rid, res.prefs);
        return { ...emptyRestaurant(), ...res.prefs };
      }
    } catch {
      /* local fallback */
    }
  }
  return getRestaurantPrefs(rid);
}

export async function getRestaurantPrefs(restaurantId: string): Promise<RestaurantPrefs> {
  const s = await loadAll();
  return { ...emptyRestaurant(), ...s[restaurantId] };
}

/** Counts a meaningful menu interaction (+ tap or new heart) for this venue. */
export async function bumpBrowseEngagement(
  restaurantId: string,
  authToken?: string | null
): Promise<void> {
  const rid = restaurantId.trim();
  if (!rid) return;
  const store = await loadAll();
  const prev = store[rid] ?? emptyRestaurant();
  const next = {
    ...prev,
    browseEngagementScore: (prev.browseEngagementScore ?? 0) + 1
  };
  store[rid] = next;
  await saveAll(store);
  const tok = authToken?.trim();
  if (tok) {
    try {
      const res = await patchRestaurantMenuPrefs(tok, rid, { action: "bump_engagement" });
      if (res.ok) await cacheRestaurantPrefs(rid, res.prefs);
    } catch {
      /* local already updated */
    }
  }
}

export async function toggleLike(
  restaurantId: string,
  menuItemId: string,
  authToken?: string | null
): Promise<boolean> {
  const rid = restaurantId.trim();
  const mid = menuItemId.trim();
  const store = await loadAll();
  const prev = store[rid] ?? emptyRestaurant();
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
  const local: RestaurantPrefs = { ...prev, likes, lastOrdered: [...prev.lastOrdered] };
  store[rid] = local;
  await saveAll(store);

  const tok = authToken?.trim();
  if (tok) {
    try {
      const res = await patchRestaurantMenuPrefs(tok, rid, { action: "toggle_like", menuItemId: mid });
      if (res.ok) {
        await cacheRestaurantPrefs(rid, res.prefs);
        return res.nowLiked ?? nowLiked;
      }
    } catch {
      /* local */
    }
  }
  return nowLiked;
}

export async function appendLastOrdered(
  restaurantId: string,
  menuItemIds: string[],
  authToken?: string | null
): Promise<void> {
  if (!menuItemIds.length) return;
  const rid = restaurantId.trim();
  const store = await loadAll();
  const prev = store[rid] ?? emptyRestaurant();
  const merged = [...menuItemIds.filter(Boolean), ...prev.lastOrdered.filter((id) => !menuItemIds.includes(id))];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const id of merged) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= 32) break;
  }
  const local: RestaurantPrefs = { ...prev, likes: [...prev.likes], lastOrdered: uniq };
  store[rid] = local;
  await saveAll(store);

  const tok = authToken?.trim();
  if (tok) {
    try {
      const res = await patchRestaurantMenuPrefs(tok, rid, {
        action: "append_last_ordered",
        menuItemIds
      });
      if (res.ok) await cacheRestaurantPrefs(rid, res.prefs);
    } catch {
      /* local */
    }
  }
}
