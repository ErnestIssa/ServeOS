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

export type ThreadFeedItem =
  | { kind: "system"; id: string; content: string; at: string }
  | {
      kind: "message";
      id: string;
      chatRoomId: string;
      senderUserId: string | null;
      senderRole: string;
      content: string;
      type: string;
      createdAt: string;
      deliveryStatus?: "sent" | "delivered" | "read";
      isMine?: boolean;
    };

export type CustomerChatHubMessage = Extract<ThreadFeedItem, { kind: "message" }>;

export type VenueHoursState = "open" | "closing_soon" | "closed";

export type CustomerChatVenueStatus = {
  restaurantOnline: boolean;
  isOpen: boolean;
  hoursState: VenueHoursState;
  minutesUntilClose: number | null;
  closingSoon: boolean;
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
  timeline?: Array<{ key: string; content: string; kind: string; at?: string }>;
  messages?: CustomerChatHubMessage[];
  threadFeed?: ThreadFeedItem[];
  chatRoomId?: string | null;
  venueTyping?: boolean;
  venueStatus?: CustomerChatVenueStatus;
  customerLastReadAt?: string | null;
  roomUnreadCount?: number;
  chatImageQuota?: { used: number; max: number; perSend: number };
};

export type CustomerChatUnreadResponse = { ok: boolean; unreadCount?: number; error?: string };

export async function fetchCustomerChatUnreadCount(token: string): Promise<CustomerChatUnreadResponse> {
  return apiFetch<CustomerChatUnreadResponse>("/customer/chat/unread-count", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

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

export async function postCustomerChatImages(
  token: string,
  body: {
    restaurantId: string;
    orderId?: string;
    images: Array<{ mimeType: "image/jpeg" | "image/png" | "image/webp"; dataBase64: string }>;
  }
): Promise<{
  ok: boolean;
  error?: string;
  messages?: CustomerChatHubMessage[];
  chatImageQuota?: { used: number; max: number; perSend: number };
}> {
  return apiFetch(`/customer/chat/messages/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
