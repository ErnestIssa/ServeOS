import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PaymentLogRow } from "../../../api";
import { useAdminToast } from "../../AdminToast";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { MenuListSearchField, usePinnedViewportNode } from "../menu/MenuPageUi";
import { MenuSurfacePagination } from "../menu/MenuSurfacePagination";
import { MENU_LIST_PAGE_SIZE, useMenuListPagination } from "../menu/useMenuListPagination";
import { toLogRows } from "./logDemoData";
import {
  applyLogCategoryFilter,
  applyLogFilters,
  applyLogSort,
  groupLogsByCategory,
  LOG_CATEGORY_ORDER,
  LOGS_LIST_QUERY,
  logCategoryLabel,
  logLevelLabel,
  logLevelTone,
  matchesLogSearch,
  type LogCategoryFilter
} from "./logsListQuery";
import { PaymentLogDetailDrawer } from "./PaymentLogDetailDrawer";
import { PAYMENT_PLAY_NOTE_MS, PaymentPlayNote, PaymentPlayNoteHint } from "./paymentsShared";
import { formatWhen } from "./paymentsUiHelpers";

type Props = {
  logs: PaymentLogRow[];
  source?: "live" | "demo";
  sandboxNote?: string | null;
  embedded?: boolean;
};

export function PaymentsLogsTab({ logs, source, sandboxNote = null, embedded = false }: Props) {
  const { pushToast } = useAdminToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(LOGS_LIST_QUERY.defaultSort);
  const [categoryFilter, setCategoryFilter] = useState<LogCategoryFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<PaymentLogRow | null>(null);
  const [noteOpen, setNoteOpen] = useState(Boolean(sandboxNote) && !embedded);
  const { nodeRef, pin } = usePinnedViewportNode();
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultsMinHeightRef = useRef(0);

  const rows = useMemo(() => toLogRows(logs), [logs]);

  useEffect(() => {
    if (!sandboxNote || embedded || !noteOpen) return;
    const id = window.setTimeout(() => setNoteOpen(false), PAYMENT_PLAY_NOTE_MS);
    return () => window.clearTimeout(id);
  }, [sandboxNote, embedded, noteOpen]);

  const filtered = useMemo(() => {
    const searched = rows.filter((row) => matchesLogSearch(row, searchQuery));
    const narrowed = applyLogFilters(searched, activeFilters);
    const byCategory = applyLogCategoryFilter(narrowed, categoryFilter);
    return applyLogSort(byCategory, activeSort);
  }, [rows, searchQuery, activeFilters, activeSort, categoryFilter]);

  const pager = useMenuListPagination(filtered, {
    pageSize: MENU_LIST_PAGE_SIZE,
    resetKey: `${searchQuery}:${activeFilters.join(",")}:${activeSort}:${categoryFilter}`
  });
  const paged = pager.pagedItems;
  const sections = useMemo(() => groupLogsByCategory(paged), [paged]);
  const listedSections =
    categoryFilter === "all" ? sections : [{ category: categoryFilter, label: "", rows: paged }];
  const categoryChipOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.category));
    return LOG_CATEGORY_ORDER.filter((c) => present.has(c));
  }, [rows]);

  useLayoutEffect(() => {
    const el = resultsRef.current;
    if (!el) return;
    resultsMinHeightRef.current = Math.max(resultsMinHeightRef.current, el.getBoundingClientRect().height);
    el.style.minHeight = `${resultsMinHeightRef.current}px`;
  }, [filtered, paged, categoryFilter]);

  const copyText = async (value: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast(ok, "success");
    } catch {
      pushToast("Could not copy to clipboard.", "error");
    }
  };

  const handleAction = (row: PaymentLogRow, actionId: string) => {
    setOpenMenuId(null);
    if (actionId === "view") {
      setDetailRow(row);
      return;
    }
    if (actionId === "copy_id") {
      void copyText(row.id, "Event ID copied.");
      return;
    }
    if (actionId === "copy_message") {
      void copyText(row.message, "Log message copied.");
    }
  };

  const hint =
    sandboxNote && !embedded && !noteOpen ? (
      <PaymentPlayNoteHint onReplay={() => setNoteOpen(true)} label="Show payment logs notice" />
    ) : null;

  return (
    <div
      ref={nodeRef}
      className="admin-payments-methods-page admin-payments-methods-page--unified"
    >
      {sandboxNote && !embedded ? <PaymentPlayNote open={noteOpen} text={sandboxNote} /> : null}

      {!embedded ? (
        <div>
          <div className="data-payments-chart-title admin-payments-title-inline">
            Payment logs
            {hint}
          </div>
          <p className="data-payments-chart-desc">Technical events from the payment API and connected providers.</p>
        </div>
      ) : null}

      <MenuListSearchField
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search events, category, or payload…"
        aria-label="Search payment logs"
        filterGroups={LOGS_LIST_QUERY.filterGroups}
        sortOptions={LOGS_LIST_QUERY.sortOptions}
        defaultSort={LOGS_LIST_QUERY.defaultSort}
        activeFilters={activeFilters}
        activeSort={activeSort}
        totalCount={rows.length}
        resultCount={filtered.length}
        onFiltersChange={setActiveFilters}
        onSortChange={setActiveSort}
        filterTitle="Filter logs"
        filterSubtitle="Narrow by category or severity."
        sortTitle="Sort logs"
        sortSubtitle="Changes apply to the list instantly."
      />

      <div className="admin-payments-methods-list-toolbar">
        <div className="admin-payments-methods-family-chips" role="tablist" aria-label="Log categories">
          <button
            type="button"
            role="tab"
            aria-selected={categoryFilter === "all"}
            className={`admin-payments-methods-family-chip${categoryFilter === "all" ? " is-active" : ""}`}
            onClick={() => {
              pin();
              setCategoryFilter("all");
            }}
          >
            All
          </button>
          {categoryChipOptions.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={categoryFilter === category}
              className={`admin-payments-methods-family-chip${categoryFilter === category ? " is-active" : ""}`}
              onClick={() => {
                pin();
                setCategoryFilter(category);
              }}
            >
              {logCategoryLabel(category)}
            </button>
          ))}
        </div>
      </div>

      {source === "demo" || rows.some((r) => r.source === "demo") ? (
        <p className="admin-config-text-subtle text-xs">Showing sample activity from the payment event log.</p>
      ) : null}

      {filtered.length === 0 ? (
        <div ref={resultsRef} className="admin-payments-list-results">
          <p className="admin-config-text-muted py-2 text-sm">No logs match your search or filters.</p>
        </div>
      ) : (
        <div ref={resultsRef} className="admin-payments-list-results">
          <div className={`admin-payments-methods-grouped-list ${pager.pageClassName}`}>
            {listedSections.map((section) => (
              <section key={section.category} className="admin-payments-methods-family-section">
                {categoryFilter === "all" && section.label ? (
                  <h3 className="admin-payments-methods-family-heading">{section.label}</h3>
                ) : null}
                <ul className="admin-menu-surface-list admin-payments-methods-surface-list">
                  {section.rows.map((row, index) => {
                    const tone = logLevelTone(row.level);
                    return (
                      <li
                        key={row.id}
                        className="admin-menu-surface-list-item"
                        style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                      >
                        <div
                          className={`admin-menu-surface-card admin-payments-method-card-row is-${tone}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setDetailRow(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setDetailRow(row);
                            }
                          }}
                        >
                          <span className={`admin-menu-surface-status admin-payments-method-tone is-${tone}`}>
                            {logLevelLabel(row.level)}
                          </span>
                          <div className="admin-menu-surface-main">
                            <span className={`admin-menu-surface-name admin-payments-method-tone admin-payments-log-name is-${tone}`}>
                              {row.message}
                            </span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-desc">{logCategoryLabel(row.category)}</span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-meta">{formatWhen(row.at)}</span>
                          </div>
                          <div
                            className="admin-menu-surface-actions"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <MenuEntityActionsMenu
                              entityName={row.message}
                              subtitle={logCategoryLabel(row.category)}
                              hideHeader
                              open={openMenuId === row.id}
                              actions={[
                                { id: "view", label: "View details" },
                                { id: "copy_id", label: "Copy event ID" },
                                { id: "copy_message", label: "Copy message" }
                              ]}
                              onToggle={() => setOpenMenuId((cur) => (cur === row.id ? null : row.id))}
                              onAction={(id) => handleAction(row, id)}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          {pager.showPagination ? (
            <MenuSurfacePagination
              page={pager.page}
              totalPages={pager.totalPages}
              totalItems={pager.totalItems}
              pageSize={pager.pageSize}
              onPageChange={pager.goToPage}
              label="Payment logs pagination"
            />
          ) : null}
        </div>
      )}

      <PaymentLogDetailDrawer open={Boolean(detailRow)} log={detailRow} onClose={() => setDetailRow(null)} />
    </div>
  );
}
