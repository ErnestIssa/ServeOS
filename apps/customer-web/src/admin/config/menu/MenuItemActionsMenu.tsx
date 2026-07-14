import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ItemMenuAction = "details" | "media";

type ItemSummary = {
  id: string;
  name: string;
  categoryName: string;
};

type Props = {
  item: ItemSummary;
  open: boolean;
  canEditDetails: boolean;
  canViewMedia: boolean;
  onToggle: () => void;
  onAction: (action: ItemMenuAction) => void;
};

export function MenuItemActionsMenu({
  item,
  open,
  canEditDetails,
  canViewMedia,
  onToggle,
  onAction
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  const items = useMemo(() => {
    const list: Array<{ id: ItemMenuAction; label: string }> = [];
    if (canEditDetails) {
      list.push({ id: "details", label: "Add description & ingredients" });
    }
    if (canViewMedia) {
      list.push({ id: "media", label: "View media" });
    }
    return list;
  }, [canEditDetails, canViewMedia]);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 6,
      right: Math.max(12, window.innerWidth - rect.right)
    });
  };

  const cancelClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    if (!open) return;
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => onToggle(), 150);
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    const onLayout = () => updatePosition();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onToggle();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onToggle]);

  useEffect(() => () => cancelClose(), []);

  return (
    <>
      <div className="admin-staff-actions" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
        <button
          ref={triggerRef}
          type="button"
          className={`admin-staff-actions-trigger${open ? " is-open" : ""}`}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`More options for ${item.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          ⋯
        </button>
      </div>

      {open && coords && items.length > 0
        ? createPortal(
            <div
              ref={panelRef}
              className="admin-staff-actions-portal"
              style={{ top: coords.top, right: coords.right }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <div
                className="admin-top-bubble admin-top-bubble--arrow-end admin-staff-actions-bubble admin-menu-item-actions-bubble"
                role="menu"
                aria-label={`Actions for ${item.name}`}
              >
                <div className="admin-bubble-header">
                  <p className="admin-bubble-title">{item.name}</p>
                  <p className="admin-bubble-desc">Item actions</p>
                </div>
                <div className="admin-bubble-body admin-bubble-body--menu">
                  {items.map((menuItem) => (
                    <button
                      key={menuItem.id}
                      type="button"
                      role="menuitem"
                      className="admin-bubble-menu-item w-full text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                        onAction(menuItem.id);
                      }}
                    >
                      <span className="admin-bubble-item-title">{menuItem.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
