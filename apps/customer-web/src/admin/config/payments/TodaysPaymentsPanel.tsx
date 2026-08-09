import { useCallback, useEffect, useState } from "react";
import {
  getVenueTodaysPayments,
  type PaymentOverviewAnalysisTone,
  type PaymentTransactionRow,
  type TodaysPaymentsDrillFilter,
  type TodaysPaymentsSnapshot
} from "../../../api";
import { SkeletonBone } from "../../AdminSkeleton";
import { formatSekFromCents, formatWhen, methodLabel, txnStatusClass, txnStatusLabel } from "./paymentsUiHelpers";

type Props = {
  token: string | null;
  restaurantId: string | null;
  refreshKey?: number;
  onDrillDown?: (filter: TodaysPaymentsDrillFilter, ledger: PaymentTransactionRow[]) => void;
  onOpenTransaction?: (txn: PaymentTransactionRow) => void;
};

const TOTAL_TONE_COLOR: Record<PaymentOverviewAnalysisTone, string> = {
  ahead: "#16a34a",
  on_track: "#d97706",
  behind: "#dc2626",
  unknown: "var(--admin-text, #0f172a)"
};

function TodaysPaymentsSkeleton() {
  return (
    <div className="admin-payments-health-pie" aria-busy aria-label="Loading today’s payments">
      <div className="admin-payments-health-pie-intro">
        <SkeletonBone className="h-5 w-24" />
        <SkeletonBone className="mt-2 h-4 w-56" rounded="sm" />
        <SkeletonBone className="mt-1.5 h-3 w-44" rounded="sm" />
      </div>
      <div className="admin-payments-health-metrics">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <SkeletonBone className="mx-auto h-2.5 w-12" rounded="sm" />
            <SkeletonBone className="mx-auto mt-2 h-5 w-10" />
          </div>
        ))}
      </div>
      <div className="admin-payments-health-pie-chart admin-payments-health-pie-chart--skeleton">
        <SkeletonBone className="h-[220px] w-[220px] max-w-full" rounded="full" />
      </div>
      <div className="admin-payments-health-issues admin-payments-health-issues--skeleton">
        <SkeletonBone className="h-14 w-full rounded-xl" />
        <SkeletonBone className="h-14 w-full rounded-xl" />
      </div>
      <div className="admin-payments-health-timestamps">
        <SkeletonBone className="h-3 w-28" rounded="sm" />
        <SkeletonBone className="h-3 w-28" rounded="sm" />
        <SkeletonBone className="h-3 w-28" rounded="sm" />
      </div>
    </div>
  );
}

