import { useEffect, useRef, useState } from "react";
import type { VenuePaymentSettings } from "../../../api";
import { AdminInput, AdminLabel } from "../../AdminUi";
import { DetailsDrawerShell, DetailsSection } from "../menu/detailsDrawerUi";
import { PaymentExpandSelect, PaymentInfoTip, PaymentSwitch } from "./paymentsFormControls";

type BankAccount = VenuePaymentSettings["bankAccount"];

type Props = {
  open: boolean;
  settings: VenuePaymentSettings;
  canEdit: boolean;
  onClose: () => void;
  onSave: (bankAccount: BankAccount) => void;
};

const SCHEDULE_OPTIONS = [
  { value: "daily", label: "Daily", hint: "Deposit every banking day" },
  { value: "standard", label: "Standard", hint: "Provider default, usually 2 days" },
  { value: "weekly", label: "Weekly", hint: "One payout per week" }
];

export function PayoutAccountDrawer({ open, settings, canEdit, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<BankAccount>(settings.bankAccount);
  const [schedule, setSchedule] = useState("standard");
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(settings.bankAccount);
      setSchedule("standard");
    }
    wasOpenRef.current = open;
  }, [open, settings.bankAccount]);

  const dirty =
    draft.linked !== settings.bankAccount.linked ||
    (draft.holderName ?? "") !== (settings.bankAccount.holderName ?? "") ||
    (draft.lastFour ?? "") !== (settings.bankAccount.lastFour ?? "");

  const linkAccount = () => {
    setDraft({
      linked: true,
      lastFour: draft.lastFour || "4821",
      holderName: draft.holderName?.trim() || settings.bankAccount.holderName || "Venue settlement"
    });
  };

  return (
    <DetailsDrawerShell
      open={open}
      entityKey="payout-account"
      kicker="Payouts"
      title="Manage payout account"
      subtitle="Bank destination for provider deposits — not the same as guest payments."
      closeLabel="Close payout account"
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
      <DetailsSection
        title="Linked account"
        helpTip="ServeOS sends provider payouts to this bank account. Guests never see these details."
      >
        <PaymentSwitch
          label="Bank account linked"
          description="When on, settlement can be deposited to this account."
          checked={draft.linked}
          disabled={!canEdit}
          onRequestChange={(next) => {
            if (next) linkAccount();
            else setDraft({ ...draft, linked: false });
          }}
        />
        {!draft.linked && canEdit ? (
          <button type="button" className="admin-payments-manage-btn" onClick={linkAccount}>
            Link bank account
          </button>
        ) : null}
      </DetailsSection>

      <DetailsSection title="Account details">
        <label className="grid gap-1">
          <AdminLabel>Account holder</AdminLabel>
          <AdminInput
            disabled={!canEdit}
            value={draft.holderName ?? ""}
            placeholder="Restaurant AB"
            onChange={(e) => setDraft({ ...draft, holderName: e.target.value })}
          />
        </label>
        <label className="grid gap-1 mt-3">
          <AdminLabel>Account number</AdminLabel>
          <AdminInput
            disabled={!canEdit || !draft.linked}
            value={draft.linked ? `•••• ${draft.lastFour ?? "————"}` : ""}
            placeholder="Not linked"
            readOnly
          />
        </label>
      </DetailsSection>

      <DetailsSection
        title="Payout schedule"
        helpTip="How often the provider should send deposits to this bank account."
      >
        <p className="admin-payments-venue-panel-kicker">
          Frequency
          <PaymentInfoTip
            tipId="payout-schedule-tip"
            body="Standard follows the connected adapter. Daily and weekly are requests — the provider still has to support them."
          />
        </p>
        <PaymentExpandSelect
          label="Deposit cadence"
          value={schedule}
          options={SCHEDULE_OPTIONS}
          disabled={!canEdit || !draft.linked}
          onRequestChange={setSchedule}
        />
      </DetailsSection>
    </DetailsDrawerShell>
  );
}
