import { useState } from "react";
import type { PaymentRefundRow } from "../../../api";
import { DetailsDrawerShell } from "../menu/detailsDrawerUi";
import { PaymentMethodGlyph } from "./paymentsFormControls";
import { formatSekFromCents, formatWhen, methodLabel } from "./paymentsUiHelpers";
import { RefundReceiptModal } from "./RefundReceiptModal";
import {
  methodKeyFromRefund,
  refundStatusBadge,
  refundStatusTone,
  type RefundListRow
} from "./refundsListQuery";

type Props = {
  open: boolean;
  refund: PaymentRefundRow | null;
  onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-payments-provider-detail-row">
      <span className="admin-payments-provider-detail-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function toListRow(refund: PaymentRefundRow): RefundListRow {
  const existing = refund as RefundListRow;
  const methodKey = existing.methodKey || methodKeyFromRefund(refund);
  return {
    ...refund,
    methodKey,
    methodLabel: existing.methodLabel || methodLabel(methodKey),
    guestName: existing.guestName || refund.requestedBy
  };
}

export function RefundDetailModal({ open, refund, onClose }: Props) {
  const [receiptOpen, setReceiptOpen] = useState(false);
  const listRow = refund ? toListRow(refund) : null;
  const tone = refund ? refundStatusTone(refund.status) : "inactive";

  return (
    <>
      <DetailsDrawerShell
        open={open}
        entityKey={refund?.id ?? "refund-detail"}
        kicker="Refunds"
        title={refund ? formatSekFromCents(refund.amountCents, refund.currency) : "Refund"}
        subtitle={refund ? refund.reason : "Refund lifecycle from request through provider settlement."}
        closeLabel="Close refund details"
        onClose={onClose}
        badge={
          refund ? (
            <span className={`admin-menu-surface-status admin-payments-method-tone is-${tone}`}>
              {refundStatusBadge(refund.status)}
            </span>
          ) : null
        }
        footer={
          <div className="admin-payments-rule-footer">
            <button type="button" className="admin-profile-modal-btn admin-profile-modal-btn--ghost" onClick={onClose}>
              Close
            </button>
            {listRow ? (
              <button
                type="button"
                className="admin-profile-modal-btn admin-profile-modal-btn--primary"
                onClick={() => setReceiptOpen(true)}
              >
                Preview receipt
              </button>
            ) : null}
          </div>
        }
      >
        {refund ? (
          <div className="admin-payments-provider-detail">
            {listRow?.methodKey ? (
              <div className="admin-payments-refund-detail-method">
                <PaymentMethodGlyph methodKey={listRow.methodKey} />
                <span>{listRow.methodLabel || listRow.methodKey}</span>
              </div>
            ) : null}
            <DetailRow label="Guest" value={listRow?.guestName || "—"} />
            <DetailRow label="Amount" value={formatSekFromCents(refund.amountCents, refund.currency)} />
            <DetailRow label="Original payment" value={refund.paymentId} />
            <DetailRow label="Order" value={refund.orderId ?? "—"} />
            <DetailRow label="Reason" value={refund.reason} />
            <DetailRow label="Requested by" value={refund.requestedBy} />
            <DetailRow label="Approved by" value={refund.approvedBy ?? "—"} />
            <DetailRow label="Provider" value={refund.provider} />
            <DetailRow label="Created" value={formatWhen(refund.createdAt)} />
            <DetailRow label="Completed" value={formatWhen(refund.completedAt)} />
          </div>
        ) : (
          <p className="admin-config-text-muted text-sm">No refund selected.</p>
        )}
      </DetailsDrawerShell>
      <RefundReceiptModal open={receiptOpen} refund={listRow} onClose={() => setReceiptOpen(false)} />
    </>
  );
}
