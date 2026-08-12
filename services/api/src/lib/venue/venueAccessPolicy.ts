export type RestaurantAccessPolicy = {
  /** Max MANAGER memberships (ACTIVE) for this venue. */
  maxManagers: number;
  /** When true, MANAGERs with staffInviteManager may invite other MANAGERs. */
  allowManagersToInviteManagers: boolean;
};

export const DEFAULT_ACCESS_POLICY: RestaurantAccessPolicy = {
  maxManagers: 3,
  allowManagersToInviteManagers: false
};

export function readRestaurantAccessPolicy(raw: unknown): RestaurantAccessPolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_ACCESS_POLICY };
  const o = raw as Record<string, unknown>;
  const maxManagers =
    typeof o.maxManagers === "number" && o.maxManagers >= 0
      ? Math.floor(o.maxManagers)
      : DEFAULT_ACCESS_POLICY.maxManagers;
  const allowManagersToInviteManagers =
    typeof o.allowManagersToInviteManagers === "boolean"
      ? o.allowManagersToInviteManagers
      : DEFAULT_ACCESS_POLICY.allowManagersToInviteManagers;
  return { maxManagers, allowManagersToInviteManagers };
}
