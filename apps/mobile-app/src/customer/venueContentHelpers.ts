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

/** Venue is selected and menu loaded successfully but has no customer-facing items. */
export function venueHasNoBrowsableMenu(menu: PublicMenuSnapshot | null | undefined): boolean {
  return menu?.ok === true && !menuHasBrowsableItems(menu);
}

/** Customer-facing copy when a venue is selected but has nothing browsable yet. */
export function noMenuAtVenueMessage(venueName: string): string {
  const name = venueName.trim();
  if (!name || name === "Your venue" || name === "No venue yet" || name === "Your restaurant") {
    return "No menu at this venue currently";
  }
  return `No menu at ${name} currently`;
}

export function formatApiError(error?: string): string {
  if (!error?.trim()) return "Something went wrong. Try again.";
  if (error === "restaurant_not_found") return "This restaurant is no longer available.";
  if (error === "menu_not_published" || error === "menu_failed") return "This menu couldn't be loaded right now.";
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
