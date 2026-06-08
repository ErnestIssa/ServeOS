export type AppView = "landing" | "how-it-works" | "signup" | "admin";

const VIEW_PATHS: Record<AppView, string> = {
  landing: "/",
  "how-it-works": "/how-it-works",
  signup: "/signup",
  admin: "/admin"
};

export function viewFromPath(pathname: string): AppView {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/how-it-works") return "how-it-works";
  if (path === "/signup" || path === "/no-business-yet") return "signup";
  if (path === "/admin") return "admin";
  return "landing";
}

export function pathForView(view: AppView): string {
  return VIEW_PATHS[view];
}

export function syncUrlForView(view: AppView, replace = false) {
  const next = pathForView(view);
  if (window.location.pathname === next) return;
  if (replace) window.history.replaceState({ view }, "", next);
  else window.history.pushState({ view }, "", next);
}
