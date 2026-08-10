import { useEffect, useMemo, useState } from "react";
import type { PaymentTransactionRow, PaymentTxnStatus, TodaysPaymentsDrillFilter } from "../../../api";
import { MenuListSearchField } from "../menu/MenuPageUi";
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
    return !methodMatches(txnMethod, provider, "swish") &&
      !methodMatches(txnMethod, provider, "apple_pay") &&
      !methodMatches(txnMethod, provider, "google_pay") &&
      !methodMatches(txnMethod, provider, "pay_at_venue") &&
      !methodMatches(txnMethod, provider, "card_terminal");
  }
  return m === wanted;
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

  useEffect(() => {
    if (!drillFilter) return;
    if (drillFilter.statuses?.length === 1) {
      const only = drillFilter.statuses[0];
      if (STATUS_FILTERS.includes(only)) setStatus(only);
      else setStatus("all");
    } else {
      setStatus("all");
    }
  }, [drillFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const idSet = drillFilter?.ids?.length ? new Set(drillFilter.ids) : null;
    const statuses = drillFilter?.statuses?.length ? new Set(drillFilter.statuses) : null;
    const methods = drillFilter?.methods?.length ? drillFilter.methods : null;

    return transactions.filter((t) => {
      if (idSet && !idSet.has(t.id)) return false;
      if (!idSet && statuses && !statuses.has(t.status)) return false;
      if (!idSet && methods && !methods.some((m) => methodMatches(t.method, t.provider, m))) return false;
      if (status !== "all" && t.status !== status) return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        (t.orderDisplay ?? "").toLowerCase().includes(q) ||
        (t.orderId ?? "").toLowerCase().includes(q) ||
        t.customerLabel.toLowerCase().includes(q) ||
        t.method.toLowerCase().includes(q) ||
        t.provider.toLowerCase().includes(q) ||
        t.status.includes(q)
      );
    });
  }, [transactions, search, status, drillFilter]);

  return (
    <div className="admin-payments-tab-stack">
      <div className="admin-payments-list-toolbar">
        <MenuListSearchField
          value={search}
          onChange={setSearch}
          placeholder="Search order, payment, customer…"
          aria-label="Search transactions"
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
            Showing {drillFilter.ids.length > 0 ? `${drillFilter.ids.length} ` : ""}
            payment{drillFilter.ids.length === 1 ? "" : "s"} from Today’s payments
            {drillFilter.day ? ` (${drillFilter.day})` : ""}.
          </span>
          {onClearDrill ? (
            <button type="button" className="admin-payments-drill-clear" onClick={onClearDrill}>
              Clear filter
            </button>
          ) : null}
        </div>
      ) : null}

      {source === "demo" ? (
        <p className="admin-config-text-subtle text-xs">
          Showing sample activity from the payment ledger.
        </p>
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
