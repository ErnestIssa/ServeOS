import { apiFetch } from "../api";
import type { CartMeOk } from "./cartApi";
import type { AppSettings } from "./profile/profilePrefsStorage";

export type CustomerQuickPrefsApi = {
  push: boolean;
  location: boolean;
};

export type CustomerAppContext = {
  preferredRestaurantId: string | null;
  avatarUri: string | null;
  quickPrefs: CustomerQuickPrefsApi;
  appSettings: AppSettings;
  badges: {
    chatUnread: number;
    upcomingReservations: number;
    activeOrders: number;
    cartTotalQuantity: number;
  };
  cart: CartMeOk | null;
  reservationFlow: {
    draft: Record<string, unknown>;
    screen: string;
    scrollByScreen?: Record<string, number>;
    confirmedReservationId?: string | null;
    updatedAt: string;
  } | null;
};

export async function fetchCustomerAppContext(jwt: string, restaurantId?: string | null) {
  const q = restaurantId?.trim() ? `?restaurantId=${encodeURIComponent(restaurantId.trim())}` : "";
  return apiFetch<{ ok: true; context: CustomerAppContext } | { ok: false; error?: string }>(
    `/customer/context${q}`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function fetchCustomerPreferences(jwt: string) {
  return apiFetch<
    | {
        ok: true;
        appSettings: AppSettings;
        quickPrefs: CustomerQuickPrefsApi;
        avatarUri: string | null;
        preferredRestaurantId: string | null;
      }
    | { ok: false; error?: string }
  >("/customer/preferences", { headers: { Authorization: `Bearer ${jwt}` } });
}

export async function patchCustomerPreferences(
  jwt: string,
  body: {
    appSettings?: AppSettings;
    quickPrefs?: CustomerQuickPrefsApi;
    avatarUri?: string | null;
  }
) {
  return apiFetch<
    | {
        ok: true;
        appSettings: AppSettings;
        quickPrefs: CustomerQuickPrefsApi;
        avatarUri: string | null;
        preferredRestaurantId: string | null;
      }
    | { ok: false; error?: string }
  >("/customer/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body)
  });
}
