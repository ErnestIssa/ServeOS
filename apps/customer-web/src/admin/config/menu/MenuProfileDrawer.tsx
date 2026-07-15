import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MenuSurfaceRow } from "../../../api";
import { filterUserCreatedWindows } from "./availabilityHelpers";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "./menuPageModalShell";

type MenuPanelVariant = "active" | "live" | "archived";

type Props = {
  menu: MenuSurfaceRow | null;
  open: boolean;
  venueName: string;
  variant: MenuPanelVariant;
  onClose: () => void;
};

function menuDescription(menu: MenuSurfaceRow, venueName: string) {
  if (menu.description?.trim()) return menu.description.trim();
  switch (menu.surfaceKey) {
    case "main":
      return `Default guest menu for ${venueName || "this venue"}`;
    case "lunch":
      return "Weekday lunch service — schedule when multi-menu is enabled";
    case "dinner":
      return "Evening dining — share categories or build a dedicated set";
    case "drinks":
      return "Beverages, cocktails, and bar service";
    case "seasonal":
      return "Rotating seasonal items and limited-time offers";
    default:
      return `Draft menu surface for ${venueName || "this venue"}`;
  }
}

function statusLabel(status: MenuSurfaceRow["status"]) {
  if (status === "PUBLISHED") return "Live";
  if (status === "ARCHIVED") return "Archived";
  return "Draft";
}

function statusClass(status: MenuSurfaceRow["status"]) {
  if (status === "PUBLISHED") return "admin-menu-surface-status--live";
  if (status === "ARCHIVED") return "admin-menu-surface-status--archived";
  return "admin-menu-surface-status--draft";
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-menu-readonly-field">
      <p className="admin-menu-readonly-label">{label}</p>
      <p className="admin-menu-readonly-value">{value || "—"}</p>
    </div>
  );
}

export function MenuProfileDrawer({ menu, open, venueName, variant, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuSurfaceRow | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open && menu) {
      setActiveMenu(menu);
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      setActiveMenu(null);
      closeTimerRef.current = null;
    }, 520);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, menu]);

  useEffect(() => {
    if (open && menu) setActiveMenu(menu);
  }, [open, menu]);

  useModalScrollLock(mounted);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!mounted || !activeMenu) return null;

  const availabilityCount = Object.keys(filterUserCreatedWindows(activeMenu.availabilityWindows)).length;

  return createPortal(
    <div
      className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
      role="presentation"
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
        aria-label="Close menu details"
        tabIndex={visible ? 0 : -1}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${activeMenu.name} details`}
        className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
      >
        <header className="admin-staff-profile-header">
          <div className="min-w-0 flex-1">
            <h3 className="admin-staff-profile-title">{activeMenu.name}</h3>
            <p className="admin-staff-profile-sub">{menuDescription(activeMenu, venueName)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`admin-menu-surface-status ${statusClass(activeMenu.status)}`}>
                {statusLabel(activeMenu.status)}
              </span>
              {activeMenu.surfaceKey ? (
                <span className="admin-staff-profile-meta">Surface: {activeMenu.surfaceKey}</span>
              ) : null}
            </div>
          </div>
          <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="admin-staff-profile-body admin-menu-item-profile-body">
          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title">Surface metadata</h4>
            <div className="admin-staff-meta-grid">
              <ReadonlyRow label="Menu name" value={activeMenu.name} />
              <ReadonlyRow label="Status" value={statusLabel(activeMenu.status)} />
              <ReadonlyRow label="Categories" value={String(activeMenu.categoryCount)} />
              <ReadonlyRow label="Items" value={String(activeMenu.itemCount)} />
              <ReadonlyRow
                label="Active version"
                value={activeMenu.activeVersionNumber ? `v${activeMenu.activeVersionNumber}` : "—"}
              />
              <ReadonlyRow label="Availability windows" value={String(availabilityCount)} />
            </div>
          </section>

          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title">Publishing</h4>
            <div className="admin-staff-meta-grid">
              <ReadonlyRow label="Published at" value={formatWhen(activeMenu.publishedAt)} />
              <ReadonlyRow label="Created" value={formatWhen(activeMenu.createdAt)} />
              <ReadonlyRow label="Last updated" value={formatWhen(activeMenu.updatedAt)} />
            </div>
            {variant === "active" && activeMenu.status === "DRAFT" ? (
              <p className="admin-staff-drawer-hint mt-3">
                Draft menus are only visible in admin until published. Publishing creates an immutable snapshot for guests.
              </p>
            ) : null}
            {activeMenu.status === "PUBLISHED" ? (
              <p className="admin-staff-drawer-hint mt-3">
                This menu is live — guests can order from the published snapshot.
              </p>
            ) : null}
            {activeMenu.status === "ARCHIVED" ? (
              <p className="admin-staff-drawer-hint mt-3">
                Archived menus are hidden from guests. Duplicate this menu to restore it as a new draft.
              </p>
            ) : null}
          </section>

          {activeMenu.description?.trim() ? (
            <section className="admin-staff-drawer-section">
              <h4 className="admin-staff-drawer-section-title">Description</h4>
              <p className="admin-staff-profile-muted text-sm leading-relaxed">{activeMenu.description.trim()}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
