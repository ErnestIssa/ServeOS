import type { PaymentRefundRow } from "../../../api";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";
import { PayChip } from "./paymentsShared";
import { formatSekFromCents, formatWhen, refundStatusLabel } from "./paymentsUiHelpers";

type Props = {
  open: boolean;
  refund: PaymentRefundRow | null;
  onClose: () => void;
};

export function RefundDetailModal({ open, refund, onClose }: Props) {
  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title="Refund details"
      description="Refund lifecycle from request through provider settlement."
      titleId="payment-refund-detail"
      maxWidthClass="max-w-lg"
    >
      {refund ? (
        <div className="grid gap-2">
          <div className="admin-payments-kv">
            <span>Status</span>
            <PayChip tone={refund.status === "completed" ? "success" : refund.status === "failed" ? "danger" : "warning"}>
              {refundStatusLabel(refund.status)}
            </PayChip>
          </div>
          <div className="admin-payments-kv">
            <span>Amount</span>
            <strong>{formatSekFromCents(refund.amountCents, refund.currency)}</strong>
          </div>
          <div className="admin-payments-kv">
            <span>Original payment</span>
            <strong>{refund.paymentId}</strong>
          </div>
          <div className="admin-payments-kv">
            <span>Order</span>
            <strong>{refund.orderId ?? "—"}</strong>
          </div>
          <div className="admin-payments-kv">
            <span>Reason</span>
            <strong>{refund.reason}</strong>
          </div>
          <div className="admin-payments-kv">
            <span>Requested by</span>
            <strong>{refund.requestedBy}</strong>
          </div>
          <div className="admin-payments-kv">
            <span>Approved by</span>
            <strong>{refund.approvedBy ?? "—"}</strong>
          </div>
          <div className="admin-payments-kv">
            <span>Provider</span>
            <strong>{refund.provider}</strong>
          </div>
          <div className="admin-payments-kv">
            <span>Created</span>
            <strong>{formatWhen(refund.createdAt)}</strong>
          </div>
          <div className="admin-payments-kv">
            <span>Completed</span>
            <strong>{formatWhen(refund.completedAt)}</strong>
          </div>
        </div>
      ) : (
        <p className="admin-config-text-muted text-sm">No refund selected.</p>
      )}
      <ProfileModalFooter cancelLabel="Close" confirmLabel="Done" onCancel={onClose} onConfirm={onClose} />
    </MenuPageModalShell>
  );
}
