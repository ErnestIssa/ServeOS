import type { AppView } from "./appNavigation";
import { pathForView, viewFromPath } from "./appNavigation";
import { hasInviteTokenInLocation } from "./inviteToken";
import { hasActiveAdminSession } from "./authStorage";

const PUBLIC_SESSION_VIEWS: AppView[] = ["preferences", "email-templates", "invite-accept"];

export function resolveAppViewForSession(pathname: string): AppView {
  const pathView = viewFromPath(pathname);
  if (pathView === "invite-accept" || hasInviteTokenInLocation()) {
    return "invite-accept";
  }
  if (hasActiveAdminSession() && pathView !== "admin" && !PUBLIC_SESSION_VIEWS.includes(pathView)) {
    return "admin";
  }
  return pathView;
}

export function guardAppView(next: AppView): AppView {
  if (hasActiveAdminSession() && next !== "admin" && !PUBLIC_SESSION_VIEWS.includes(next)) {
    return "admin";
  }
  return next;
}

export function adminSessionPath(): string {
  return pathForView("admin");
}
