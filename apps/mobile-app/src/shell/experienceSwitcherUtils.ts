import type { ExperienceSwitcherPayload } from "../mobile/experienceSwitcherApi";

export type ExperienceOption =
  | { kind: "CUSTOMER"; key: "CUSTOMER"; title: string; subtitle: string }
  | { kind: "WORKSPACE"; key: string; restaurantId: string; title: string; subtitle: string };

/** Other experiences the user may switch to — derived only from backend switcher payload. */
export function listAlternativeExperiences(switcher: ExperienceSwitcherPayload | null): ExperienceOption[] {
  if (!switcher) return [];

  if (switcher.activeMode === "CUSTOMER") {
    return switcher.workspaces.map((w) => ({
      kind: "WORKSPACE" as const,
      key: w.restaurantId,
      restaurantId: w.restaurantId,
      title: w.restaurantName,
      subtitle: w.roleLabel
    }));
  }

  const alts: ExperienceOption[] = [
    {
      kind: "CUSTOMER",
      key: "CUSTOMER",
      title: "Customer mode",
      subtitle: "Browse menus, order, and book tables"
    }
  ];

  for (const w of switcher.workspaces) {
    if (!w.selected) {
      alts.push({
        kind: "WORKSPACE",
        key: w.restaurantId,
        restaurantId: w.restaurantId,
        title: w.restaurantName,
        subtitle: w.roleLabel
      });
    }
  }

  return alts;
}

export function hasAlternativeExperiences(switcher: ExperienceSwitcherPayload | null): boolean {
  return listAlternativeExperiences(switcher).length > 0;
}

export function currentModeLabel(switcher: ExperienceSwitcherPayload | null): string {
  if (!switcher) return "Customer mode";
  if (switcher.activeMode === "WORKSPACE" && switcher.activeWorkspace) {
    return `${switcher.activeWorkspace.restaurantName} · ${switcher.activeWorkspace.roleLabel}`;
  }
  return "Customer mode";
}

/** Venue-focused guidance — never mentions other experiences when none exist. */
export function buildModalGuidance(
  switcher: ExperienceSwitcherPayload | null,
  hasActiveVenue: boolean
): string {
  const canJoin = switcher?.actions.canJoinRestaurant;
  const canCreate = switcher?.actions.canCreateRestaurant;

  if (!hasActiveVenue) {
    if (canJoin || canCreate) {
      return "Select a venue below to start ordering, or join one with an invite.";
    }
    return "Select a venue below to browse menus, place orders, and manage bookings.";
  }

  if (canJoin || canCreate) {
    return "Your menu, cart, and orders follow the venue you choose. Tap another venue below to switch.";
  }

  return "Your menu, cart, and orders follow the venue you choose. Pick a different venue below anytime.";
}

export function modalTitle(switcher: ExperienceSwitcherPayload | null): string {
  return hasAlternativeExperiences(switcher) ? "Switch experience" : "Choose a venue";
}
