import {
  apiFetch,
  fetchCustomerRestaurantDirectory,
  type CustomerRestaurantRow
} from "../api";
import {
  fetchCustomerChatHub,
  fetchCustomerChatUnreadCount,
  type CustomerChatHubResponse,
  type ThreadFeedItem
} from "../customer/customerChatApi";
import {
  authScope,
  chatHubKey,
  chatUnreadKey,
  myOrdersKey,
  restaurantDirectoryKey
} from "./cache/cacheKeys";
import { cacheRead, cacheWrite, fetchWithCache, revalidateInBackground, cacheInvalidate } from "./cache/appCache";

/** Default TTLs — tune per resource volatility. */
export const TTL = {
  chatHub: 10 * 60_000,
  myOrders: 3 * 60_000,
  directory: 30 * 60_000,
  menu: 15 * 60_000,
  cart: 60_000,
  unread: 45_000
} as const;

export type ChatSnapshot = {
  hub: CustomerChatHubResponse;
  feed: ThreadFeedItem[];
  savedAt: number;
};

/** Merge server thread with local optimistic/socket rows (newest wins per id). */
export function mergeThreadFeed(local: ThreadFeedItem[], server: ThreadFeedItem[]): ThreadFeedItem[] {
  const byId = new Map<string, ThreadFeedItem>();
  for (const item of local) byId.set(item.id, item);
  for (const item of server) byId.set(item.id, item);
  return [...byId.values()].sort(
    (a, b) => new Date(a.kind === "message" ? a.createdAt : a.at).getTime() -
      new Date(b.kind === "message" ? b.createdAt : b.at).getTime()
  );
}

export async function readChatSnapshot(
  userId: string | null | undefined,
  restaurantId: string
): Promise<ChatSnapshot | null> {
  const scope = authScope(userId);
  const hit = await cacheRead<ChatSnapshot>(chatHubKey(scope, restaurantId));
  return hit?.data ?? null;
}

export async function writeChatSnapshot(
  userId: string | null | undefined,
  restaurantId: string,
  hub: CustomerChatHubResponse,
  feed: ThreadFeedItem[]
): Promise<void> {
  if (!hub.ok) return;
  const scope = authScope(userId);
  const snap: ChatSnapshot = { hub, feed, savedAt: Date.now() };
  await cacheWrite(chatHubKey(scope, restaurantId), snap, TTL.chatHub);
}

export type LoadChatHubResult = {
  fromCache: boolean;
  data: CustomerChatHubResponse;
};

/**
 * Load chat hub cache-first; `onUpdate` may run twice (cache then network).
 */
export async function loadChatHubCached(
  token: string,
  restaurantId: string,
  userId: string | null | undefined,
  onUpdate: (result: LoadChatHubResult) => void,
  opts?: { force?: boolean }
): Promise<CustomerChatHubResponse> {
  const rid = restaurantId.trim();
  if (!rid) {
    const empty: CustomerChatHubResponse = { ok: true, needsVenue: true, scene: "new" };
    onUpdate({ fromCache: false, data: empty });
    return empty;
  }
  const scope = authScope(userId);
  const key = chatHubKey(scope, rid);
  let sawCache = false;

  const hub = await fetchWithCache(
    key,
    TTL.chatHub,
    async () => {
      const res = await fetchCustomerChatHub(token, restaurantId.trim() || undefined);
      if (res.ok && res.threadFeed) {
        const snap: ChatSnapshot = {
          hub: res,
          feed: res.threadFeed.filter((x) => x.kind === "message"),
          savedAt: Date.now()
        };
        await cacheWrite(key, snap, TTL.chatHub);
        return snap;
      }
      return { hub: res, feed: [], savedAt: Date.now() };
    },
    {
      force: opts?.force,
      onCached: (snap: ChatSnapshot) => {
        sawCache = true;
        onUpdate({ fromCache: true, data: snap.hub });
      }
    }
  );

  const snap = hub as ChatSnapshot;
  if (!sawCache) {
    onUpdate({ fromCache: false, data: snap.hub });
  }
  return snap.hub;
}

