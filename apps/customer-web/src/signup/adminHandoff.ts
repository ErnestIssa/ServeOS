import { ADMIN_APP_PATH, WEB_ADMIN_URL } from "../marketing/constants";
import { persistAdminToken } from "../authStorage";

/** Redirect to the admin dashboard with JWT so the owner lands logged in. */
export function handoffToAdminApp(token: string): void {
  const base = WEB_ADMIN_URL.trim();
  if (base) {
    persistAdminToken(token);
    try {
      const url = new URL(base);
      url.searchParams.set("token", token);
      window.location.assign(url.toString());
      return;
    } catch {
      /* fall through to same-origin admin */
    }
  }

  // Same-origin: client-side handoff avoids static-host 404 on /admin (no full reload).
  persistAdminToken(token);
  if (window.location.pathname !== ADMIN_APP_PATH) {
    window.history.replaceState({}, "", ADMIN_APP_PATH);
  }
}
