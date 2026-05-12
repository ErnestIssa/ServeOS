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
  cart: { id: string; restaurantId: string; updatedAt: string } | null;
  lines: CartLineApi[];
  subtotalCents: number;
  lineCount: number;
  totalQuantity: number;
};

export async function fetchCustomerCart(restaurantId: string, jwt: string) {
  return apiFetch<CartMeOk | { ok: false; error?: string }>(
    `/cart/me?restaurantId=${encodeURIComponent(restaurantId.trim())}`,
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function postCartAddItem(params: {
  jwt: string;
  restaurantId: string;
  menuItemId: string;
  quantity?: number;
  modifierOptionIds?: string[];
}) {
  const { jwt, restaurantId, menuItemId, quantity = 1, modifierOptionIds } = params;
  return apiFetch<
    CartMeOk | {
      ok: false;
      error?: string;
    }
  >("/cart/me/items", {
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

export async function deleteCartLine(jwt: string, lineId: string) {
  return apiFetch<CartMeOk | { ok: false; error?: string }>(`/cart/me/lines/${encodeURIComponent(lineId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` }
  });
}

export async function patchCartLineQuantity(jwt: string, lineId: string, quantity: number) {
  return apiFetch<CartMeOk | { ok: false; error?: string }>(`/cart/me/lines/${encodeURIComponent(lineId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ quantity })
  });
}
