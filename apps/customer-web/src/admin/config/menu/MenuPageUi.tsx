import { useState, type ReactNode } from "react";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import { MenuListQueryModal } from "./MenuListQueryModal";
import {
  toggleMenuListFilter,
  type MenuListFilterGroup,
  type MenuListToolOption
} from "./menuListQuery";

export function MenuSection({
  title,
  description,
  action,
  children,
  full = true
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <section className={`admin-menu-section${full ? " admin-menu-section--full" : ""}`}>
      <div className="admin-menu-section-head">
        <div className="min-w-0">
          <h3 className="admin-menu-section-title">{title}</h3>
          {description ? <p className="admin-menu-section-desc">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="admin-menu-section-body">{children}</div>
    </section>
  );
}

export function MenuChip({
  children,
  tone = "default"
}: {
  children: ReactNode;
  tone?: "default" | "success" | "muted" | "violet";
}) {
  return (
    <span className={`admin-config-chip${tone !== "default" ? ` admin-config-chip--${tone}` : ""}`}>
      {children}
    </span>
  );
}

export function MenuActionRow({ children }: { children: ReactNode }) {
  return <div className="admin-menu-action-row">{children}</div>;
}

export function MenuFieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="admin-menu-field-group">
      <p className="admin-menu-field-group-title">{title}</p>
      <div className="admin-menu-field-group-body">{children}</div>
    </div>
  );
}

export function MenuReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-menu-readonly-field">
      <p className="admin-menu-readonly-label">{label}</p>
      <p className="admin-menu-readonly-value">{value || "—"}</p>
    </div>
  );
}

export function MenuToolbarButton({
  children,
  onClick,
  disabled,
  primary
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <AdminBtnPrimary type="button" disabled={disabled} onClick={onClick}>
        {children}
      </AdminBtnPrimary>
    );
  }
  return (
    <AdminBtnSecondary type="button" disabled={disabled} onClick={onClick}>
      {children}
    </AdminBtnSecondary>
  );
}

export function MenuListSearchField({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  filterGroups,
  sortOptions,
  activeFilters = [],
  activeSort = null,
  defaultSort = null,
  resultCount,
  totalCount,
  onFiltersChange,
  onSortChange,
  filterTitle = "Filter",
  filterSubtitle = "Narrow results using live menu data.",
  sortTitle = "Sort",
  sortSubtitle = "Changes apply to the list instantly."
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label": string;
  filterGroups?: MenuListFilterGroup[];
  sortOptions?: MenuListToolOption[];
  activeFilters?: string[];
  activeSort?: string | null;
  defaultSort?: string | null;
  resultCount?: number;
  totalCount?: number;
  onFiltersChange?: (ids: string[]) => void;
  onSortChange?: (id: string) => void;
  filterTitle?: string;
  filterSubtitle?: string;
  sortTitle?: string;
  sortSubtitle?: string;
}) {
  const [openTool, setOpenTool] = useState<"filter" | "sort" | null>(null);
  const showTools = Boolean(
    (filterGroups?.length && onFiltersChange) || (sortOptions?.length && onSortChange)
  );
  const filtersActive = activeFilters.length > 0;
  const resolvedDefaultSort = defaultSort ?? sortOptions?.[0]?.id ?? null;
  const sortActive = Boolean(activeSort && resolvedDefaultSort && activeSort !== resolvedDefaultSort);
  const resolvedTotal = totalCount ?? resultCount ?? 0;
  const resolvedResults = resultCount ?? resolvedTotal;

  return (
    <>
      <div className={`admin-menu-surface-search-wrap${showTools ? " has-tools" : ""}`}>
        <input
          type="search"
          className="admin-menu-surface-search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
        {showTools ? (
          <div className="admin-menu-surface-search-tools" role="group" aria-label="List tools">
            {filterGroups?.length && onFiltersChange ? (
              <button
                type="button"
                className={`admin-menu-surface-search-tool${openTool === "filter" ? " is-open" : ""}${
                  filtersActive ? " is-active" : ""
                }`}
                aria-expanded={openTool === "filter"}
                aria-haspopup="dialog"
                aria-label="Filter list"
                data-tool="filter"
                onClick={() => setOpenTool((prev) => (prev === "filter" ? null : "filter"))}
              >
                <img src="/icons/filter.png" alt="" className="admin-menu-surface-search-tool-icon" />
              </button>
            ) : null}
            {sortOptions?.length && onSortChange ? (
              <button
                type="button"
                className={`admin-menu-surface-search-tool${openTool === "sort" ? " is-open" : ""}${
                  sortActive ? " is-active" : ""
                }`}
                aria-expanded={openTool === "sort"}
                aria-haspopup="dialog"
                aria-label="Sort list"
                data-tool="sort"
                onClick={() => setOpenTool((prev) => (prev === "sort" ? null : "sort"))}
              >
                <img src="/icons/swap.png" alt="" className="admin-menu-surface-search-tool-icon" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {filterGroups?.length && onFiltersChange ? (
        <MenuListQueryModal
          kind="filter"
          open={openTool === "filter"}
          title={filterTitle}
          subtitle={filterSubtitle}
          groups={filterGroups}
          selectedIds={activeFilters}
          resultCount={resolvedResults}
          totalCount={resolvedTotal}
          onClose={() => setOpenTool(null)}
          onToggle={(id) => onFiltersChange(toggleMenuListFilter(activeFilters, id))}
          onClear={() => onFiltersChange([])}
        />
      ) : null}

      {sortOptions?.length && onSortChange && resolvedDefaultSort ? (
        <MenuListQueryModal
          kind="sort"
          open={openTool === "sort"}
          title={sortTitle}
          subtitle={sortSubtitle}
          options={sortOptions}
          selectedId={activeSort ?? resolvedDefaultSort}
          defaultSortId={resolvedDefaultSort}
          resultCount={resolvedResults}
          totalCount={resolvedTotal}
          onClose={() => setOpenTool(null)}
          onSelect={(id) => onSortChange(id)}
          onReset={() => onSortChange(resolvedDefaultSort)}
        />
      ) : null}
    </>
  );
}

export function MenuPreviewFrame({
  label,
  aspect,
  children
}: {
  label: string;
  aspect: "desktop" | "mobile" | "qr";
  children?: ReactNode;
}) {
  return (
    <div className={`admin-menu-preview-frame admin-menu-preview-frame--${aspect}`}>
      <p className="admin-menu-preview-label">{label}</p>
      <div className="admin-menu-preview-canvas">
        {children ?? (
          <p className="admin-config-text-subtle text-sm">Live preview when menu data is published.</p>
        )}
      </div>
    </div>
  );
}
