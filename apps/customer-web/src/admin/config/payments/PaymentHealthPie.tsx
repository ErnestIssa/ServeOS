import { useCallback, useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  getVenuePaymentHealth,
  type PaymentHealthChartSlice,
  type PaymentHealthIssue,
  type PaymentHealthSnapshot,
  type PaymentHealthStatus
} from "../../../api";
import { PaymentHealthIssueDrawer } from "./PaymentHealthIssueDrawer";
import { renderPaymentPieSliceLabel } from "./paymentPieLabels";
import { PaymentsSectionSpinner } from "./paymentsLoadingUi";
import { formatWhen } from "./paymentsUiHelpers";

type Props = {
  token: string | null;
  restaurantId: string | null;
  refreshKey?: number;
};

const STATUS_FILL: Record<PaymentHealthStatus, string> = {
  operational: "#16a34a",
  degraded: "#d97706",
  disabled: "#dc2626",
  unknown: "#94a3b8"
};

const OVERALL_FILL: Record<PaymentHealthSnapshot["overall"], string> = {
  healthy: "#16a34a",
  degraded: "#d97706",
  critical: "#dc2626"
};

type Slice = PaymentHealthChartSlice & { fill: string };

function ChartTooltipBody({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: Slice }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="admin-payments-health-tooltip">
      <p className="admin-payments-health-tooltip-title">{row.label}</p>
      <p className="admin-payments-health-tooltip-status" style={{ color: row.fill }}>
        {row.statusLabel}
      </p>
    </div>
  );
}

function PaymentHealthSkeleton() {
  return <PaymentsSectionSpinner label="Loading payment health" />;
}

export function PaymentHealthPie({ token, restaurantId, refreshKey = 0 }: Props) {
  const [health, setHealth] = useState<PaymentHealthSnapshot | null>(null);
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<PaymentHealthIssue | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!token || !restaurantId) return;
      const res = await getVenuePaymentHealth(token, restaurantId, { refresh: force });
      if (res.ok && res.health) setHealth(res.health);
    },
    [token, restaurantId]
  );

  useEffect(() => {
    void load(false);
  }, [load, refreshKey]);

  // Soft realtime: poll near cache TTL so UI stays current without frontend health math.
  useEffect(() => {
    if (!token || !restaurantId) return;
    const id = window.setInterval(() => {
      void load(false);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [token, restaurantId, load]);

  const slices = useMemo<Slice[]>(() => {
    if (!health?.chartSlices?.length) return [];
    return health.chartSlices.map((s) => ({
      ...s,
      fill: STATUS_FILL[s.status] ?? STATUS_FILL.unknown
    }));
  }, [health]);

  const openIssue = (issue: PaymentHealthIssue) => {
    setSelectedIssue(issue);
    setIssueOpen(true);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  if (!health) {
    return <PaymentHealthSkeleton />;
  }

  return (
    <>
      <div className="admin-payments-health-pie">
        <div className="admin-payments-health-pie-intro">
          <div className="admin-payments-today-total-wrap">
            <span
              className="admin-payments-health-pie-overall admin-payments-today-total"
              style={{ color: OVERALL_FILL[health.overall] }}
              tabIndex={0}
              aria-describedby="payment-health-overall-tip"
            >
              {health.overallLabel}
              <span
                id="payment-health-overall-tip"
                className="admin-payments-today-total-tip admin-payments-health-tooltip"
                role="tooltip"
              >
                <span className="admin-payments-health-tooltip-title">{health.overallLabel}</span>
                <span
                  className="admin-payments-health-tooltip-status"
                  style={{ color: OVERALL_FILL[health.overall] }}
                >
                  {health.summary}
                </span>
                <span className="admin-payments-today-total-tip-meta">
                  Success 24h {health.metrics.successRate24h}%
                  {" · "}
                  Failed {health.metrics.failedCount24h}
                  {" · "}
                  Last checked {formatWhen(health.evaluatedAt)}
                </span>
              </span>
            </span>
          </div>
          <p className="admin-payments-health-pie-trend">{health.summary}</p>
          <p className="admin-payments-health-pie-sub">
            Last checked {formatWhen(health.evaluatedAt)}
            {health.source === "demo" ? " · Showing sample activity" : ""}
          </p>
        </div>

        <div className="admin-payments-health-metrics" aria-readonly="true">
          <div>
            <span>Success 24h</span>
            <strong>{health.metrics.successRate24h}%</strong>
          </div>
          <div>
            <span>Failed 24h</span>
            <strong>{health.metrics.failedCount24h}</strong>
          </div>
          <div>
            <span>Stuck pending</span>
            <strong>{health.metrics.pendingStuckCount}</strong>
          </div>
          <div>
            <span>Mismatches</span>
            <strong>{health.metrics.reconciliationMismatches}</strong>
          </div>
        </div>

        <div className="admin-payments-health-pie-chart admin-payments-health-pie-chart--readonly">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart margin={{ top: 10, right: 18, bottom: 10, left: 18 }}>
              <Tooltip cursor={false} content={<ChartTooltipBody />} />
              <Pie
                data={slices}
                dataKey="value"
                nameKey="short"
                stroke="0"
                innerRadius={0}
                outerRadius={96}
                paddingAngle={1.5}
                isAnimationActive
                onMouseEnter={(_, index) => setActiveSlice(index)}
                onMouseLeave={() => setActiveSlice(null)}
                label={(props) => renderPaymentPieSliceLabel(props, props.index === activeSlice)}
                labelLine={false}
              >
                {slices.map((slice) => (
                  <Cell key={slice.key} fill={slice.fill} style={{ cursor: "default", outline: "none" }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {health.issues.length > 0 ? (
          <ul className="admin-payments-health-issues" aria-label="Actionable health issues">
            {health.issues.map((issue) => (
              <li key={issue.id} className={`is-${issue.severity}`}>
                <div className="min-w-0">
                  <p className="admin-payments-health-issue-title">{issue.title}</p>
                  <p className="admin-payments-health-issue-detail">{issue.detail}</p>
                </div>
                <button
                  type="button"
                  className="admin-payments-health-issue-action"
                  onClick={() => openIssue(issue)}
                >
                  {issue.actionLabel} →
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="admin-payments-health-timestamps">
          <span>Last payment {formatWhen(health.timestamps.lastSuccessfulPaymentAt)}</span>
          <span>Last webhook {formatWhen(health.timestamps.lastWebhookAt)}</span>
          <span>Last reconcile {formatWhen(health.timestamps.lastReconciliationAt)}</span>
        </div>
      </div>

      <PaymentHealthIssueDrawer
        token={token}
        restaurantId={restaurantId}
        issue={selectedIssue}
        open={issueOpen}
        onClose={() => {
          setIssueOpen(false);
          setSelectedIssue(null);
        }}
      />
    </>
  );
}
