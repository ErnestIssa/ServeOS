import type { AuthUser } from "../api";
import type { MobileExperienceManifest, MobileRoleType, MobileTabManifest } from "./mobileExperienceTypes";

export type {
  MobileExperienceManifest,
  MobileRoleType,
  MobileTabManifest,
  MobileTabIconKey
} from "./mobileExperienceTypes";

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

export function navTabsFromExperience(
  exp: MobileExperienceManifest | null | undefined
): MobileTabManifest[] {
  if (!exp?.tabs?.length) return [];
  return exp.tabs.filter((t) => t.visible !== false);
}

export function navTabsFromUser(user: AuthUser | null | undefined): MobileTabManifest[] {
  return navTabsFromExperience(mobileExperienceFromUser(user));
}

export function defaultNavTabKey(exp: MobileExperienceManifest | null | undefined): string {
  const tabs = navTabsFromExperience(exp);
  return tabs[0]?.key ?? "home";
}

/** Prefer the Home tab when present; otherwise the first visible tab. */
export function homeNavTabKey(exp: MobileExperienceManifest | null | undefined): string {
  const tabs = navTabsFromExperience(exp);
  const home = tabs.find((t) => t.key === "home");
  return home?.key ?? tabs[0]?.key ?? "home";
}

export function hasPermission(user: AuthUser | null | undefined, perm: string): boolean {
  return !!mobileExperienceFromUser(user)?.permissions.includes(perm);
}

export function workspaceScreenForTab(
  exp: MobileExperienceManifest | null | undefined,
  tabKey: string
): { screenKey: string; title: string; subtitle: string } | null {
  if (!exp?.tabScreens) return null;
  const screenKey = exp.tabScreens[tabKey];
  if (!screenKey) return null;
  const def = exp.screens[screenKey];
  if (!def) return null;
  return { screenKey, title: def.title, subtitle: def.subtitle };
}

export function navTabLabel(
  exp: MobileExperienceManifest | null | undefined,
  tabKey: string
): string | null {
  return exp?.tabs.find((t) => t.key === tabKey)?.label ?? null;
}

/** Profile tab keys across role shells. */
export function isProfileNavTab(tabKey: string): boolean {
  return tabKey === "account" || tabKey === "profile";
}

/** Chat tab keys (customer `messages`, staff `chat`). */
export function isChatNavTab(tabKey: string): boolean {
  return tabKey === "messages" || tabKey === "chat";
}
