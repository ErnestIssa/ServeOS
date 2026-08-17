import { DetailsDrawerShell, DetailsRow } from "../menu/detailsDrawerUi";
import { formatSekFromCents, formatWhen } from "./paymentsUiHelpers";
import {
  mismatchStatusBadge,
  mismatchTone,
  mismatchTypeLabel,
  providerLabel,
  type ReconciliationMismatchRow
} from "./reconciliationMismatches";

type Props = {
  open: boolean;
  mismatch: ReconciliationMismatchRow | null;
  onClose: () => void;
};

export function ReconciliationMismatchDrawer({ open, mismatch, onClose }: Props) {
  const tone = mismatch ? mismatchTone(mismatch) : "inactive";

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={mismatch?.id ?? "mismatch-detail"}
      kicker="Reconciliation"
      title={mismatch ? mismatchTypeLabel(mismatch.type) : "Mismatch"}
      subtitle={mismatch?.summary ?? "A difference between ServeOS and the payment provider."}
      closeLabel="Close mismatch details"
      onClose={onClose}
      badge={
        mismatch ? (
          <span className={`admin-menu-surface-status admin-payments-method-tone is-${tone}`}>
            {mismatchStatusBadge(mismatch.status)}
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
      {mismatch ? (
        <div className="admin-payments-provider-detail">
          <DetailsRow label="Type" value={mismatchTypeLabel(mismatch.type)} />
          <DetailsRow label="Status" value={mismatchStatusBadge(mismatch.status)} />
          <DetailsRow label="Summary" value={mismatch.summary} />
          <DetailsRow
            label="Amount"
            value={mismatch.amountCents != null ? formatSekFromCents(mismatch.amountCents) : "—"}
          />
          <DetailsRow label="Order" value={mismatch.orderId ?? "—"} />
          <DetailsRow label="Payment" value={mismatch.paymentId ?? "—"} />
          <DetailsRow label="Provider" value={providerLabel(mismatch.provider)} />
          <DetailsRow label="Opened" value={formatWhen(mismatch.createdAt)} />
        </div>
      ) : (
        <p className="admin-config-text-muted text-sm">No mismatch selected.</p>
      )}
    </DetailsDrawerShell>
  );
}
