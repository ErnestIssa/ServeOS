import { apiFetch } from "../api";
import type { RestaurantPrefs } from "./menuPreferencesStorage";

export async function fetchRestaurantMenuPrefs(jwt: string, restaurantId: string) {
  const rid = encodeURIComponent(restaurantId.trim());
  return apiFetch<{ ok: true; prefs: RestaurantPrefs } | { ok: false; error?: string }>(
    `/customer/restaurants/${rid}/menu-preferences`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function patchRestaurantMenuPrefs(
  jwt: string,
  restaurantId: string,
  body:
    | { action: "toggle_like"; menuItemId: string }
    | { action: "bump_engagement" }
    | { action: "append_last_ordered"; menuItemIds: string[] }
    | { action: "replace"; prefs: RestaurantPrefs }
) {
  const rid = encodeURIComponent(restaurantId.trim());
  return apiFetch<
    | { ok: true; prefs: RestaurantPrefs; nowLiked?: boolean }
    | { ok: false; error?: string }
  >(`/customer/restaurants/${rid}/menu-preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body)
  });
}
