import { useEffect, useState } from "react";
import type { PaymentPayoutRow, VenuePaymentSettings } from "../../../api";
import { useAdminToast } from "../../AdminToast";
import { MenuActionConfirmModal } from "../menu/MenuActionConfirmModal";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { PayChip, PaySection, PAYMENT_PLAY_NOTE_MS, PaymentPlayNote, PaymentPlayNoteHint } from "./paymentsShared";
import { PayoutAccountDrawer } from "./PayoutAccountDrawer";
import { PayoutsSettlementList } from "./PayoutsSettlementList";
import { PayoutsVolumeChart } from "./PayoutsVolumeChart";

type Props = {
  payouts: PaymentPayoutRow[];
  summary: { upcomingCents: number; lastCents: number; currency: string } | null;
  settings: VenuePaymentSettings;
  canEdit: boolean;
  sandboxNote?: string | null;
  onPatchBank: (patch: VenuePaymentSettings["bankAccount"]) => void;
};

export function PaymentsPayoutsTab({
  payouts,
  summary,
  settings,
  canEdit,
  sandboxNote,
  onPatchBank
}: Props) {
  const { pushToast } = useAdminToast();
  const [noteOpen, setNoteOpen] = useState(Boolean(sandboxNote));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sandboxNote || !noteOpen) return;
    const id = window.setTimeout(() => setNoteOpen(false), PAYMENT_PLAY_NOTE_MS);
    return () => window.clearTimeout(id);
  }, [sandboxNote, noteOpen]);

  const hint =
    sandboxNote && !noteOpen ? (
      <PaymentPlayNoteHint onReplay={() => setNoteOpen(true)} label="Show payout notice" />
    ) : null;

  const bank = settings.bankAccount;
  const accountName = bank.holderName?.trim() || (bank.lastFour ? `Bank •••• ${bank.lastFour}` : "Bank account");

  const copyText = async (value: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast(ok, "success");
    } catch {
      pushToast("Could not copy to clipboard.", "error");
    }
  };

  const handleAccountAction = (id: string) => {
    setMenuOpen(false);
    if (id === "manage") {
      setDrawerOpen(true);
      return;
    }
    if (id === "copy_name") {
      void copyText(accountName, "Account name copied.");
      return;
    }
    if (id === "copy_number" && bank.lastFour) {
      void copyText(`•••• ${bank.lastFour}`, "Account number copied.");
      return;
    }
    if (id === "refresh") {
      pushToast("Payout account status refreshed.", "success");
      return;
    }
    if (id === "unlink") {
      setConfirmUnlink(true);
    }
  };

  const unlinkAccount = async () => {
    setBusy(true);
    await new Promise((r) => window.setTimeout(r, 220));
    onPatchBank({ linked: false, lastFour: undefined, holderName: bank.holderName });
    setBusy(false);
    setConfirmUnlink(false);
    pushToast("Bank account unlinked.", "success");
  };

  return (
    <div className="admin-payments-tab-stack">
      {sandboxNote ? <PaymentPlayNote open={noteOpen} text={sandboxNote} /> : null}

      <PayoutsVolumeChart payouts={payouts} summary={summary} titleHint={hint} />

      <div className="admin-payments-payout-account-bar">
        <button type="button" className="admin-payments-manage-btn" onClick={() => setDrawerOpen(true)}>
          Manage Payout Account
        </button>
        {bank.linked ? (
          <div className="admin-payments-payout-account-linked">
            <span className="admin-payments-payout-account-label">Linked bank account:</span>
            <strong className="admin-payments-payout-account-name">{accountName}</strong>
            <PayChip tone="success">Linked</PayChip>
            <MenuEntityActionsMenu
              entityName={accountName}
              subtitle="Payout destination"
              hideHeader
              open={menuOpen}
              actions={[
                { id: "manage", label: "Manage account" },
                { id: "copy_name", label: "Copy account name" },
                ...(bank.lastFour ? [{ id: "copy_number", label: "Copy account number" }] : []),
                { id: "refresh", label: "Refresh status" },
                ...(canEdit ? [{ id: "unlink", label: "Unlink account", danger: true }] : [])
              ]}
              onToggle={() => setMenuOpen((cur) => !cur)}
              onAction={handleAccountAction}
            />
          </div>
        ) : (
          <span className="admin-payments-payout-account-empty">No linked account</span>
        )}
      </div>

      <PaySection title="Settlement breakdown" description="Gross, fees, refunds, and tips from provider settlement data." borderless>
        <PayoutsSettlementList payouts={payouts} canEdit={canEdit} />
      </PaySection>

      <PayoutAccountDrawer
        open={drawerOpen}
        settings={settings}
        canEdit={canEdit}
        onClose={() => setDrawerOpen(false)}
        onSave={onPatchBank}
      />

      <MenuActionConfirmModal
        open={confirmUnlink}
        title="Unlink this bank account?"
        description={`Stop sending payouts to ${accountName}. Upcoming deposits will wait until another account is linked.`}
        confirmLabel="Unlink account"
        danger
        busy={busy}
        onClose={() => (busy ? undefined : setConfirmUnlink(false))}
        onConfirm={() => void unlinkAccount()}
      />
    </div>
  );
}
