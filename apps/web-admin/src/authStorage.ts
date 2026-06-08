export const ADMIN_AUTH_TOKEN_KEY = "serveos.admin.token";

export function readStoredAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function persistAdminToken(token: string): void {
  try {
    sessionStorage.setItem(ADMIN_AUTH_TOKEN_KEY, token);
  } catch {
    /* ignore quota / privacy mode */
  }
}

/** Consume `?token=` from signup handoff and strip it from the address bar. */
export function consumeTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token")?.trim();
  if (!urlToken) return null;

  persistAdminToken(urlToken);
  params.delete("token");
  const query = params.toString();
  const clean = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", clean);
  return urlToken;
}
