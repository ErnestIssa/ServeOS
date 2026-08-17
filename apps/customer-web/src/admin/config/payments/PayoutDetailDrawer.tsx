import type { PaymentPayoutRow } from "../../../api";
import { DetailsDrawerShell, DetailsRow } from "../menu/detailsDrawerUi";
import { formatSekFromCents, formatWhen } from "./paymentsUiHelpers";
import { payoutStatusBadge, payoutStatusTone } from "./payoutsListQuery";
import { providerLabel } from "./reconciliationMismatches";

type Props = {
  open: boolean;
  payout: PaymentPayoutRow | null;
  onClose: () => void;
};

export function PayoutDetailDrawer({ open, payout, onClose }: Props) {
  const tone = payout ? payoutStatusTone(payout.status) : "inactive";

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={payout?.id ?? "payout-detail"}
      kicker="Payouts"
      title={payout ? formatSekFromCents(payout.netCents, payout.currency) : "Payout"}
      subtitle={payout ? `${providerLabel(payout.provider)} settlement` : "Provider deposit into the venue bank account."}
      closeLabel="Close payout details"
      onClose={onClose}
      badge={
        payout ? (
          <span className={`admin-menu-surface-status admin-payments-method-tone is-${tone}`}>
            {payoutStatusBadge(payout.status)}
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
      {payout ? (
        <div className="admin-payments-provider-detail">
          <DetailsRow label="Status" value={payoutStatusBadge(payout.status)} />
          <DetailsRow label="Provider" value={providerLabel(payout.provider)} />
          <DetailsRow label="Net" value={formatSekFromCents(payout.netCents, payout.currency)} />
          <DetailsRow label="Gross" value={formatSekFromCents(payout.grossCents, payout.currency)} />
          <DetailsRow label="Fees" value={formatSekFromCents(payout.feesCents, payout.currency)} />
          <DetailsRow label="Refunds" value={formatSekFromCents(payout.refundsCents, payout.currency)} />
          <DetailsRow label="Tips" value={formatSekFromCents(payout.tipsCents, payout.currency)} />
          <DetailsRow label="Chargebacks" value={formatSekFromCents(payout.chargebacksCents, payout.currency)} />
          <DetailsRow label="Expected" value={formatWhen(payout.expectedAt)} />
          <DetailsRow label="Paid" value={formatWhen(payout.paidAt)} />
          <DetailsRow label="Payout ID" value={payout.id} />
        </div>
      ) : (
        <p className="admin-config-text-muted text-sm">No payout selected.</p>
      )}
    </DetailsDrawerShell>
  );
}
