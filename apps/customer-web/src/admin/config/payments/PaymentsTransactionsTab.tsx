import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PaymentTransactionRow, PaymentTxnStatus, TodaysPaymentsDrillFilter } from "../../../api";
import { useAdminToast } from "../../AdminToast";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { MenuListSearchField, usePinnedViewportNode } from "../menu/MenuPageUi";
import { MenuSurfacePagination } from "../menu/MenuSurfacePagination";
import type { MenuListFilterGroup, MenuListToolOption } from "../menu/menuListQuery";
import { MENU_LIST_PAGE_SIZE, useMenuListPagination } from "../menu/useMenuListPagination";
import { PaymentMethodGlyph } from "./paymentsFormControls";
import { formatSekFromCents, formatWhen, methodLabel, txnStatusLabel } from "./paymentsUiHelpers";
import { toTransactionRows } from "./transactionDemoData";

type Props = {
  transactions: PaymentTransactionRow[];
  source?: "live" | "demo";
  drillFilter?: TodaysPaymentsDrillFilter | null;
  onClearDrill?: () => void;
  onOpen: (txn: PaymentTransactionRow) => void;
};

const TXN_STATUS_ORDER: PaymentTxnStatus[] = [
  "pending",
  "authorized",
  "captured",
  "partially_refunded",
  "refunded",
  "disputed",
  "failed",
  "cancelled",
  "charged_back"
];

const FILTER_GROUPS: MenuListFilterGroup[] = [
  {
    id: "status",
    label: "Status",
    options: TXN_STATUS_ORDER.map((s) => ({
      id: `status:${s}`,
      label: txnStatusLabel(s)
    }))
  },
  {
    id: "method",
    label: "Method",
    options: [
      { id: "method:card", label: "Card" },
      { id: "method:swish", label: "Swish" },
      { id: "method:apple_pay", label: "Apple Pay" },
      { id: "method:google_pay", label: "Google Pay" },
      { id: "method:card_terminal", label: "Card terminal" },
      { id: "method:pay_at_venue", label: "Cash / pay at venue" }
    ]
  },
  {
    id: "day",
    label: "Day",
    options: [{ id: "day:preset", label: "Selected day only" }]
  }
];

const SORT_OPTIONS: MenuListToolOption[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "amount_desc", label: "Highest amount" },
  { id: "amount_asc", label: "Lowest amount" }
];

function methodMatches(txnMethod: string, provider: string, wanted: string): boolean {
  const m = txnMethod.toLowerCase();
  const p = provider.toLowerCase();
  if (wanted === "pay_at_venue") {
    return m.includes("cash") || m.includes("pay_at_venue") || m.includes("venue") || p === "manual";
  }
  if (wanted === "swish") return m.includes("swish") || p.includes("swish");
  if (wanted === "apple_pay") return m.includes("apple");
  if (wanted === "google_pay") return m.includes("google");
  if (wanted === "card_terminal") return m.includes("terminal");
  if (wanted === "card") {
    return (
      !methodMatches(txnMethod, provider, "swish") &&
      !methodMatches(txnMethod, provider, "apple_pay") &&
      !methodMatches(txnMethod, provider, "google_pay") &&
      !methodMatches(txnMethod, provider, "pay_at_venue") &&
      !methodMatches(txnMethod, provider, "card_terminal")
    );
  }
  return m === wanted || m.replace(/-/g, "_") === wanted;
}

function inDayWindow(iso: string, dayStart?: string, dayEnd?: string, day?: string) {
  if (dayStart && dayEnd) {
    const t = new Date(iso).getTime();
    return t >= new Date(dayStart).getTime() && t < new Date(dayEnd).getTime();
  }
  if (day) return iso.slice(0, 10) === day || iso.includes(day);
  return true;
}

function txnStatusTone(status: PaymentTxnStatus): "active" | "pending" | "setup" | "issue" | "inactive" {
  if (status === "captured" || status === "authorized") return "active";
  if (status === "pending") return "pending";
  if (status === "failed" || status === "cancelled" || status === "charged_back") return "issue";
  if (status === "disputed" || status === "partially_refunded") return "setup";
  return "inactive";
}

function groupTransactionsByStatus(rows: PaymentTransactionRow[]) {
  return TXN_STATUS_ORDER.map((status) => ({
    status,
    label: txnStatusLabel(status),
    rows: rows.filter((row) => row.status === status)
  })).filter((section) => section.rows.length > 0);
}

