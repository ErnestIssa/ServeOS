import type { CustomerRestaurantRow } from "../api";

export type PublicMenuSnapshot = {
  ok?: boolean;
  error?: string;
  restaurant?: { id?: string; name?: string };
  categories?: Array<{ items?: unknown[] }>;
};

export function menuHasBrowsableItems(menu: PublicMenuSnapshot | null | undefined): boolean {
  if (!menu?.ok || !menu.categories?.length) return false;
  return menu.categories.some((c) => (c.items?.length ?? 0) > 0);
}

export function formatApiError(error?: string): string {
  if (!error?.trim()) return "Something went wrong. Try again.";
  if (error === "restaurant_not_found") return "This restaurant is no longer available.";
  if (error === "missing_token") return "Sign in to continue.";
  return error;
}

export function resolveActiveVenueInDirectory(
  activeId: string,
  directory: CustomerRestaurantRow[]
): CustomerRestaurantRow | undefined {
  const id = activeId.trim();
  if (!id) return undefined;
  return directory.find((r) => r.id === id);
}

export function isStalePreferredVenue(activeId: string, directory: CustomerRestaurantRow[]): boolean {
  const id = activeId.trim();
  if (!id || directory.length === 0) return false;
  return !directory.some((r) => r.id === id);
}
