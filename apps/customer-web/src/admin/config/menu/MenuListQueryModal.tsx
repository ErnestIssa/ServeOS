import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "./menuPageModalShell";
import { useDetailsDrawerMount } from "./detailsDrawerUi";
import type { MenuListFilterGroup, MenuListToolOption } from "./menuListQuery";

type FilterProps = {
  kind: "filter";
  open: boolean;
  title: string;
  subtitle: string;
  groups: MenuListFilterGroup[];
  selectedIds: string[];
  resultCount: number;
  totalCount: number;
  onClose: () => void;
  onToggle: (id: string) => void;
  onClear: () => void;
};

type SortProps = {
  kind: "sort";
  open: boolean;
  title: string;
  subtitle: string;
  options: MenuListToolOption[];
  selectedId: string;
  defaultSortId: string;
  resultCount: number;
  totalCount: number;
  onClose: () => void;
  onSelect: (id: string) => void;
  onReset: () => void;
};

type Props = FilterProps | SortProps;

function QueryOptionButton({
  label,
  selected,
  onClick
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`admin-menu-list-query-chip${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="admin-menu-list-query-chip-mark" aria-hidden>
        {selected ? "✓" : ""}
      </span>
      <span className="admin-menu-list-query-chip-label">{label}</span>
    </button>
  );
}

export function MenuListQueryModal(props: Props) {
  const entityKey = props.open ? props.kind : null;
  const { mounted, visible } = useDetailsDrawerMount(props.open, entityKey);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, props.onClose]);

  if (!mounted || !entityKey) return null;

  const liveLabel =
    props.resultCount === props.totalCount
      ? `Showing all ${props.totalCount}`
      : `Showing ${props.resultCount} of ${props.totalCount}`;

  const isFilter = props.kind === "filter";
  const hasActive = isFilter
    ? props.selectedIds.length > 0
    : props.selectedId !== props.defaultSortId;

  return createPortal(
    <div
      className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
      role="presentation"
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
        aria-label={isFilter ? "Close filter" : "Close sort"}
        tabIndex={visible ? 0 : -1}
        onClick={props.onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        tabIndex={visible ? 0 : -1}
        aria-label={props.title}
        className={`admin-staff-profile-panel admin-menu-item-profile-panel admin-menu-list-query-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
      >
        <header className="admin-staff-profile-header admin-menu-list-query-header">
          <div className="min-w-0 flex-1">
            <p className="admin-menu-details-kicker">{isFilter ? "Filter · live" : "Sort · live"}</p>
            <h3 className="admin-staff-profile-title admin-menu-list-query-title">{props.title}</h3>
            <p className="admin-staff-profile-sub admin-menu-list-query-sub">{props.subtitle}</p>
            <p className="admin-menu-list-query-live" aria-live="polite">
              {liveLabel}
              {isFilter && hasActive
                ? ` · ${props.selectedIds.length} on`
                : !isFilter && hasActive
                  ? " · custom"
                  : ""}
            </p>
          </div>
          <button type="button" className="admin-staff-profile-close" onClick={props.onClose} aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="admin-staff-profile-body admin-menu-item-profile-body admin-menu-list-query-body">
          {isFilter
            ? props.groups.map((group) => (
                <section key={group.id} className="admin-menu-list-query-section">
                  <h4 className="admin-menu-list-query-section-title">{group.label}</h4>
                  <div className="admin-menu-list-query-chip-grid">
                    {group.options.map((option) => (
                      <QueryOptionButton
                        key={option.id}
                        label={option.label}
                        selected={props.selectedIds.includes(option.id)}
                        onClick={() => props.onToggle(option.id)}
                      />
                    ))}
                  </div>
                </section>
              ))
            : (
                <section className="admin-menu-list-query-section">
                  <h4 className="admin-menu-list-query-section-title">Order by</h4>
                  <div className="admin-menu-list-query-chip-grid">
                    {props.options.map((option: MenuListToolOption) => (
                      <QueryOptionButton
                        key={option.id}
                        label={option.label}
                        selected={props.selectedId === option.id}
                        onClick={() => props.onSelect(option.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
        </div>

        <footer className="admin-menu-list-query-footer">
          <button
            type="button"
            className="admin-menu-list-query-footer-btn admin-menu-list-query-footer-btn--ghost"
            onClick={isFilter ? props.onClear : props.onReset}
          >
            {isFilter ? "Clear filters" : "Reset sort"}
          </button>
          <button
            type="button"
            className="admin-menu-list-query-footer-btn admin-menu-list-query-footer-btn--primary"
            onClick={props.onClose}
          >
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