export function PaymentsTransactionsTab({
  transactions,
  source,
  drillFilter = null,
  onClearDrill,
  onOpen
}: Props) {
  const { pushToast } = useAdminToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentTxnStatus | "all">("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState("newest");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { nodeRef, pin } = usePinnedViewportNode();
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultsMinHeightRef = useRef(0);

  const rows = useMemo(() => toTransactionRows(transactions), [transactions]);

  useEffect(() => {
    if (!drillFilter) return;
    if (drillFilter.searchPreset) setSearch(drillFilter.searchPreset);
    const nextFilters: string[] = [];
    if (drillFilter.day || drillFilter.dayStart) nextFilters.push("day:preset");
    if (drillFilter.statuses?.length === 1) {
      const only = drillFilter.statuses[0];
      nextFilters.push(`status:${only}`);
      if (TXN_STATUS_ORDER.includes(only)) setStatus(only);
      else setStatus("all");
    } else {
      setStatus("all");
    }
    if (drillFilter.methods?.length) {
      for (const m of drillFilter.methods) nextFilters.push(`method:${m}`);
    }
    setActiveFilters(nextFilters);
  }, [drillFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const idSet = drillFilter?.ids?.length ? new Set(drillFilter.ids) : null;
    const statusFilters = activeFilters
      .filter((f) => f.startsWith("status:"))
      .map((f) => f.slice("status:".length) as PaymentTxnStatus);
    const methodFilters = activeFilters
      .filter((f) => f.startsWith("method:"))
      .map((f) => f.slice("method:".length));
    const dayPreset = activeFilters.includes("day:preset");

    let next = rows.filter((t) => {
      if (idSet && !idSet.has(t.id) && !dayPreset) return false;
      if (dayPreset && !inDayWindow(t.createdAt, drillFilter?.dayStart, drillFilter?.dayEnd, drillFilter?.day)) {
        return false;
      }
      if (status !== "all" && t.status !== status) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(t.status)) return false;
      if (methodFilters.length > 0 && !methodFilters.some((m) => methodMatches(t.method, t.provider, m))) {
        return false;
      }
      if (!q) return true;
      const dayMatch =
        drillFilter?.day && (q === drillFilter.day.toLowerCase() || q.includes(drillFilter.day.toLowerCase()));
      if (dayMatch) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        (t.orderDisplay ?? "").toLowerCase().includes(q) ||
        (t.orderId ?? "").toLowerCase().includes(q) ||
        t.customerLabel.toLowerCase().includes(q) ||
        t.method.toLowerCase().includes(q) ||
        t.provider.toLowerCase().includes(q) ||
        t.status.includes(q) ||
        t.createdAt.toLowerCase().includes(q)
      );
    });

    next = [...next].sort((a, b) => {
      if (activeSort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (activeSort === "amount_desc") return b.amountCents - a.amountCents;
      if (activeSort === "amount_asc") return a.amountCents - b.amountCents;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return next;
  }, [rows, search, status, drillFilter, activeFilters, activeSort]);

  const pager = useMenuListPagination(filtered, {
    pageSize: MENU_LIST_PAGE_SIZE,
    resetKey: `${search}:${activeFilters.join(",")}:${activeSort}:${status}:${drillFilter?.day ?? ""}`
  });
  const paged = pager.pagedItems;
  const sections = useMemo(() => groupTransactionsByStatus(paged), [paged]);
  const listedSections = status === "all" ? sections : [{ status, label: "", rows: paged }];
  const statusChipOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.status));
    return TXN_STATUS_ORDER.filter((s) => present.has(s));
  }, [rows]);

  useLayoutEffect(() => {
    const el = resultsRef.current;
    if (!el) return;
    resultsMinHeightRef.current = Math.max(resultsMinHeightRef.current, el.getBoundingClientRect().height);
    el.style.minHeight = `${resultsMinHeightRef.current}px`;
  }, [filtered, paged, status]);

  const copyText = async (value: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast(ok, "success");
    } catch {
      pushToast("Could not copy to clipboard.", "error");
    }
  };

  const handleAction = (row: PaymentTransactionRow, actionId: string) => {
    setOpenMenuId(null);
    if (actionId === "view") {
      onOpen(row);
      return;
    }
    if (actionId === "copy_id") {
      void copyText(row.id, "Transaction ID copied.");
      return;
    }
    if (actionId === "copy_order" && (row.orderDisplay || row.orderId)) {
      void copyText(row.orderDisplay ?? row.orderId ?? "", "Order ID copied.");
    }
  };

  return (
    <div ref={nodeRef} className="admin-payments-methods-page admin-payments-methods-page--unified">
      <MenuListSearchField
        value={search}
        onChange={setSearch}
        placeholder="Search order, payment, customer, or day…"
        aria-label="Search transactions"
        filterGroups={FILTER_GROUPS}
        sortOptions={SORT_OPTIONS}
        activeFilters={activeFilters}
        activeSort={activeSort}
        defaultSort="newest"
        resultCount={filtered.length}
        totalCount={rows.length}
        onFiltersChange={setActiveFilters}
        onSortChange={setActiveSort}
        filterTitle="Filter payments"
        filterSubtitle="Narrow by status, method, or the selected venue day."
        sortTitle="Sort payments"
        sortSubtitle="Order the transaction list instantly."
      />

      <div className="admin-payments-methods-list-toolbar">
        <div className="admin-payments-methods-family-chips" role="tablist" aria-label="Transaction status groups">
          <button
            type="button"
            role="tab"
            aria-selected={status === "all"}
            className={`admin-payments-methods-family-chip${status === "all" ? " is-active" : ""}`}
            onClick={() => {
              pin();
              setStatus("all");
            }}
          >
            All
          </button>
          {statusChipOptions.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              className={`admin-payments-methods-family-chip${status === s ? " is-active" : ""}`}
              onClick={() => {
                pin();
                setStatus(s);
              }}
            >
              {txnStatusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {drillFilter ? (
        <div className="admin-payments-drill-banner">
          <span>
            Showing payments for venue day {drillFilter.day}
            {drillFilter.searchPreset ? ` · search “${drillFilter.searchPreset}”` : ""}.
          </span>
          {onClearDrill ? (
            <button
              type="button"
              className="admin-payments-drill-clear"
              onClick={() => {
                setSearch("");
                setActiveFilters([]);
                setStatus("all");
                onClearDrill();
              }}
            >
              Clear filter
            </button>
          ) : null}
        </div>
      ) : null}

      {source === "demo" || rows.some((r) => r.source === "demo") ? (
        <p className="admin-config-text-subtle text-xs">Showing sample activity from the payment ledger.</p>
      ) : null}

      {filtered.length === 0 ? (
        <div ref={resultsRef} className="admin-payments-list-results">
          <p className="admin-config-text-muted py-2 text-sm">No transactions match your search or filters.</p>
        </div>
      ) : (
        <div ref={resultsRef} className="admin-payments-list-results">
          <div className={`admin-payments-methods-grouped-list ${pager.pageClassName}`}>
            {listedSections.map((section) => (
              <section key={section.status} className="admin-payments-methods-family-section">
                {status === "all" && section.label ? (
                  <h3 className="admin-payments-methods-family-heading">{section.label}</h3>
                ) : null}
                <ul className="admin-menu-surface-list admin-payments-methods-surface-list">
                  {section.rows.map((row, index) => {
                    const tone = txnStatusTone(row.status);
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
                          onClick={() => onOpen(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onOpen(row);
                            }
                          }}
                        >
                          <span className={`admin-menu-surface-status admin-payments-method-tone is-${tone}`}>
                            {txnStatusLabel(row.status)}
                          </span>
                          <PaymentMethodGlyph methodKey={row.method} />
                          <div className="admin-menu-surface-main">
                            <span className={`admin-menu-surface-name admin-payments-method-tone is-${tone}`}>
                              {formatSekFromCents(row.amountCents, row.currency)}
                            </span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-desc">{row.customerLabel}</span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-meta">
                              {row.orderDisplay ?? row.orderId ?? "No order"} · {methodLabel(row.method)} ·{" "}
                              {formatWhen(row.createdAt)}
                            </span>
                          </div>
                          <div
                            className="admin-menu-surface-actions"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <MenuEntityActionsMenu
                              entityName={formatSekFromCents(row.amountCents, row.currency)}
                              subtitle={row.customerLabel}
                              hideHeader
                              open={openMenuId === row.id}
                              actions={[
                                { id: "view", label: "View details" },
                                { id: "copy_id", label: "Copy transaction ID" },
                                ...(row.orderId || row.orderDisplay
                                  ? [{ id: "copy_order", label: "Copy order ID" }]
                                  : [])
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
              label="Transactions pagination"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
