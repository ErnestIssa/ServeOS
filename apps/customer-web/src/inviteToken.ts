const INVITE_SEARCH_KEY = "serveos.invite.search";

export function readInviteSearchFromLocation(): string {
  const fromUrl = window.location.search;
  if (fromUrl) {
    try {
      sessionStorage.setItem(INVITE_SEARCH_KEY, fromUrl);
    } catch {
      /* private mode */
    }
    return fromUrl;
  }
  try {
    return sessionStorage.getItem(INVITE_SEARCH_KEY) || "";
  } catch {
    return "";
  }
}

export function readInviteTokenFromLocation(): string | null {
  const token = new URLSearchParams(readInviteSearchFromLocation()).get("token")?.trim();
  return token && token.length >= 16 ? token : null;
}

export function clearStoredInviteSearch(): void {
  try {
    sessionStorage.removeItem(INVITE_SEARCH_KEY);
  } catch {
    /* ignore */
  }
}

export function hasInviteTokenInLocation(): boolean {
  return readInviteTokenFromLocation() !== null;
}