export function TodaysPaymentsPanel({
  token,
  restaurantId,
  refreshKey = 0,
  onDrillDown,
  onOpenTransaction
}: Props) {
  const [today, setToday] = useState<TodaysPaymentsSnapshot | null>(null);

  const load = useCallback(async () => {
    if (!token || !restaurantId) return;
    const res = await getVenueTodaysPayments(token, restaurantId);
    if (res.ok && res.today) setToday(res.today);
  }, [token, restaurantId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!token || !restaurantId) return;
    const id = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [token, restaurantId, load]);

  if (!today) {
    return <TodaysPaymentsSkeleton />;
  }

  const analysis = today.analysis;
  const tone = analysis?.tone ?? "unknown";
  const toneColor = TOTAL_TONE_COLOR[tone];
  const collectedMetric = today.metrics.find((m) => m.key === "collected");
  const otherMetrics = today.metrics.filter((m) => m.key !== "collected");

  return (
    <div className="admin-payments-today">
      <div className="admin-payments-today-hero">
        <button
          type="button"
          className="admin-payments-today-total admin-payments-today-total--btn"
          style={{ color: toneColor }}
          tabIndex={0}
          aria-describedby="todays-payments-analysis-tip"
          onClick={() => collectedMetric && onDrillDown?.(collectedMetric.filter, today.ledger)}
        >
          {formatSekFromCents(today.aggregates.collectedCents, today.currency)}
          {analysis ? (
            <span
              id="todays-payments-analysis-tip"
              className="admin-payments-today-total-tip admin-payments-health-tooltip"
              role="tooltip"
            >
              <span className="admin-payments-health-tooltip-title">{analysis.toneLabel}</span>
              <span className="admin-payments-health-tooltip-status" style={{ color: toneColor }}>
                {analysis.detail}
              </span>
              <span className="admin-payments-today-total-tip-meta">
                Expected by now {formatSekFromCents(analysis.expectedCents, today.currency)}
                {" · "}
                Yesterday {formatSekFromCents(analysis.yesterdayCents, today.currency)}
              </span>
            </span>
          ) : null}
        </button>
        <p className="admin-payments-today-hero-sub">
          Total collected today
          {today.source === "demo" ? " · Showing sample activity" : ""}
          {" · "}
          {today.timezone.replace(/_/g, " ")}
          {today.currencies.length > 1 ? ` · ${today.currencies.join(", ")}` : ""}
        </p>
      </div>

      <div className="admin-payments-today-metrics">
        {otherMetrics.map((metric) => (
          <button
            key={metric.key}
            type="button"
            className="admin-payments-today-metric"
            onClick={() => onDrillDown?.(metric.filter, today.ledger)}
          >
            <span className="admin-payments-today-metric-label">{metric.label}</span>
            <span className="admin-payments-today-metric-value">{metric.valueLabel}</span>
            {metric.key === "failed" && metric.amountCents != null && metric.amountCents > 0 ? (
              <span className="admin-payments-today-metric-hint">
                {formatSekFromCents(metric.amountCents, metric.currency)}
              </span>
            ) : null}
            {metric.key === "pending" && metric.count != null ? (
              <span className="admin-payments-today-metric-hint">
                {metric.count} open · tap to view
              </span>
            ) : null}
            {metric.key === "successful" && metric.count != null ? (
              <span className="admin-payments-today-metric-hint">tap to view</span>
            ) : null}
            {metric.key === "average" && metric.count != null ? (
              <span className="admin-payments-today-metric-hint">
                across {metric.count} payment{metric.count === 1 ? "" : "s"}
              </span>
            ) : null}
            {metric.key === "refunded" && metric.count != null ? (
              <span className="admin-payments-today-metric-hint">
                {metric.count} payment{metric.count === 1 ? "" : "s"} · tap to view
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="admin-payments-today-methods">
        <p className="admin-payments-today-block-title">Payment methods</p>
        {today.methods.length === 0 ? (
          <p className="admin-payments-today-empty">No collected payments by method yet today.</p>
        ) : (
          <ul className="admin-payments-today-method-list">
            {today.methods.map((method) => (
              <li key={method.key}>
                <button
                  type="button"
                  className="admin-payments-today-method-row"
                  onClick={() => onDrillDown?.(method.filter, today.ledger)}
                >
                  <span className="admin-payments-today-method-label">
                    {method.label}
                    <span className="admin-payments-today-method-count">{method.count}</span>
                  </span>
                  <span className="admin-payments-today-method-bar" aria-hidden>
                    <span style={{ width: `${Math.max(method.sharePercent, 4)}%` }} />
                  </span>
                  <span className="admin-payments-today-method-amount">
                    {formatSekFromCents(method.amountCents, method.currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="admin-payments-today-recent">
        <p className="admin-payments-today-block-title">Recent activity</p>
        {today.recent.length === 0 ? (
          <p className="admin-payments-today-empty">No successful, failed, or refunded payments yet today.</p>
        ) : (
          <ul className="admin-payments-today-recent-list">
            {today.recent.map((txn) => (
              <li key={txn.id}>
                <button
                  type="button"
                  className="admin-payments-today-recent-row"
                  onClick={() => onOpenTransaction?.(txn)}
                >
                  <span className="admin-payments-today-recent-main">
                    <span className="admin-payments-today-recent-order">
                      {txn.orderDisplay ?? txn.orderId ?? "Payment"}
                    </span>
                    <span className="admin-payments-today-recent-meta">
                      {methodLabel(txn.method)} · {formatWhen(txn.createdAt)}
                    </span>
                  </span>
                  <span className={`admin-payments-status-pill ${txnStatusClass(txn.status)}`}>
                    {txnStatusLabel(txn.status)}
                  </span>
                  <span className="admin-payments-today-recent-amount">
                    {formatSekFromCents(txn.amountCents, txn.currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
