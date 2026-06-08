import { ADMIN_APP_PATH, WEB_ADMIN_URL } from "../marketing/constants";
import { ADMIN_AUTH_TOKEN_KEY } from "../authStorage";

/** Redirect to the admin dashboard with JWT so the owner lands logged in. */
export function handoffToAdminApp(token: string): void {
  sessionStorage.setItem(ADMIN_AUTH_TOKEN_KEY, token);

  const base = WEB_ADMIN_URL.trim();
  if (base) {
    try {
      const url = new URL(base);
      url.searchParams.set("token", token);
      window.location.assign(url.toString());
      return;
    } catch {
      /* fall through to same-origin admin */
    }
  }

  const adminUrl = new URL(ADMIN_APP_PATH, window.location.origin);
  adminUrl.searchParams.set("token", token);
  window.location.assign(adminUrl.toString());
}
