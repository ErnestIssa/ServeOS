import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "serveos.customer.menu_prefs_v1";

type RestaurantPrefs = { likes: string[]; lastOrdered: string[] };
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

export async function getRestaurantPrefs(restaurantId: string): Promise<RestaurantPrefs> {
  const s = await loadAll();
  return { ...emptyRestaurant(), ...s[restaurantId] };
}

export async function toggleLike(restaurantId: string, menuItemId: string): Promise<boolean> {
  const store = await loadAll();
  const prev = store[restaurantId] ?? emptyRestaurant();
  const idx = prev.likes.indexOf(menuItemId);
  let likes: string[];
  let nowLiked: boolean;
  if (idx >= 0) {
    likes = prev.likes.filter((id) => id !== menuItemId);
    nowLiked = false;
  } else {
    /** Newest liked first (left → right in Saved rail) */
    likes = [menuItemId, ...prev.likes.filter((id) => id !== menuItemId)];
    nowLiked = true;
  }
  store[restaurantId] = {
    likes,
    lastOrdered: [...prev.lastOrdered]
  };
  await saveAll(store);
  return nowLiked;
}

export async function appendLastOrdered(restaurantId: string, menuItemIds: string[]): Promise<void> {
  if (!menuItemIds.length) return;
  const store = await loadAll();
  const prev = store[restaurantId] ?? emptyRestaurant();
  const merged = [...menuItemIds.filter(Boolean), ...prev.lastOrdered.filter((id) => !menuItemIds.includes(id))];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const id of merged) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= 32) break;
  }
  store[restaurantId] = {
    likes: [...prev.likes],
    lastOrdered: uniq
  };
  await saveAll(store);
}
