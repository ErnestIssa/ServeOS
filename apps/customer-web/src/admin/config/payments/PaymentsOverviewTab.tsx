import type { PaymentHealthActionTarget, PaymentOverview } from "../../../api";
import { PaymentActivityChart } from "./PaymentActivityChart";
import { PaymentHealthPie } from "./PaymentHealthPie";
import { MoneyTile, PaySection } from "./paymentsShared";
import { formatSekFromCents } from "./paymentsUiHelpers";

type Props = {
  token: string | null;
  restaurantId: string | null;
  overview: PaymentOverview | null;
  refreshKey: number;
  onNavigateHealth?: (target: PaymentHealthActionTarget) => void;
};

export function PaymentsOverviewTab({
  token,
  restaurantId,
  overview,
  refreshKey,
  onNavigateHealth
}: Props) {
  const today = overview?.today;
  const currency = overview?.currency ?? "SEK";

  return (
    <div className="admin-payments-tab-stack">
      <div className="admin-payments-overview-grid">
        <PaySection title="Payment health" borderless>
          <PaymentHealthPie
            token={token}
            restaurantId={restaurantId}
            refreshKey={refreshKey}
            onNavigate={onNavigateHealth}
          />
        </PaySection>

        <PaySection
          title="Today’s payments"
          description={
            overview?.source === "demo"
              ? "Demo ledger snapshot from the payment API."
              : "Live ledger snapshot from the payment API."
          }
        >
          <div className="admin-payments-money-grid">
            <MoneyTile
              label="Today’s payments"
              value={formatSekFromCents(today?.paymentsCents ?? 0, currency)}
            />
            <MoneyTile label="Pending" value={formatSekFromCents(today?.pendingCents ?? 0, currency)} />
            <MoneyTile label="Refunded" value={formatSekFromCents(today?.refundedCents ?? 0, currency)} />
            <MoneyTile label="Failed" value={formatSekFromCents(today?.failedCents ?? 0, currency)} />
            <MoneyTile
              label="Pay at venue"
              value={formatSekFromCents(today?.payAtVenueCents ?? 0, currency)}
            />
            <MoneyTile label="Online" value={formatSekFromCents(today?.onlineCents ?? 0, currency)} />
          </div>
          {today?.disputeCount || today?.reconAlertCount ? (
            <div className="admin-payments-alert-row mt-4">
              {today.disputeCount > 0 ? <span>{today.disputeCount} open dispute(s)</span> : null}
              {today.reconAlertCount > 0 ? (
                <span>{today.reconAlertCount} reconciliation alert(s)</span>
              ) : null}
            </div>
          ) : null}
        </PaySection>
      </div>

      <PaymentActivityChart token={token} restaurantId={restaurantId} refreshKey={refreshKey} />
    </div>
  );
}
