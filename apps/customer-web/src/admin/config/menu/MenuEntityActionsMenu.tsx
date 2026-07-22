import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

type MenuCoords = {
  top: number;
  right: number;
};

const VIEW_MARGIN = 12;

function findScrollParent(start: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = start;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1;
    if (canScroll) return node;
    node = node.parentElement;
  }
  return null;
}

function scrollByDelta(trigger: HTMLElement, deltaY: number) {
  if (Math.abs(deltaY) < 1) return;
  const parent = findScrollParent(trigger);
  if (parent) {
    parent.scrollTop += deltaY;
    return;
  }
  window.scrollBy({ top: deltaY, left: 0, behavior: "auto" });
}

function estimateMenuSize(actionCount: number, hideHeader: boolean) {
  return {
    height: hideHeader
      ? Math.max(48, actionCount * 40 + 16)
      : Math.max(96, actionCount * 40 + 72),
    width: 220
  };
}

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
  const adjustingRef = useRef(false);
  const readyRef = useRef(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  /** Keep portal hidden until final above/below placement is locked. */
  const [ready, setReady] = useState(false);

  const setMenuReady = (next: boolean) => {
    readyRef.current = next;
    setReady(next);
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

  const resolveCoords = (panelHeight: number, panelWidth: number): MenuCoords | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;

    const triggerRect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom - VIEW_MARGIN;
    const spaceAbove = triggerRect.top - VIEW_MARGIN;
    const placeAbove = spaceBelow < panelHeight && spaceAbove > spaceBelow;

    let desiredTop = placeAbove ? triggerRect.top - panelHeight - 6 : triggerRect.bottom + 6;

    let deltaY = 0;
    if (desiredTop + panelHeight > window.innerHeight - VIEW_MARGIN) {
      deltaY += desiredTop + panelHeight - (window.innerHeight - VIEW_MARGIN);
    }
    if (desiredTop - deltaY < VIEW_MARGIN) {
      deltaY -= VIEW_MARGIN - (desiredTop - deltaY);
    }

    const triggerTopAfter = triggerRect.top - deltaY;
    const triggerBottomAfter = triggerRect.bottom - deltaY;
    if (triggerTopAfter < VIEW_MARGIN) {
      deltaY -= VIEW_MARGIN - triggerTopAfter;
    } else if (triggerBottomAfter > window.innerHeight - VIEW_MARGIN) {
      deltaY += triggerBottomAfter - (window.innerHeight - VIEW_MARGIN);
    }

    if (Math.abs(deltaY) >= 1) {
      adjustingRef.current = true;
      scrollByDelta(trigger, deltaY);
      adjustingRef.current = false;
    }

    const rect = trigger.getBoundingClientRect();
    const nextSpaceBelow = window.innerHeight - rect.bottom - VIEW_MARGIN;
    const nextSpaceAbove = rect.top - VIEW_MARGIN;
    const nextPlaceAbove = nextSpaceBelow < panelHeight && nextSpaceAbove > nextSpaceBelow;

    let top = nextPlaceAbove ? rect.top - panelHeight - 6 : rect.bottom + 6;
    top = Math.min(
      Math.max(VIEW_MARGIN, top),
      Math.max(VIEW_MARGIN, window.innerHeight - VIEW_MARGIN - panelHeight)
    );

    let right = Math.max(VIEW_MARGIN, window.innerWidth - rect.right);
    const leftEdge = window.innerWidth - right - panelWidth;
    if (leftEdge < VIEW_MARGIN) {
      right = Math.max(VIEW_MARGIN, window.innerWidth - panelWidth - VIEW_MARGIN);
    }

    return { top, right };
  };

  const placeMenu = (opts?: { reveal?: boolean }) => {
    if (adjustingRef.current) return;
    const panel = panelRef.current;
    const estimated = estimateMenuSize(actions.length, hideHeader);
    const panelHeight = panel?.offsetHeight || estimated.height;
    const panelWidth = panel?.offsetWidth || estimated.width;
    const next = resolveCoords(panelHeight, panelWidth);
    if (!next) return;
    setCoords(next);
    if (opts?.reveal) setMenuReady(true);
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      setMenuReady(false);
      return;
    }

    // Lock estimated final side (above/below) before the menu is shown.
    setMenuReady(false);
    const estimated = estimateMenuSize(actions.length, hideHeader);
    const next = resolveCoords(estimated.height, estimated.width);
    if (next) setCoords(next);

    const onLayout = () => {
      if (!readyRef.current) return;
      placeMenu();
    };
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, actions.length, hideHeader]);

  // Measure the real panel while still hidden, then reveal once at the final spot.
  useLayoutEffect(() => {
    if (!open || !coords || ready) return;
    placeMenu({ reveal: true });
  }, [open, coords, ready]);

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
              style={{
                top: coords.top,
                right: coords.right,
                visibility: ready ? "visible" : "hidden",
                opacity: ready ? 1 : 0,
                pointerEvents: ready ? "auto" : "none"
              }}
              aria-hidden={!ready}
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
