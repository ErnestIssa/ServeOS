import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AdminNavChevron } from "./AdminNavChevron";
import { useAdminPopoverMount } from "./useAdminPopoverMount";

export type BubbleDropdownOption = { value: string; label: string; hint?: string };

type Props = {
  label: string;
  value: string;
  options: BubbleDropdownOption[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  bubbleArrow?: "center" | "end";
  required?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Keep the options panel inside the nearest modal scroll area. */
  containWithinModal?: boolean;
  /** Expand options in document flow below the trigger (no overlay). */
  dropInline?: boolean;
};

const PANEL_HEADER_PX = 48;
const PANEL_MIN_BODY_PX = 72;
const PANEL_MAX_BODY_PX = 224;

export function AdminBubbleDropdown({
  label,
  value,
  options,
  onChange,
  onBlur,
  disabled = false,
  className = "",
  bubbleArrow = "center",
  required = false,
  searchable = false,
  searchPlaceholder = "Search…",
  containWithinModal = false,
  dropInline = false
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [placement, setPlacement] = useState({ above: false, maxBodyHeight: PANEL_MAX_BODY_PX });
  const { mounted, visible } = useAdminPopoverMount(open);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query, searchable]);

  function close() {
    setOpen(false);
    setQuery("");
    onBlur?.();
  }

  const updatePlacement = () => {
    if (!containWithinModal || dropInline || !rootRef.current) return;
    const boundary =
      rootRef.current.closest<HTMLElement>(".admin-staff-invite-modal") ??
      rootRef.current.closest<HTMLElement>(".admin-staff-invite-modal-body") ??
      rootRef.current.closest<HTMLElement>("[data-modal-scroll]") ??
      rootRef.current.closest<HTMLElement>(".overflow-y-auto");
    if (!boundary) return;

    const boundaryRect = boundary.getBoundingClientRect();
    const triggerRect = rootRef.current.getBoundingClientRect();
    const gap = 10;
    const spaceBelow = boundaryRect.bottom - triggerRect.bottom - gap;
    const spaceAbove = triggerRect.top - boundaryRect.top - gap;
    const above = spaceBelow < PANEL_MIN_BODY_PX + PANEL_HEADER_PX && spaceAbove > spaceBelow;
    const available = (above ? spaceAbove : spaceBelow) - PANEL_HEADER_PX;
    const maxBodyHeight = Math.max(PANEL_MIN_BODY_PX, Math.min(PANEL_MAX_BODY_PX, available));

    setPlacement({ above, maxBodyHeight });
  };

  useLayoutEffect(() => {
    if (!open || !containWithinModal || dropInline) return;
    updatePlacement();
    const boundary =
      rootRef.current?.closest<HTMLElement>(".admin-staff-invite-modal") ??
      rootRef.current?.closest<HTMLElement>(".admin-staff-invite-modal-body") ??
      rootRef.current?.closest<HTMLElement>("[data-modal-scroll]") ??
      rootRef.current?.closest<HTMLElement>(".overflow-y-auto");
    if (!boundary) return;

    const onLayout = () => updatePlacement();
    boundary.addEventListener("scroll", onLayout, { passive: true });
    window.addEventListener("resize", onLayout);
    return () => {
      boundary.removeEventListener("scroll", onLayout);
      window.removeEventListener("resize", onLayout);
    };
  }, [open, containWithinModal, filtered.length]);

  return (
    <div
      ref={rootRef}
      className={`admin-bubble-dropdown${open ? " is-open" : ""}${containWithinModal ? " admin-bubble-dropdown--contained" : ""}${dropInline ? " admin-bubble-dropdown--inline" : ""} ${className}`.trim()}
      onMouseLeave={() => {
        if (open) close();
      }}
    >
      <span className="admin-bubble-dropdown-label">
        {label}
        {required ? <span className="admin-staff-field-required"> *</span> : null}
      </span>
      <button
        type="button"
        className={`admin-bubble-dropdown-trigger${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="admin-bubble-dropdown-value">{selected?.label ?? value}</span>
        <AdminNavChevron open={open} className="admin-bubble-dropdown-chevron text-slate-500" />
      </button>

      {mounted ? (
        <div
          className={`admin-bubble-dropdown-anchor${visible ? " is-visible" : ""}${placement.above && !dropInline ? " admin-bubble-dropdown-anchor--above" : ""}${dropInline ? " admin-bubble-dropdown-anchor--inline" : ""}`}
          onMouseEnter={() => setOpen(true)}
        >
          <div
            className={`admin-top-bubble admin-top-bubble--arrow-${dropInline || placement.above ? "none" : bubbleArrow} admin-bubble-dropdown-panel`}
            role="listbox"
            aria-label={label}
          >
            {searchable ? (
              <div className="admin-bubble-header admin-bubble-dropdown-search-header">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="admin-bubble-dropdown-search"
                  autoComplete="off"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            ) : (
              <div className="admin-bubble-header">
                <p className="admin-bubble-title">{label}</p>
              </div>
            )}
            <div
              className="admin-bubble-body admin-bubble-body--menu admin-bubble-dropdown-body"
              style={containWithinModal && !dropInline ? { maxHeight: `${placement.maxBodyHeight}px` } : undefined}
            >
              {filtered.length === 0 ? (
                <p className="admin-bubble-dropdown-empty">No matches</p>
              ) : (
                filtered.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`admin-bubble-menu-item w-full text-left${active ? " is-selected" : ""}`}
                      onClick={() => {
                        onChange(opt.value);
                        close();
                      }}
                    >
                      <span className="admin-bubble-item-title">{opt.label}</span>
                      {opt.hint ? <span className="admin-bubble-item-desc">{opt.hint}</span> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
