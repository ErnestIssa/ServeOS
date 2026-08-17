import type { PaymentTransactionDetail, PaymentTxnStatus } from "../../../api";
import { DetailsDrawerShell, DetailsRow, DetailsSection } from "../menu/detailsDrawerUi";
import { PaymentMethodGlyph } from "./paymentsFormControls";
import { formatSekFromCents, formatWhen, methodLabel, txnStatusLabel } from "./paymentsUiHelpers";

type Props = {
  open: boolean;
  transaction: PaymentTransactionDetail | null;
  onClose: () => void;
};

function txnStatusTone(status: PaymentTxnStatus): "active" | "pending" | "setup" | "issue" | "inactive" {
  if (status === "captured" || status === "authorized") return "active";
  if (status === "pending") return "pending";
  if (status === "failed" || status === "cancelled" || status === "charged_back") return "issue";
  if (status === "disputed" || status === "partially_refunded") return "setup";
  return "inactive";
}

export function PaymentTransactionDrawer({ open, transaction, onClose }: Props) {
  const tone = transaction ? txnStatusTone(transaction.status) : "inactive";

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={transaction?.id ?? "txn-detail"}
      kicker="Transactions"
      title={transaction ? formatSekFromCents(transaction.amountCents, transaction.currency) : "Transaction"}
      subtitle={
        transaction
          ? `${transaction.customerLabel} · ${methodLabel(transaction.method)}`
          : "Payment ledger entry for this venue."
      }
      closeLabel="Close transaction details"
      onClose={onClose}
      badge={
        transaction ? (
          <span className={`admin-menu-surface-status admin-payments-method-tone is-${tone}`}>
            {txnStatusLabel(transaction.status)}
          </span>
        ) : null
      }
      footer={
        <div className="admin-payments-rule-footer">
          <button type="button" className="admin-profile-modal-btn admin-profile-modal-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      {transaction ? (
        <div className="admin-payments-provider-detail">
          <div className="admin-payments-refund-detail-method">
            <PaymentMethodGlyph methodKey={transaction.method} />
            <span>{methodLabel(transaction.method)}</span>
          </div>
          <DetailsRow label="Status" value={txnStatusLabel(transaction.status)} />
          <DetailsRow label="Order" value={transaction.orderDisplay ?? transaction.orderId ?? "—"} />
          <DetailsRow label="Customer" value={transaction.customerLabel} />
          <DetailsRow label="Provider" value={transaction.provider} />
          <DetailsRow label="Amount" value={formatSekFromCents(transaction.amountCents, transaction.currency)} />
          <DetailsRow label="Tip" value={formatSekFromCents(transaction.tipCents, transaction.currency)} />
          <DetailsRow label="Fee" value={formatSekFromCents(transaction.feeCents, transaction.currency)} />
          <DetailsRow label="Net" value={formatSekFromCents(transaction.netCents, transaction.currency)} />
          <DetailsRow label="Refunded" value={formatSekFromCents(transaction.refundedCents, transaction.currency)} />
          <DetailsRow label="Created" value={formatWhen(transaction.createdAt)} />
          <DetailsRow label="Updated" value={formatWhen(transaction.updatedAt)} />
          <DetailsRow label="Transaction ID" value={transaction.id} />
          {transaction.source === "demo" ? <DetailsRow label="Source" value="Sample ledger" /> : null}

          {transaction.timeline.length > 0 ? (
            <DetailsSection title="Payment timeline" hint="Events from create through capture, refund, or dispute.">
              <div className="admin-payments-timeline">
                <ol>
                  {transaction.timeline.map((ev, i) => (
                    <li key={`${ev.type}-${i}`}>
                      <span className="admin-payments-timeline-time">{formatWhen(ev.at)}</span>
                      <span className="admin-payments-timeline-label">{ev.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </DetailsSection>
          ) : null}
        </div>
      ) : (
        <p className="admin-config-text-muted text-sm">Loading transaction…</p>
      )}
    </DetailsDrawerShell>
  );
}
