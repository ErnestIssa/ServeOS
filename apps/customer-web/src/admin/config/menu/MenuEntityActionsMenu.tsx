import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalScrollLock } from "../../../lib/modalScrollLock";

export type EntityMenuAction = {
  id: string;
  label: string;
  danger?: boolean;
};

type Props = {
  entityName: string;
  subtitle?: string;
  hideHeader?: boolean;
  open: boolean;
  actions: EntityMenuAction[];
  titleGradient?: boolean;
  onToggle: () => void;
  onAction: (actionId: string) => void;
};

export function MenuEntityActionsMenu({
  entityName,
  subtitle,
  hideHeader = false,
  open,
  actions,
  titleGradient = true,
  onToggle,
  onAction
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

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

  useModalScrollLock(open);

  return (
    <>
      <div className="admin-staff-actions" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
        <button
          ref={triggerRef}
          type="button"
          className={`admin-staff-actions-trigger${open ? " is-open" : ""}`}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`More options for ${entityName}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          ⋯
        </button>
      </div>

      {open && coords && actions.length > 0
        ? createPortal(
            <div
              ref={panelRef}
              className="admin-staff-actions-portal"
              style={{ top: coords.top, right: coords.right }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <div
                className={`admin-top-bubble admin-top-bubble--arrow-end admin-staff-actions-bubble${titleGradient ? " admin-menu-item-actions-bubble" : ""}${hideHeader ? " admin-menu-item-actions-bubble--compact" : ""}`}
                role="menu"
                aria-label={`Actions for ${entityName}`}
              >
                {!hideHeader ? (
                  <div className="admin-bubble-header">
                    <p className="admin-bubble-title">{entityName}</p>
                    {subtitle ? <p className="admin-bubble-desc">{subtitle}</p> : null}
                  </div>
                ) : null}
                <div className="admin-bubble-body admin-bubble-body--menu">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      role="menuitem"
                      className={`admin-bubble-menu-item w-full text-left${action.danger ? " admin-bubble-menu-item--danger" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                        onAction(action.id);
                      }}
                    >
                      <span className="admin-bubble-item-title">{action.label}</span>
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
