import type { PaymentTransactionDetail } from "../../../api";
import { PayChip } from "./paymentsShared";
import { formatSekFromCents, formatWhen, methodLabel, txnStatusClass, txnStatusLabel } from "./paymentsUiHelpers";

type Props = {
  open: boolean;
  transaction: PaymentTransactionDetail | null;
  onClose: () => void;
};

export function PaymentTransactionDrawer({ open, transaction, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="admin-payments-drawer-root" role="dialog" aria-modal="true" aria-labelledby="payment-txn-drawer-title">
      <button type="button" className="admin-payments-drawer-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="admin-payments-drawer-panel">
        <header className="admin-payments-drawer-head">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] admin-config-text-muted">Transaction</p>
            <h3 id="payment-txn-drawer-title" className="mt-1 text-lg font-bold admin-config-text">
              {transaction ? formatSekFromCents(transaction.amountCents, transaction.currency) : "—"}
            </h3>
          </div>
          <button type="button" className="admin-payments-drawer-close" onClick={onClose}>
            Close
          </button>
        </header>
        {transaction ? (
          <div className="admin-payments-drawer-body">
            <div className="grid gap-2">
              <div className="admin-payments-kv">
                <span>Status</span>
                <span className={`admin-payments-status-pill ${txnStatusClass(transaction.status)}`}>
                  {txnStatusLabel(transaction.status)}
                </span>
              </div>
              <div className="admin-payments-kv">
                <span>Order</span>
                <strong>{transaction.orderDisplay ?? transaction.orderId ?? "—"}</strong>
              </div>
              <div className="admin-payments-kv">
                <span>Customer</span>
                <strong>{transaction.customerLabel}</strong>
              </div>
              <div className="admin-payments-kv">
                <span>Method</span>
                <strong>{methodLabel(transaction.method)}</strong>
              </div>
              <div className="admin-payments-kv">
                <span>Provider</span>
                <strong>{transaction.provider}</strong>
              </div>
              <div className="admin-payments-kv">
                <span>Tip</span>
                <strong>{formatSekFromCents(transaction.tipCents, transaction.currency)}</strong>
              </div>
              <div className="admin-payments-kv">
                <span>Fee</span>
                <strong>{formatSekFromCents(transaction.feeCents, transaction.currency)}</strong>
              </div>
              <div className="admin-payments-kv">
                <span>Net</span>
                <strong>{formatSekFromCents(transaction.netCents, transaction.currency)}</strong>
              </div>
              {transaction.source === "demo" ? <PayChip tone="muted">Demo ledger</PayChip> : null}
            </div>

            <div className="admin-payments-timeline mt-6">
              <p className="text-xs font-bold uppercase tracking-wide admin-config-text-muted mb-3">Payment timeline</p>
              <ol>
                {transaction.timeline.map((ev, i) => (
                  <li key={`${ev.type}-${i}`}>
                    <span className="admin-payments-timeline-time">{formatWhen(ev.at)}</span>
                    <span className="admin-payments-timeline-label">{ev.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <p className="p-5 admin-config-text-muted text-sm">Loading transaction…</p>
        )}
      </aside>
    </div>
  );
}
