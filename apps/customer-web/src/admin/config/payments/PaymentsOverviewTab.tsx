import type { PaymentOverview } from "../../../api";
import { PaymentActivityChart } from "./PaymentActivityChart";
import { HealthRow, MoneyTile, PaySection } from "./paymentsShared";
import { formatSekFromCents, healthLabel, healthTone } from "./paymentsUiHelpers";

type Props = {
  token: string | null;
  restaurantId: string | null;
  overview: PaymentOverview | null;
  refreshKey: number;
};

export function PaymentsOverviewTab({ token, restaurantId, overview, refreshKey }: Props) {
  const health = overview?.health;
  const today = overview?.today;
  const currency = overview?.currency ?? "SEK";

  return (
    <div className="admin-payments-tab-stack">
      <p className="admin-payments-billing-note">
        ServeOS subscription billing is managed under Billing — this workspace is guest payment infrastructure only.
      </p>

      <div className="admin-payments-overview-grid">
        <PaySection title="Payment health" description="Is this restaurant able to take money right now?">
          <div className="admin-payments-health-list">
            {health ? (
              <>
                <HealthRow label="Payment system" statusLabel={healthLabel(health.paymentSystem)} tone={healthTone(health.paymentSystem)} />
                <HealthRow label="Online payments" statusLabel={healthLabel(health.onlinePayments)} tone={healthTone(health.onlinePayments)} />
                <HealthRow label="Pay at venue" statusLabel={health.payAtVenue === "operational" ? "Enabled" : healthLabel(health.payAtVenue)} tone={healthTone(health.payAtVenue)} />
                <HealthRow label="Refunds" statusLabel={healthLabel(health.refunds)} tone={healthTone(health.refunds)} />
                <HealthRow label="Webhooks" statusLabel={health.webhooks === "operational" ? "Receiving" : healthLabel(health.webhooks)} tone={healthTone(health.webhooks)} />
                <HealthRow label="Settlement" statusLabel={health.settlement === "operational" ? "Up to date" : healthLabel(health.settlement)} tone={healthTone(health.settlement)} />
              </>
            ) : (
              <p className="admin-config-text-muted text-sm">Loading health…</p>
            )}
          </div>
        </PaySection>

        <PaySection
          title="Today’s payments"
          description={overview?.source === "demo" ? "Demo ledger snapshot from the payment API." : "Live ledger snapshot from the payment API."}
        >
          <div className="admin-payments-money-grid">
            <MoneyTile label="Today’s payments" value={formatSekFromCents(today?.paymentsCents ?? 0, currency)} />
            <MoneyTile label="Pending" value={formatSekFromCents(today?.pendingCents ?? 0, currency)} />
            <MoneyTile label="Refunded" value={formatSekFromCents(today?.refundedCents ?? 0, currency)} />
            <MoneyTile label="Failed" value={formatSekFromCents(today?.failedCents ?? 0, currency)} />
            <MoneyTile label="Pay at venue" value={formatSekFromCents(today?.payAtVenueCents ?? 0, currency)} />
            <MoneyTile label="Online" value={formatSekFromCents(today?.onlineCents ?? 0, currency)} />
          </div>
          {(today?.disputeCount || today?.reconAlertCount) ? (
            <div className="admin-payments-alert-row mt-4">
              {today.disputeCount > 0 ? <span>{today.disputeCount} open dispute(s)</span> : null}
              {today.reconAlertCount > 0 ? <span>{today.reconAlertCount} reconciliation alert(s)</span> : null}
            </div>
          ) : null}
        </PaySection>
      </div>

      <PaymentActivityChart token={token} restaurantId={restaurantId} refreshKey={refreshKey} />
    </div>
  );
}
