import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "./menuPageModalShell";
import {
  modifierGroupStatusLabel,
  type ModifierGroupListRow
} from "./modifierGroupListHelpers";

type Props = {
  group: ModifierGroupListRow | null;
  open: boolean;
  venueName: string;
  onClose: () => void;
};

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-menu-readonly-field">
      <p className="admin-menu-readonly-label">{label}</p>
      <p className="admin-menu-readonly-value">{value || "—"}</p>
    </div>
  );
}

export function ModifierGroupProfileDrawer({ group, open, venueName, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<ModifierGroupListRow | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open && group) {
      setActive(group);
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      setActive(null);
      closeTimerRef.current = null;
    }, 520);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, group]);

  useModalScrollLock(mounted);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!mounted || !active) return null;

  return createPortal(
    <div
      className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
      role="presentation"
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
        aria-label="Close modifier group details"
        tabIndex={visible ? 0 : -1}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        tabIndex={visible ? 0 : -1}
        aria-label="Modifier group details"
        className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
      >
        <header className="admin-staff-profile-header">
          <div className="min-w-0 flex-1">
            <h3 className="admin-staff-profile-title">{active.name}</h3>
            <p className="admin-staff-profile-sub">Modifier group at {venueName}</p>
          </div>
          <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="admin-staff-profile-body admin-menu-item-profile-body">
          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title">Overview</h4>
            <div className="admin-menu-field-grid">
              <ReadonlyRow label="Name" value={active.name} />
              <ReadonlyRow label="Item" value={active.itemName} />
              <ReadonlyRow label="Status" value={modifierGroupStatusLabel(active)} />
            </div>
          </section>

          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title">Selection rules</h4>
            <div className="admin-menu-field-grid">
              <ReadonlyRow label="Min select" value={String(active.minSelect)} />
              <ReadonlyRow label="Max select" value={String(active.maxSelect)} />
              <ReadonlyRow label="Options" value={String(active.optionCount)} />
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
