import { useEffect, useRef, useState } from "react";
import type { VenuePaymentSettings } from "../../../api";
import { DetailsDrawerShell } from "../menu/detailsDrawerUi";
import { PaymentExpandSelect, PaymentInfoTip, PaymentSwitch } from "./paymentsFormControls";

type RefundsConfig = VenuePaymentSettings["refunds"];

type Props = {
  open: boolean;
  settings: VenuePaymentSettings;
  canEdit: boolean;
  onClose: () => void;
  onSave: (refunds: RefundsConfig) => void;
};

const TIMEOUT_OPTIONS = [
  { value: "12", label: "12 hours", hint: "Same-day window" },
  { value: "24", label: "24 hours", hint: "Next day" },
  { value: "48", label: "48 hours", hint: "Two days" },
  { value: "72", label: "72 hours", hint: "Three days" },
  { value: "168", label: "7 days", hint: "One week" }
];

export function RefundPolicyDrawer({ open, settings, canEdit, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<RefundsConfig>(settings.refunds);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(settings.refunds);
    }
    wasOpenRef.current = open;
  }, [open, settings.refunds]);

  const dirty =
    draft.managerApproval !== settings.refunds.managerApproval ||
    draft.automaticRefund !== settings.refunds.automaticRefund ||
    draft.manualRefund !== settings.refunds.manualRefund ||
    draft.refundTimeoutHours !== settings.refunds.refundTimeoutHours;

  return (
    <DetailsDrawerShell
      open={open}
      entityKey="refund-policies"
      kicker="Refunds"
      title="Refund policies"
      subtitle="How this venue approves and processes guest refunds."
      closeLabel="Close refund policies"
      onClose={onClose}
      footer={
        <div className="admin-payments-rule-footer">
          <button type="button" className="admin-profile-modal-btn admin-profile-modal-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          {canEdit ? (
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--primary"
              disabled={!dirty}
              onClick={() => {
                onSave(draft);
                onClose();
              }}
            >
              Save changes
            </button>
          ) : null}
        </div>
      }
    >
      <div className="admin-payments-refund-policy">
        <p className="admin-payments-venue-panel-kicker">
          Approval
          <PaymentInfoTip
            tipId="refund-policy-approval-tip"
            body="Manager approval pauses a refund until a manager confirms it. Automatic refunds skip that step when the amount is within staff limits."
          />
        </p>
        <PaymentSwitch
          label="Manager approval required"
          description="Staff refunds wait for a manager before money is returned."
          checked={draft.managerApproval}
          disabled={!canEdit}
          onRequestChange={(next) => setDraft((cur) => ({ ...cur, managerApproval: next }))}
        />
        <PaymentSwitch
          label="Automatic refunds"
          description="Eligible refunds can be sent to the provider without extra confirmation."
          checked={draft.automaticRefund}
          disabled={!canEdit}
          onRequestChange={(next) => setDraft((cur) => ({ ...cur, automaticRefund: next }))}
        />
        <PaymentSwitch
          label="Manual refunds"
          description="Staff can record a refund by hand when the provider flow is not used."
          checked={draft.manualRefund}
          disabled={!canEdit}
          onRequestChange={(next) => setDraft((cur) => ({ ...cur, manualRefund: next }))}
        />

        <div className="admin-payments-refund-policy-timeout">
          <p className="admin-payments-venue-panel-kicker">
            Refund window
            <PaymentInfoTip
              tipId="refund-policy-timeout-tip"
              body="How long a captured payment stays eligible for a refund from this venue."
            />
          </p>
          <PaymentExpandSelect
            label="Time limit"
            value={String(draft.refundTimeoutHours)}
            options={TIMEOUT_OPTIONS}
            disabled={!canEdit}
            onRequestChange={(next) => setDraft((cur) => ({ ...cur, refundTimeoutHours: Number(next) }))}
          />
        </div>
      </div>
    </DetailsDrawerShell>
  );
}
