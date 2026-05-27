/** AsyncStorage + memory cache key builders (scoped per user when possible). */

export function authScope(userId: string | undefined | null): string {
  const id = userId?.trim();
  return id ? `u:${id}` : "anon";
}

export function chatHubKey(scope: string, restaurantId: string): string {
  const rid = restaurantId.trim() || "_none";
  return `${scope}:chat:hub:${rid}`;
}

export function myOrdersKey(scope: string): string {
  return `${scope}:orders:mine`;
}

export function restaurantDirectoryKey(scope: string): string {
  return `${scope}:restaurants:directory`;
}

export function menuPreviewKey(scope: string, restaurantId: string): string {
  return `${scope}:menu:${restaurantId.trim()}`;
}

export function cartKey(scope: string, restaurantId: string): string {
  return `${scope}:cart:${restaurantId.trim()}`;
}

export function chatUnreadKey(scope: string): string {
  return `${scope}:chat:unread`;
}
