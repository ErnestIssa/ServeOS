/**
 * Shared URL helpers for transactional emails — values come from backend env at send time.
 * Template HTML/layout lives in @serveos/email-templates (frontend-owned design package).
 */

export function customerWebBaseUrl(): string {
  return (
    process.env.CUSTOMER_WEB_URL?.trim() ||
    process.env.WEB_ADMIN_URL?.trim() ||
    "https://app.serveos.se"
  ).replace(/\/$/, "");
}

export function communicationPreferencesBaseUrl(): string {
  const configured =
    process.env.SERVEOS_PREFERENCES_BASE_URL?.trim() ||
    process.env.SERVEOS_WEB_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return `${customerWebBaseUrl()}/preferences`;
}

export function defaultPreferencesFooterUrl(): string {
  return communicationPreferencesBaseUrl();
}

export function passwordResetUrl(token: string, returnTo?: string | null): string {
  const base = `${customerWebBaseUrl()}/login`;
  const params = new URLSearchParams({ resetToken: token });
  const safe = returnTo?.trim();
  if (safe?.startsWith("/") && !safe.startsWith("//") && !safe.includes("://")) {
    params.set("returnTo", safe);
  }
  return `${base}?${params.toString()}`;
}

export function emailChangeConfirmUrl(token: string): string {
  return `${customerWebBaseUrl()}/admin?emailChangeToken=${encodeURIComponent(token)}`;
}

export function communicationPreferencesUrl(token: string, type?: string): string {
  const base = communicationPreferencesBaseUrl();
  const sep = base.includes("?") ? "&" : "?";
  let url = `${base}${sep}token=${encodeURIComponent(token)}`;
  if (type?.trim()) url += `&type=${encodeURIComponent(type.trim())}`;
  return url;
}
