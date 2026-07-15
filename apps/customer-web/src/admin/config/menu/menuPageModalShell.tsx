import type { ComponentProps } from "react";
import {
  ProfileModalShell,
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote,
  PROFILE_MODAL_PANEL
} from "../../profile/ProfileModalShell";

export const MENU_PAGE_MODAL_BACKDROP = "admin-menu-page-modal-backdrop";
export const MENU_PAGE_DRAWER_SHELL_CLASS = "admin-menu-page-drawer-shell";
export const MENU_PAGE_DRAWER_BACKDROP_CLASS = "admin-menu-page-drawer-backdrop";

export { ProfileModalAlert, ProfileModalFooter, ProfileModalNote, PROFILE_MODAL_PANEL };

/** Menu config page modals — light backdrop matching support popup. */
export function MenuPageModalShell(props: ComponentProps<typeof ProfileModalShell>) {
  return <ProfileModalShell {...props} backdropClassName={MENU_PAGE_MODAL_BACKDROP} />;
}
