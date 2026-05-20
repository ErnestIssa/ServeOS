import { apiFetch } from "../api";

export type CustomerChatScene = "new" | "cart" | "active_order" | "completed_only";

export type CustomerChatQuickActionId =
  | "view_menu"
  | "popular_items"
  | "opening_hours"
  | "call_staff"
  | "ask_ingredients"
  | "request_customization"
  | "open_cart"
  | "place_order"
  | "reorder"
  | "browse_menu"
  | "contact_support";

export type CustomerChatHubMessage = {
  id: string;
  senderRole: string;
  content: string;
  type: string;
  createdAt: string;
};

export type CustomerChatHubResponse = {
  ok: boolean;
  error?: string;
  scene?: CustomerChatScene;
  needsVenue?: boolean;
  copy?: { headline: string; subheadline: string };
  quickActions?: Array<{ id: CustomerChatQuickActionId; label: string }>;
  composerHint?: string;
  restaurant?: { id: string; name: string; openingHours: string | null } | null;
  cart?: {
    lineCount: number;
    totalQuantity: number;
    subtotalCents: number;
    lines: Array<{ id: string; name: string; quantity: number; lineTotalCents: number }>;
  } | null;
  activeOrder?: {
    id: string;
    shortLabel: string;
    status: string;
    statusLabel: string;
    statusEmoji: string;
    estimatedMinutes: number | null;
    totalCents: number;
    restaurant: { id: string; name: string };
    lines: Array<{ name: string; quantity: number; lineTotalCents: number }>;
  } | null;
  recentOrders?: Array<{
    id: string;
    status: string;
    totalCents: number;
    createdAt: string;
    restaurant: { id: string; name: string };
    lines: Array<{ name: string; quantity: number; lineTotalCents: number }>;
  }>;
  timeline?: Array<{ key: string; content: string; kind: string }>;
  messages?: CustomerChatHubMessage[];
  chatRoomId?: string | null;
};

export async function fetchCustomerChatHub(token: string, restaurantId?: string): Promise<CustomerChatHubResponse> {
  const q = restaurantId?.trim() ? `?restaurantId=${encodeURIComponent(restaurantId.trim())}` : "";
  return apiFetch<CustomerChatHubResponse>(`/customer/chat/hub${q}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function postCustomerChatMessage(
  token: string,
  body: { restaurantId: string; content: string; orderId?: string }
): Promise<{ ok: boolean; error?: string; message?: CustomerChatHubMessage }> {
  return apiFetch(`/customer/chat/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
