import type {
  PaymentHealthActionTarget,
  PaymentTransactionRow,
  TodaysPaymentsDrillFilter
} from "../../../api";
import { PaymentActivityChart } from "./PaymentActivityChart";
import { PaymentHealthPie } from "./PaymentHealthPie";
import { TodaysPaymentsPanel } from "./TodaysPaymentsPanel";
import { PaySection } from "./paymentsShared";

type Props = {
  token: string | null;
  restaurantId: string | null;
  refreshKey: number;
  onNavigateHealth?: (target: PaymentHealthActionTarget) => void;
  onDrillDownToday?: (filter: TodaysPaymentsDrillFilter, ledger: PaymentTransactionRow[]) => void;
  onOpenTransaction?: (txn: PaymentTransactionRow) => void;
};

export function PaymentsOverviewTab({
  token,
  restaurantId,
  refreshKey,
  onNavigateHealth,
  onDrillDownToday,
  onOpenTransaction
}: Props) {
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

        <PaySection title="Today’s payments" borderless>
          <TodaysPaymentsPanel
            token={token}
            restaurantId={restaurantId}
            refreshKey={refreshKey}
            onDrillDown={onDrillDownToday}
            onOpenTransaction={onOpenTransaction}
          />
        </PaySection>
      </div>

      <PaymentActivityChart token={token} restaurantId={restaurantId} refreshKey={refreshKey} />
    </div>
  );
}
