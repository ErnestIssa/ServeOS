import type { AppView } from "./appNavigation";
import { pathForView, viewFromPath } from "./appNavigation";
import { hasActiveAdminSession } from "./authStorage";

export function resolveAppViewForSession(pathname: string): AppView {
  const pathView = viewFromPath(pathname);
  if (hasActiveAdminSession() && pathView !== "admin") {
    return "admin";
  }
  return pathView;
}

export function guardAppView(next: AppView): AppView {
  if (hasActiveAdminSession() && next !== "admin") {
    return "admin";
  }
  return next;
}

export function adminSessionPath(): string {
  return pathForView("admin");
}
