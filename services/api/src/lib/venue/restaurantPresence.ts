/** In-memory staff presence per restaurant (app open / chat socket connected). */

const counts = new Map<string, number>();

export function staffPresenceConnect(restaurantId: string): void {
  const id = restaurantId.trim();
  if (!id) return;
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

export function staffPresenceDisconnect(restaurantId: string): void {
  const id = restaurantId.trim();
  if (!id) return;
  const n = (counts.get(id) ?? 0) - 1;
  if (n <= 0) counts.delete(id);
  else counts.set(id, n);
}

export function isRestaurantStaffOnline(restaurantId: string): boolean {
  return (counts.get(restaurantId.trim()) ?? 0) > 0;
}
