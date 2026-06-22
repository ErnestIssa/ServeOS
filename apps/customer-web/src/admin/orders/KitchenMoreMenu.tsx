import { useEffect, useRef, useState } from "react";
import { useAdminPopoverMount } from "../useAdminPopoverMount";

export type KitchenMenuAction =
  | "refresh"
  | "sound-alerts"
  | "show-completed"
  | "station-settings"
  | "export-summary"
  | "fullscreen";

const MENU_ITEMS: Array<{ id: KitchenMenuAction; title: string; description: string }> = [
  { id: "refresh", title: "Refresh tickets", description: "Pull latest kitchen queue" },
  { id: "sound-alerts", title: "Sound alerts", description: "New ticket chime on/off" },
  { id: "show-completed", title: "Show completed", description: "Include bumped tickets today" },
  { id: "station-settings", title: "Station routing", description: "Grill, cold, bar stations" },
  { id: "export-summary", title: "Export summary", description: "Shift ticket log CSV" },
  { id: "fullscreen", title: "Open full screen", description: "Dedicated kitchen display" }
];

function DotsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden width="18" height="18">
      <circle cx="10" cy="4.5" r="1.45" />
      <circle cx="10" cy="10" r="1.45" />
      <circle cx="10" cy="15.5" r="1.45" />
    </svg>
  );
}

type Props = {
  onAction: (action: KitchenMenuAction) => void;
};

export function KitchenMoreMenu({ onAction }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { mounted, visible } = useAdminPopoverMount(open, 300);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`admin-orders-kitchen-more${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="admin-orders-kitchen-more-trigger"
        aria-label="Kitchen options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <DotsIcon />
      </button>

      {mounted ? (
        <div
          className={`admin-orders-kitchen-more-anchor${visible ? " is-visible" : ""}`}
          role="presentation"
        >
          <div className="admin-top-bubble admin-top-bubble--arrow-end admin-orders-kitchen-more-panel" role="menu">
            <div className="admin-bubble-header">
              <p className="admin-bubble-title">Kitchen options</p>
              <p className="admin-bubble-desc">Quick actions for this display</p>
            </div>
            <div className="admin-bubble-body admin-bubble-body--menu">
              <p className="admin-bubble-kicker">Actions</p>
              {MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="admin-bubble-menu-item w-full text-left"
                  onClick={() => {
                    onAction(item.id);
                    setOpen(false);
                  }}
                >
                  <span className="admin-bubble-item-title">{item.title}</span>
                  <span className="admin-bubble-item-desc">{item.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
