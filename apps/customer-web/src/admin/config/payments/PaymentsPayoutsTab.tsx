import type { PaymentPayoutRow, VenuePaymentSettings } from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { MoneyTile, PayChip, PaySection } from "./paymentsShared";
import { formatSekFromCents, formatWhen } from "./paymentsUiHelpers";

type Props = {
  payouts: PaymentPayoutRow[];
  summary: { upcomingCents: number; lastCents: number; currency: string } | null;
  settings: VenuePaymentSettings;
  canEdit: boolean;
  onLinkBank: () => void;
  onPatchBank: (patch: VenuePaymentSettings["bankAccount"]) => void;
};

export function PaymentsPayoutsTab({ payouts, summary, settings, canEdit, onLinkBank, onPatchBank }: Props) {
  const currency = summary?.currency ?? "SEK";
  const upcoming = payouts.find((p) => p.status === "scheduled");
  const last = payouts.find((p) => p.status === "paid");

  return (
    <div className="admin-payments-tab-stack">
      <PaySection
        title="Payouts"
        description="Money deposited into the restaurant bank account — not the same as payments received."
      >
        <div className="admin-payments-money-grid">
          <MoneyTile label="Upcoming payout" value={formatSekFromCents(summary?.upcomingCents ?? 0, currency)} />
          <MoneyTile label="Last payout" value={formatSekFromCents(summary?.lastCents ?? 0, currency)} />
          <MoneyTile
            label="Expected"
            value={formatSekFromCents(upcoming?.netCents ?? last?.netCents ?? 0, currency)}
          />
          <MoneyTile label="Status" value={upcoming ? "Scheduled" : last ? "Paid" : "—"} />
        </div>
      </PaySection>

      <PaySection title="Settlement breakdown" description="Gross, fees, refunds, and tips from provider settlement data.">
        <div className="admin-payments-surface-list">
          {payouts.map((p) => (
            <div key={p.id} className="admin-payments-surface-row is-static">
              <div className="min-w-0">
                <p className="font-semibold admin-config-text">
                  {formatSekFromCents(p.netCents, p.currency)} net · {p.provider}
                </p>
                <p className="admin-config-text-subtle text-xs mt-0.5">
                  Gross {formatSekFromCents(p.grossCents, p.currency)} · Fees{" "}
                  {formatSekFromCents(p.feesCents, p.currency)} · Refunds{" "}
                  {formatSekFromCents(p.refundsCents, p.currency)} · Tips{" "}
                  {formatSekFromCents(p.tipsCents, p.currency)}
                </p>
                <p className="admin-config-text-subtle text-xs mt-0.5">
                  {p.paidAt ? `Paid ${formatWhen(p.paidAt)}` : `Expected ${formatWhen(p.expectedAt)}`}
                </p>
              </div>
              <PayChip tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "warning"}>
                {p.status.replace(/_/g, " ")}
              </PayChip>
            </div>
          ))}
        </div>
      </PaySection>

      <PaySection title="Bank account" description="Destination for provider payouts.">
        <div className="grid gap-3 max-w-md">
          <div className="admin-payments-kv">
            <span>Linked</span>
            <PayChip tone={settings.bankAccount.linked ? "success" : "muted"}>
              {settings.bankAccount.linked ? "Yes" : "No"}
            </PayChip>
          </div>
          {settings.bankAccount.linked ? (
            <>
              <div className="admin-payments-kv">
                <span>Account</span>
                <strong>•••• {settings.bankAccount.lastFour ?? "————"}</strong>
              </div>
              <label className="grid gap-1">
                <AdminLabel>Holder name</AdminLabel>
                <AdminInput
                  disabled={!canEdit}
                  value={settings.bankAccount.holderName ?? ""}
                  onChange={(e) =>
                    onPatchBank({ ...settings.bankAccount, holderName: e.target.value, linked: true })
                  }
                />
              </label>
            </>
          ) : canEdit ? (
            <AdminBtnSecondary type="button" onClick={onLinkBank}>
              Link bank account
            </AdminBtnSecondary>
          ) : null}
        </div>
      </PaySection>
    </div>
  );
}
