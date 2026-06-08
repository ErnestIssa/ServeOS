import { WEB_ADMIN_URL } from "../marketing/constants";

/** Session key read by web-admin after business signup handoff. */
export const ADMIN_AUTH_TOKEN_KEY = "serveos.admin.token";

/** Redirect to web-admin with JWT so the owner lands logged in (backend-issued token). */
export function handoffToAdminApp(token: string): void {
  sessionStorage.setItem(ADMIN_AUTH_TOKEN_KEY, token);

  const base = WEB_ADMIN_URL.trim();
  if (!base) {
    return;
  }

  try {
    const url = new URL(base);
    url.searchParams.set("token", token);
    window.location.assign(url.toString());
  } catch {
    /* WEB_ADMIN_URL invalid — token remains in sessionStorage for same-origin fallback */
  }
}
