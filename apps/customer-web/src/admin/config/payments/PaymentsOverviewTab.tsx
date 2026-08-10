import type { TodaysPaymentsDrillFilter } from "../../../api";
import { PaymentActivityChart } from "./PaymentActivityChart";
import { PaymentHealthPie } from "./PaymentHealthPie";
import { TodaysPaymentsPanel } from "./TodaysPaymentsPanel";
import { PaySection } from "./paymentsShared";

type Props = {
  token: string | null;
  restaurantId: string | null;
  refreshKey: number;
  onViewTodaysTransactions?: (filter: TodaysPaymentsDrillFilter) => void;
};

export function PaymentsOverviewTab({
  token,
  restaurantId,
  refreshKey,
  onViewTodaysTransactions
}: Props) {
  return (
    <div className="admin-payments-tab-stack">
      <div className="admin-payments-overview-grid">
        <PaySection title="Payment health" borderless>
          <PaymentHealthPie token={token} restaurantId={restaurantId} refreshKey={refreshKey} />
        </PaySection>

        <PaySection title="Today’s payments" borderless>
          <TodaysPaymentsPanel
            token={token}
            restaurantId={restaurantId}
            refreshKey={refreshKey}
            onViewTodaysTransactions={onViewTodaysTransactions}
          />
        </PaySection>
      </div>

      <PaymentActivityChart token={token} restaurantId={restaurantId} refreshKey={refreshKey} />
    </div>
  );
}
