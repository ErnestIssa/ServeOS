import type { PaymentReconciliation } from "../../../api";
import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";
import { ResponsiveContainer } from "recharts";
import { ConfigSectionSpinner } from "../configLoadingUi";
import { MoneyTile, PaySection } from "./paymentsShared";
import { formatSekFromCents, formatWhen } from "./paymentsUiHelpers";

type Props = {
  reconciliation: PaymentReconciliation | null;
};

export function PaymentsReconciliationTab({ reconciliation }: Props) {
  const matchRate =
    reconciliation && reconciliation.payments > 0
      ? Math.round((reconciliation.matched / reconciliation.payments) * 100)
      : 0;

  const radialData = [{ name: "matched", value: matchRate, fill: "#16a34a" }];

  return (
    <div className="admin-payments-tab-stack">
      <div className="admin-payments-overview-grid">
        <PaySection title="Reconciliation" description="Does ServeOS agree with the payment provider?">
          {reconciliation ? (
            <div className="admin-payments-money-grid">
              <MoneyTile label="Orders" value={String(reconciliation.orders)} />
              <MoneyTile label="Payments" value={String(reconciliation.payments)} />
              <MoneyTile label="Matched" value={String(reconciliation.matched)} />
              <MoneyTile label="Mismatched" value={String(reconciliation.mismatched)} hint="Needs investigation" />
              <MoneyTile label="Pending provider events" value={String(reconciliation.pendingProviderEvents)} />
            </div>
          ) : (
            <ConfigSectionSpinner label="Loading reconciliation" />
          )}
        </PaySection>

        <PaySection title="Match rate" description="Share of payments that reconcile cleanly.">
          <div className="admin-payments-radial-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <RadialBarChart data={radialData} startAngle={90} endAngle={-270} innerRadius={70} outerRadius={100}>
                <PolarGrid gridType="circle" radialLines={false} stroke="none" />
                <RadialBar dataKey="value" background cornerRadius={8} />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-slate-900 text-3xl font-bold">
                            {matchRate}%
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 22} className="fill-slate-500 text-xs">
                            Matched
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </PolarRadiusAxis>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </PaySection>
      </div>

      <PaySection title="Mismatches" description="Investigate before settlement closes.">
        <div className="admin-payments-surface-list">
          {!reconciliation?.mismatches?.length ? (
            <p className="admin-config-text-muted text-sm p-2">No mismatches.</p>
          ) : (
            reconciliation.mismatches.map((m) => (
              <div key={m.id} className="admin-payments-surface-row is-static">
                <div className="min-w-0">
                  <p className="font-semibold admin-config-text">{m.summary}</p>
                  <p className="admin-config-text-subtle text-xs mt-0.5">
                    {m.type.replace(/_/g, " ")} · {m.orderId ?? "—"} · {formatWhen(m.createdAt)}
                  </p>
                </div>
                <strong className="admin-config-text">
                  {m.amountCents != null ? formatSekFromCents(m.amountCents) : "—"}
                </strong>
              </div>
            ))
          )}
        </div>
      </PaySection>
    </div>
  );
}