export function refreshChatHubSilent(
  token: string,
  restaurantId: string,
  userId: string | null | undefined,
  onFresh: (hub: CustomerChatHubResponse) => void
): void {
  const rid = restaurantId.trim();
  if (!rid) return;
  const scope = authScope(userId);
  const key = chatHubKey(scope, rid);
  revalidateInBackground(
    key,
    TTL.chatHub,
    async () => {
      const res = await fetchCustomerChatHub(token, restaurantId.trim() || undefined);
      const snap: ChatSnapshot = {
        hub: res,
        feed: res.ok ? (res.threadFeed ?? []).filter((x) => x.kind === "message") : [],
        savedAt: Date.now()
      };
      return snap;
    },
    (snap: ChatSnapshot) => onFresh(snap.hub)
  );
}

export async function loadMyOrdersCached(
  token: string,
  userId: string | null | undefined,
  onCached?: (orders: unknown[]) => void,
  opts?: { force?: boolean }
): Promise<unknown[]> {
  const scope = authScope(userId);
  return fetchWithCache(
    myOrdersKey(scope),
    TTL.myOrders,
    async () => {
      const res = await apiFetch<{ ok: boolean; orders?: unknown[] }>("/orders/mine", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(typeof (res as { error?: string }).error === "string" ? (res as { error?: string }).error : "orders_failed");
      return res.orders ?? [];
    },
    { force: opts?.force, onCached }
  );
}

export function refreshMyOrdersSilent(
  token: string,
  userId: string | null | undefined,
  onFresh: (orders: unknown[]) => void
): void {
  const scope = authScope(userId);
  revalidateInBackground(
    myOrdersKey(scope),
    TTL.myOrders,
    async () => {
      const res = await apiFetch<{ ok: boolean; orders?: unknown[] }>("/orders/mine", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.orders ?? [];
    },
    onFresh
  );
}

export async function invalidateRestaurantDirectory(userId: string | null | undefined): Promise<void> {
  const scope = authScope(userId);
  await cacheInvalidate(restaurantDirectoryKey(scope));
}

export async function loadRestaurantDirectoryCached(
  token: string,
  userId: string | null | undefined,
  onCached?: (rows: CustomerRestaurantRow[]) => void,
  opts?: { force?: boolean }
): Promise<CustomerRestaurantRow[]> {
  const scope = authScope(userId);
  return fetchWithCache(
    restaurantDirectoryKey(scope),
    TTL.directory,
    async () => {
      const res = await fetchCustomerRestaurantDirectory(token);
      if (!res.ok) return [];
      return res.restaurants;
    },
    { force: opts?.force, onCached }
  );
}

/** Prefetch chat + orders + directory when venue/session is ready (background). */
export function prefetchCustomerSession(
  token: string,
  userId: string | null | undefined,
  restaurantId: string,
  handlers?: {
    onChat?: (hub: CustomerChatHubResponse) => void;
    onOrders?: (orders: unknown[]) => void;
  }
): void {
  const rid = restaurantId.trim();
  if (rid) {
    refreshChatHubSilent(token, rid, userId, (hub) => handlers?.onChat?.(hub));
  }
  refreshMyOrdersSilent(token, userId, (orders) => handlers?.onOrders?.(orders));
  const scope = authScope(userId);
  revalidateInBackground(
    restaurantDirectoryKey(scope),
    TTL.directory,
    async () => loadRestaurantDirectoryCached(token, userId)
  );
}

export async function loadChatUnreadCached(
  token: string,
  userId: string | null | undefined
): Promise<number | null> {
  const scope = authScope(userId);
  const hit = await cacheRead<number>(chatUnreadKey(scope));
  revalidateInBackground(chatUnreadKey(scope), TTL.unread, async () => {
    const res = await fetchCustomerChatUnreadCount(token);
    return res.ok && typeof res.unreadCount === "number" ? res.unreadCount : 0;
  });
  return hit?.data ?? null;
}
