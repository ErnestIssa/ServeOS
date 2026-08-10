import { useEffect, useMemo, useState } from "react";
import type { PaymentTransactionRow, PaymentTxnStatus, TodaysPaymentsDrillFilter } from "../../../api";
import { MenuListSearchField } from "../menu/MenuPageUi";
import type { MenuListFilterGroup, MenuListToolOption } from "../menu/menuListQuery";
import { PayChip } from "./paymentsShared";
import { formatSekFromCents, formatWhen, methodLabel, txnStatusClass, txnStatusLabel } from "./paymentsUiHelpers";

type Props = {
  transactions: PaymentTransactionRow[];
  source?: "live" | "demo";
  drillFilter?: TodaysPaymentsDrillFilter | null;
  onClearDrill?: () => void;
  onOpen: (txn: PaymentTransactionRow) => void;
};

const STATUS_FILTERS: Array<PaymentTxnStatus | "all"> = [
  "all",
  "pending",
  "captured",
  "failed",
  "partially_refunded",
  "refunded",
  "disputed"
];

const FILTER_GROUPS: MenuListFilterGroup[] = [
  {
    id: "status",
    label: "Status",
    options: STATUS_FILTERS.filter((s) => s !== "all").map((s) => ({
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

export function PaymentsTransactionsTab({
  transactions,
  source,
  drillFilter = null,
  onClearDrill,
  onOpen
}: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentTxnStatus | "all">("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState("newest");

  useEffect(() => {
    if (!drillFilter) return;
    if (drillFilter.searchPreset) setSearch(drillFilter.searchPreset);
    const nextFilters: string[] = [];
    if (drillFilter.day || drillFilter.dayStart) nextFilters.push("day:preset");
    if (drillFilter.statuses?.length === 1) {
      const only = drillFilter.statuses[0];
      nextFilters.push(`status:${only}`);
      if (STATUS_FILTERS.includes(only)) setStatus(only);
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

    let rows = transactions.filter((t) => {
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
      const dayMatch = drillFilter?.day && (q === drillFilter.day.toLowerCase() || q.includes(drillFilter.day.toLowerCase()));
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

    rows = [...rows].sort((a, b) => {
      if (activeSort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (activeSort === "amount_desc") return b.amountCents - a.amountCents;
      if (activeSort === "amount_asc") return a.amountCents - b.amountCents;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return rows;
  }, [transactions, search, status, drillFilter, activeFilters, activeSort]);

  return (
    <div className="admin-payments-tab-stack">
      <div className="admin-payments-list-toolbar">
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
          totalCount={transactions.length}
          onFiltersChange={setActiveFilters}
          onSortChange={setActiveSort}
          filterTitle="Filter payments"
          filterSubtitle="Narrow by status, method, or the selected venue day."
          sortTitle="Sort payments"
          sortSubtitle="Order the transaction list instantly."
        />
        <div className="admin-payments-filter-chips" role="tablist" aria-label="Status filter">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              className={`admin-payments-filter-chip${status === s ? " is-active" : ""}`}
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "All" : txnStatusLabel(s)}
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

      {source === "demo" ? (
        <p className="admin-config-text-subtle text-xs">Showing sample activity from the payment ledger.</p>
      ) : null}

      <div className="admin-payments-table-wrap">
        <table className="admin-payments-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Method</th>
              <th>Status</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-config-text-muted">
                  No transactions match.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="is-clickable" onClick={() => onOpen(t)}>
                  <td>{formatWhen(t.createdAt)}</td>
                  <td>{t.orderDisplay ?? t.orderId ?? "—"}</td>
                  <td>{t.customerLabel}</td>
                  <td>
                    {methodLabel(t.method)}
                    <span className="admin-config-text-subtle block text-[11px]">{t.provider}</span>
                  </td>
                  <td>
                    <span className={`admin-payments-status-pill ${txnStatusClass(t.status)}`}>
                      {txnStatusLabel(t.status)}
                    </span>
                  </td>
                  <td className="text-right font-semibold">
                    {formatSekFromCents(t.amountCents, t.currency)}
                    {t.refundedCents > 0 ? (
                      <span className="admin-config-text-subtle block text-[11px]">
                        −{formatSekFromCents(t.refundedCents, t.currency)} refunded
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <PayChip tone="muted">{filtered.length} shown</PayChip>
        <PayChip tone="muted">{transactions.length} total</PayChip>
      </div>
    </div>
  );
}
