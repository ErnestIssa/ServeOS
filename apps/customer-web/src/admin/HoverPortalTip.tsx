import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";

export type HoverPortalTipVariant = "info" | "help" | "section-help";

const VARIANT = {
  info: {
    wrap: "admin-payments-behavior-info",
    trigger: "admin-payments-behavior-info-btn",
    mark: "i",
    ariaLabel: "More details",
    prefer: "below" as const,
    align: "end" as const
  },
  help: {
    wrap: "admin-payments-help-wrap",
    trigger: "admin-payments-help",
    mark: "?",
    ariaLabel: "About payments",
    prefer: "below" as const,
    align: "center" as const
  },
  "section-help": {
    wrap: "admin-payments-section-help-wrap",
    trigger: "admin-payments-section-help",
    mark: "?",
    ariaLabel: "More details",
    prefer: "above" as const,
    align: "center" as const
  }
};

function placeTip(
  anchor: DOMRect,
  tip: DOMRect,
  prefer: "above" | "below",
  align: "start" | "center" | "end"
) {
  const gap = 8;
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(tip.width, vw - pad * 2);
  const height = tip.height;

  let left =
    align === "end"
      ? anchor.right - width
      : align === "start"
        ? anchor.left
        : anchor.left + anchor.width / 2 - width / 2;

  left = Math.min(Math.max(pad, left), Math.max(pad, vw - pad - width));

  const below = anchor.bottom + gap;
  const above = anchor.top - gap - height;
  let top = prefer === "above" ? above : below;

  if (top + height > vh - pad) top = above;
  if (top < pad) top = below;
  if (top + height > vh - pad) top = Math.max(pad, vh - pad - height);
  if (top < pad) top = pad;

  return { top, left };
}

export function HoverPortalTip({
  tipId,
  body,
  variant = "info",
  ariaLabel
}: {
  tipId: string;
  body: string;
  variant?: HoverPortalTipVariant;
  ariaLabel?: string;
}) {
  const cfg = VARIANT[variant];
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const stop = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const updatePosition = useCallback(() => {
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap || !tip) return;
    setCoords(placeTip(wrap.getBoundingClientRect(), tip.getBoundingClientRect(), cfg.prefer, cfg.align));
  }, [cfg.align, cfg.prefer]);

  const setTipNode = useCallback(
    (node: HTMLSpanElement | null) => {
      tipRef.current = node;
      if (node) updatePosition();
    },
    [updatePosition]
  );

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    const onMove = () => updatePosition();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, body, updatePosition]);

  return (
    <span
      ref={wrapRef}
      className={cfg.wrap}
      onClick={stop}
      onMouseDown={stop}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        className={cfg.trigger}
        tabIndex={0}
        aria-label={ariaLabel ?? cfg.ariaLabel}
        aria-describedby={open ? tipId : undefined}
      >
        {cfg.mark}
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={setTipNode}
              id={tipId}
              className={`admin-hover-portal-tip is-${variant}${coords ? " is-ready" : ""}`}
              role="tooltip"
              style={coords ? { top: coords.top, left: coords.left } : undefined}
            >
              {body}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
