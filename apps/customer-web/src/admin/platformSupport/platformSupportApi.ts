import { getApiBaseUrl } from "../../api";

export type PlatformSupportPolicy = {
  fabAutoHideMs: number;
  modalIdleCloseMs: number;
};

export type PlatformSupportState = {
  ok: boolean;
  fabVisible: boolean;
  modalOpen: boolean;
  hasActiveThread: boolean;
  fabPinned: boolean;
  policy: PlatformSupportPolicy;
};

export type PlatformSupportOpenSource = "FAB" | "PLATFORM_HELP";

async function platformSupportFetch<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { ok: false } as T;
  }
}

export function fetchPlatformSupportState(token: string) {
  return platformSupportFetch<PlatformSupportState>(token, "/me/platform-support");
}

export function postPlatformSupportActivity(token: string) {
  return platformSupportFetch<PlatformSupportState>(token, "/me/platform-support/platform-activity", {
    method: "POST",
    body: "{}"
  });
}

export function openPlatformSupportSession(token: string, source: PlatformSupportOpenSource) {
  return platformSupportFetch<PlatformSupportState>(token, "/me/platform-support/open", {
    method: "POST",
    body: JSON.stringify({ source })
  });
}

export function postPlatformSupportInteraction(token: string, hasActiveThread: boolean) {
  return platformSupportFetch<PlatformSupportState>(token, "/me/platform-support/interaction", {
    method: "POST",
    body: JSON.stringify({ hasActiveThread })
  });
}

export function closePlatformSupportSession(token: string) {
  return platformSupportFetch<PlatformSupportState>(token, "/me/platform-support/close", {
    method: "POST",
    body: "{}"
  });
}
