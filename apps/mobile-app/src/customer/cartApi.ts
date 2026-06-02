import { apiFetch } from "../api";

export type CartLineApi = {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  modifierOptionIds: string[];
  stale?: boolean;
};

export type CartMeOk = {
  ok: true;
  cart: { id: string; restaurantId: string; updatedAt: string; orderNote?: string | null } | null;
  lines: CartLineApi[];
  subtotalCents: number;
  lineCount: number;
  totalQuantity: number;
  orderNote: string;
  /** SST: menu item ids in cart or on active orders at this restaurant (show ✓ on menu). */
  markedMenuItemIds: string[];
};

export type CartApiErr = {
  ok: false;
  error?: string;
  meta?: {
    lineId?: string;
    lineName?: string;
    message?: string;
  };
};

export async function fetchCustomerCart(restaurantId: string, jwt: string) {
  return apiFetch<CartMeOk | CartApiErr>(
    `/cart/me?restaurantId=${encodeURIComponent(restaurantId.trim())}`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function patchCustomerCartNote(jwt: string, restaurantId: string, orderNote: string) {
  return apiFetch<CartMeOk | CartApiErr>("/cart/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ restaurantId: restaurantId.trim(), orderNote })
  });
}

export async function postCartAddItem(params: {
  jwt: string;
  restaurantId: string;
  menuItemId: string;
  quantity?: number;
  modifierOptionIds?: string[];
}) {
  const { jwt, restaurantId, menuItemId, quantity = 1, modifierOptionIds } = params;
  return apiFetch<CartMeOk | CartApiErr>("/cart/me/items", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({
      restaurantId,
      menuItemId,
      quantity,
      ...(modifierOptionIds?.length ? { modifierOptionIds } : {})
    })
  });
}

export async function deleteCartLine(jwt: string, lineId: string, confirmed = false) {
  const q = confirmed ? "?confirmed=true" : "";
  return apiFetch<CartMeOk | CartApiErr>(`/cart/me/lines/${encodeURIComponent(lineId)}${q}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` }
  });
}

export async function patchCartLineQuantity(jwt: string, lineId: string, quantity: number, confirmRemove = false) {
  return apiFetch<CartMeOk | CartApiErr>(`/cart/me/lines/${encodeURIComponent(lineId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ quantity, ...(confirmRemove ? { confirmRemove: true } : {}) })
  });
}

export async function patchCartLineDelta(jwt: string, lineId: string, delta: number, confirmRemove = false) {
  return apiFetch<CartMeOk | CartApiErr>(`/cart/me/lines/${encodeURIComponent(lineId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ delta, ...(confirmRemove ? { confirmRemove: true } : {}) })
  });
}

export function isCartRemoveConfirmationError(res: CartApiErr): boolean {
  return res.error === "remove_confirmation_required";
}
