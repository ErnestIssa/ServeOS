import { hasInviteTokenInLocation, readInviteSearchFromLocation } from "./inviteToken";
import { legalSlugFromPath, pathForLegalSlug, type LegalSlug } from "./legal/legalRoutes";

export type AppView = "landing" | "how-it-works" | "signup" | "login" | "admin" | "legal" | "preferences" | "email-templates" | "invite-accept" | "guest-order";

const VIEW_PATHS: Record<Exclude<AppView, "legal" | "guest-order">, string> = {
  landing: "/",
  "how-it-works": "/how-it-works",
  signup: "/signup",
  login: "/login",
  admin: "/admin",
  preferences: "/preferences",
  "email-templates": "/email-templates",
  "invite-accept": "/invite"
};

const LEGACY_LEGAL_REDIRECTS: Record<string, LegalSlug> = {
  "/privacy": "privacy",
  "/terms": "terms"
};

function readLoginSearchFromLocation(): string {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("resetToken");
  const returnTo = params.get("returnTo");
  const next = new URLSearchParams();
  if (resetToken) next.set("resetToken", resetToken);
  if (returnTo) next.set("returnTo", returnTo);
  const q = next.toString();
  return q ? `?${q}` : "";
}

function guestSessionIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/menu\/session\/([^/]+)$/);
  return match?.[1] ?? null;
}

export function viewFromPath(pathname: string): AppView {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (guestSessionIdFromPath(path)) return "guest-order";
  if (path === "/how-it-works") return "how-it-works";
  if (path === "/signup" || path === "/no-business-yet") return "signup";
  if (path === "/login") return "login";
  if (path === "/preferences" || path === "/unsubscribe") return "preferences";
  if (path === "/email-templates") return "email-templates";
  if (path === "/invite/accept" || path === "/invite") return "invite-accept";
  if (path === "/" && hasInviteTokenInLocation()) return "invite-accept";
  if (path === "/admin") return "admin";
  if (path === "/legal" || path.startsWith("/legal/") || path in LEGACY_LEGAL_REDIRECTS) return "legal";
  return "landing";
}

export function guestSessionIdFromPathname(pathname: string): string | null {
  return guestSessionIdFromPath(pathname);
}

export function pathForView(view: AppView, legalSlug: LegalSlug = "center"): string {
  if (view === "legal") return pathForLegalSlug(legalSlug);
  if (view === "guest-order") return window.location.pathname;
  return VIEW_PATHS[view];
}

export function syncUrlForLegal(slug: LegalSlug, replace = false) {
  const next = pathForLegalSlug(slug);
  if (window.location.pathname === next) return;
  if (replace) window.history.replaceState({ view: "legal", legalSlug: slug }, "", next);
  else window.history.pushState({ view: "legal", legalSlug: slug }, "", next);
}

export function syncUrlForView(view: AppView, replace = false, legalSlug: LegalSlug = "center") {
  if (view === "legal") {
    syncUrlForLegal(legalSlug, replace);
    return;
  }
  const nextBase = pathForView(view);
  const next =
    view === "invite-accept"
      ? `${nextBase}${readInviteSearchFromLocation() || ""}`
      : view === "login"
        ? `${nextBase}${readLoginSearchFromLocation()}`
        : nextBase;
  if (window.location.pathname + window.location.search === next) return;
  if (replace) window.history.replaceState({ view }, "", next);
  else window.history.pushState({ view }, "", next);
}

export { legalSlugFromPath };
