import type { AuthUser } from "../api";
import type { MobileExperienceManifest, MobileRoleType, MobileTabId } from "./mobileExperienceTypes";

export type { MobileExperienceManifest, MobileRoleType, MobileTabId } from "./mobileExperienceTypes";

export async function fetchMobileExperience(jwt: string): Promise<MobileExperienceManifest | null> {
  const { apiFetch } = await import("../api");
  const res = await apiFetch<{ ok: true; experience: MobileExperienceManifest } | { ok: false }>(
    "/mobile/experience",
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
  return res.ok ? res.experience : null;
}

export function mobileExperienceFromUser(user: AuthUser | null | undefined): MobileExperienceManifest | null {
  return user?.mobileExperience ?? null;
}

export function mobileRoleTypeFromUser(user: AuthUser | null | undefined): MobileRoleType | null {
  if (user?.roleType) return user.roleType as MobileRoleType;
  const exp = mobileExperienceFromUser(user);
  if (exp) return exp.roleType;
  return null;
}

export function visibleTabsFromUser(user: AuthUser | null | undefined): MobileTabId[] | null {
  const exp = mobileExperienceFromUser(user);
  return exp?.tabs ?? null;
}

export function hasPermission(user: AuthUser | null | undefined, perm: string): boolean {
  return !!mobileExperienceFromUser(user)?.permissions.includes(perm);
}

export function workspaceScreenForTab(
  exp: MobileExperienceManifest | null | undefined,
  tab: MobileTabId
): { screenKey: string; title: string; subtitle: string } | null {
  if (!exp?.tabScreens) return null;
  const screenKey = exp.tabScreens[tab];
  if (!screenKey) return null;
  const def = exp.screens[screenKey];
  if (!def) return null;
  return { screenKey, title: def.title, subtitle: def.subtitle };
}
