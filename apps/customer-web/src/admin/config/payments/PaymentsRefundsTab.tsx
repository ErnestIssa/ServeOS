import type { PaymentRefundRow, VenuePaymentSettings } from "../../../api";
import { PayChip, PaySection, ToggleRow } from "./paymentsShared";
import { formatSekFromCents, formatWhen, refundStatusLabel } from "./paymentsUiHelpers";

type Props = {
  refunds: PaymentRefundRow[];
  settings: VenuePaymentSettings;
  canEdit: boolean;
  source?: "live" | "demo";
  onOpen: (refund: PaymentRefundRow) => void;
  onPatchSettings: (patch: Partial<VenuePaymentSettings>) => void;
};

export function PaymentsRefundsTab({ refunds, settings, canEdit, source, onOpen, onPatchSettings }: Props) {
  return (
    <div className="admin-payments-tab-stack">
      <PaySection
        title="Refund requests"
        description={source === "demo" ? "Demo refund ledger from the payment API." : "Refund ledger from the payment API."}
      >
        <div className="admin-payments-surface-list">
          {refunds.length === 0 ? (
            <p className="admin-config-text-muted text-sm p-2">No refunds yet.</p>
          ) : (
            refunds.map((r) => (
              <button key={r.id} type="button" className="admin-payments-surface-row" onClick={() => onOpen(r)}>
                <div className="min-w-0">
                  <p className="font-semibold admin-config-text">
                    {formatSekFromCents(r.amountCents, r.currency)} · {r.reason}
                  </p>
                  <p className="admin-config-text-subtle text-xs mt-0.5">
                    {r.orderId ?? "No order"} · {r.requestedBy} · {formatWhen(r.createdAt)}
                  </p>
                </div>
                <PayChip
                  tone={
                    r.status === "completed" ? "success" : r.status === "failed" ? "danger" : "warning"
                  }
                >
                  {refundStatusLabel(r.status)}
                </PayChip>
              </button>
            ))
          )}
        </div>
      </PaySection>

      <PaySection title="Refund policy" description="Approval and automation rules for this venue.">
        <div className="grid gap-2">
          <ToggleRow
            label="Manager approval required"
            checked={settings.refunds.managerApproval}
            disabled={!canEdit}
            onChange={(v) => onPatchSettings({ refunds: { ...settings.refunds, managerApproval: v } })}
          />
          <ToggleRow
            label="Automatic refunds"
            checked={settings.refunds.automaticRefund}
            disabled={!canEdit}
            onChange={(v) => onPatchSettings({ refunds: { ...settings.refunds, automaticRefund: v } })}
          />
          <ToggleRow
            label="Manual refunds"
            checked={settings.refunds.manualRefund}
            disabled={!canEdit}
            onChange={(v) => onPatchSettings({ refunds: { ...settings.refunds, manualRefund: v } })}
          />
        </div>
      </PaySection>
    </div>
  );
}
