import { MenuPageModalShell } from "../menu/menuPageModalShell";
import { useAdminToast } from "../../AdminToast";
import { PaymentMethodGlyph } from "./paymentsFormControls";
import { formatSekFromCents, formatWhen } from "./paymentsUiHelpers";
import { refundStatusBadge } from "./refundsListQuery";
import type { RefundListRow } from "./refundsListQuery";

type Props = {
  open: boolean;
  refund: RefundListRow | null;
  venueName?: string;
  onClose: () => void;
};

export function RefundReceiptModal({ open, refund, venueName = "ServeOS venue", onClose }: Props) {
  const { pushToast } = useAdminToast();
  const isRefundSlip = refund?.status === "completed" || refund?.status === "partially_refunded";

  const copyId = async () => {
    if (!refund) return;
    try {
      await navigator.clipboard.writeText(refund.orderId ?? refund.id);
      pushToast("Receipt reference copied.", "success");
    } catch {
      pushToast("Could not copy to clipboard.", "error");
    }
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title=""
      description={isRefundSlip ? "Refund receipt preview" : "Original payment receipt preview"}
      titleId="refund-receipt-preview"
      maxWidthClass="max-w-sm"
      stackLevel="overlay"
    >
      {refund ? (
        <>
          <div className="admin-payments-refund-receipt">
            <p className="admin-payments-refund-receipt-kicker">{venueName}</p>
            <h3 className="admin-payments-refund-receipt-title">{isRefundSlip ? "Refund receipt" : "Payment receipt"}</h3>
            <p className="admin-payments-refund-receipt-id">{refund.orderId ?? refund.paymentId}</p>
            <div className="admin-payments-refund-receipt-rule" />
            <div className="admin-payments-refund-receipt-row">
              <span>Guest</span>
              <strong>{refund.guestName}</strong>
            </div>
            <div className="admin-payments-refund-receipt-row">
              <span>Method</span>
              <strong className="admin-payments-refund-receipt-method">
                <PaymentMethodGlyph methodKey={refund.methodKey} />
                {refund.methodLabel}
              </strong>
            </div>
            <div className="admin-payments-refund-receipt-row">
              <span>{isRefundSlip ? "Refunded" : "Charged"}</span>
              <strong>{formatSekFromCents(refund.amountCents, refund.currency)}</strong>
            </div>
            <div className="admin-payments-refund-receipt-row">
              <span>Reason</span>
              <strong>{refund.reason}</strong>
            </div>
            <div className="admin-payments-refund-receipt-row">
              <span>Status</span>
              <strong>{refundStatusBadge(refund.status)}</strong>
            </div>
            <div className="admin-payments-refund-receipt-rule" />
            <div className="admin-payments-refund-receipt-row">
              <span>Staff</span>
              <strong>{refund.approvedBy ?? refund.requestedBy}</strong>
            </div>
            <div className="admin-payments-refund-receipt-row">
              <span>{isRefundSlip && refund.completedAt ? "Completed" : "Created"}</span>
              <strong>{formatWhen(isRefundSlip ? refund.completedAt : refund.createdAt)}</strong>
            </div>
            <p className="admin-payments-refund-receipt-foot">Thank you — this is a preview only.</p>
          </div>
          <div className="admin-payments-refund-receipt-actions">
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
              onClick={() => void copyId()}
            >
              Copy ID
            </button>
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
              onClick={() => pushToast(`Receipt emailed to ${refund.guestName}.`, "success")}
            >
              Email
            </button>
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
              onClick={() => pushToast("Receipt sent to the printer.", "success")}
            >
              Print
            </button>
            <button type="button" className="admin-profile-modal-btn admin-profile-modal-btn--primary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      ) : (
        <p className="admin-config-text-muted text-sm">No refund selected.</p>
      )}
    </MenuPageModalShell>
  );
}
