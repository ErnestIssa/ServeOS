import { apiFetch } from "../api";
import type { MobileExperienceManifest } from "./mobileExperienceTypes";
import type { WorkspaceContext } from "./workspaceApi";

export type ExperienceSwitcherPayload = {
  customerAccess: true;
  activeMode: "CUSTOMER" | "WORKSPACE";
  customerMode: { available: true; selected: boolean };
  workspaces: Array<{
    restaurantId: string;
    restaurantName: string;
    role: string;
    roleLabel: string;
    status: string;
    selected: boolean;
  }>;
  activeWorkspace: {
    restaurantId: string;
    restaurantName: string;
    role: string;
    roleLabel: string;
  } | null;
  actions: {
    canCreateRestaurant: boolean;
    canJoinRestaurant: boolean;
  };
};

export async function fetchExperienceSwitcher(jwt: string) {
  return apiFetch<{ ok: true; switcher: ExperienceSwitcherPayload } | { ok: false; error?: string }>(
    "/mobile/experience-switcher",
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
}

export async function patchActiveExperience(
  jwt: string,
  body: { mode: "CUSTOMER" } | { mode: "WORKSPACE"; restaurantId: string }
) {
  return apiFetch<
    | {
        ok: true;
        experience: MobileExperienceManifest;
        switcher: ExperienceSwitcherPayload;
        workspace: WorkspaceContext | null;
      }
    | { ok: false; error?: string }
  >("/mobile/active-experience", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body)
  });
}

export function extractInviteToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const tokenMatch =
    trimmed.match(/[?&](?:token|invite)=([^&#]+)/i) ??
    trimmed.match(/\/invite\/([^/?#]+)/i);
  if (tokenMatch?.[1]) return decodeURIComponent(tokenMatch[1].trim());
  return trimmed;
}

export async function acceptWorkspaceInvite(jwt: string, token: string) {
  return apiFetch<
    | { ok: true; token?: string; restaurantName?: string; message?: string }
    | { ok: false; error?: string; message?: string }
  >("/workspace-enrollment/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ token, action: "use_existing" })
  });
}
