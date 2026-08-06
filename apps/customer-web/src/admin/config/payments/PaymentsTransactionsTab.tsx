import { useMemo, useState } from "react";
import type { PaymentTransactionRow, PaymentTxnStatus } from "../../../api";
import { MenuListSearchField } from "../menu/MenuPageUi";
import { PayChip } from "./paymentsShared";
import { formatSekFromCents, formatWhen, methodLabel, txnStatusClass, txnStatusLabel } from "./paymentsUiHelpers";

type Props = {
  transactions: PaymentTransactionRow[];
  source?: "live" | "demo";
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

export function PaymentsTransactionsTab({ transactions, source, onOpen }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentTxnStatus | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
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
  }, [transactions, search, status]);

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

      {source === "demo" ? (
        <p className="admin-config-text-subtle text-xs">Showing demo ledger rows from the payment API (no live payment refs yet).</p>
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
