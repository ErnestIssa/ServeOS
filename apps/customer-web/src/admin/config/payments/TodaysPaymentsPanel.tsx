import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getVenueTodaysPayments,
  type PaymentOverviewAnalysisTone,
  type TodaysPaymentsDetailQuery,
  type TodaysPaymentsDrillFilter,
  type TodaysPaymentsMethodSlice,
  type TodaysPaymentsMetric,
  type TodaysPaymentsSnapshot
} from "../../../api";
import { renderPaymentPieSliceLabel } from "./paymentPieLabels";
import { PaymentsSectionSpinner } from "./paymentsLoadingUi";
import { TodaysPaymentsDetailDrawer } from "./TodaysPaymentsDetailDrawer";
import { formatSekFromCents } from "./paymentsUiHelpers";

type Props = {
  token: string | null;
  restaurantId: string | null;
  refreshKey?: number;
  onViewTodaysTransactions?: (filter: TodaysPaymentsDrillFilter) => void;
};

const TOTAL_TONE_COLOR: Record<PaymentOverviewAnalysisTone, string> = {
  ahead: "#16a34a",
  on_track: "#d97706",
  behind: "#dc2626",
  unknown: "var(--admin-text, #0f172a)"
};

const SLICE_META: Record<string, { short: string; fill: string }> = {
  successful: { short: "OK", fill: "#16a34a" },
  average: { short: "Avg", fill: "#2563eb" },
  failed: { short: "Fail", fill: "#dc2626" },
  refunded: { short: "Refund", fill: "#64748b" },
  pending: { short: "Pend", fill: "#d97706" }
};

const METHOD_BAR_FILL = "#2563eb";

const PIE_METRIC_KEYS = ["successful", "average", "failed", "refunded", "pending"] as const;

type Slice = {
  key: string;
  label: string;
  short: string;
  value: number;
  fill: string;
  statusLabel: string;
};

type MethodBarRow = TodaysPaymentsMethodSlice & {
  amount: number;
  shortLabel: string;
};

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

function MethodBarTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: MethodBarRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="admin-payments-health-tooltip">
      <p className="admin-payments-health-tooltip-title">{row.label}</p>
      <p className="admin-payments-health-tooltip-status" style={{ color: METHOD_BAR_FILL }}>
        {formatSekFromCents(row.amountCents, row.currency)} · {row.count} payment
        {row.count === 1 ? "" : "s"} · {row.sharePercent}%
      </p>
    </div>
  );
}

function metricStatusLabel(metric: TodaysPaymentsMetric): string {
  if (metric.key === "successful") {
    return `${metric.count ?? 0} payment${(metric.count ?? 0) === 1 ? "" : "s"}`;
  }
  if (metric.key === "average") return metric.valueLabel;
  if (metric.key === "failed") {
    const amount =
      metric.amountCents != null && metric.amountCents > 0
        ? ` · ${formatSekFromCents(metric.amountCents, metric.currency)}`
        : "";
    return `${metric.count ?? 0}${amount}`;
  }
  if (metric.key === "refunded") return metric.valueLabel;
  if (metric.key === "pending") return `${metric.count ?? 0} open · ${metric.valueLabel}`;
  return metric.valueLabel;
}

function TodaysPaymentsSkeleton() {
  return <PaymentsSectionSpinner label="Loading today’s payments" />;
}

export function TodaysPaymentsPanel({
  token,
  restaurantId,
  refreshKey = 0,
  onViewTodaysTransactions
}: Props) {
  const [today, setToday] = useState<TodaysPaymentsSnapshot | null>(null);
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailQuery, setDetailQuery] = useState<TodaysPaymentsDetailQuery | null>(null);

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

  const openDetail = (query: TodaysPaymentsDetailQuery) => {
    setDetailQuery(query);
    setDetailOpen(true);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const pieMetrics = useMemo(() => {
    if (!today) return [] as TodaysPaymentsMetric[];
    return PIE_METRIC_KEYS.map((key) => today.metrics.find((m) => m.key === key)).filter(
      (m): m is TodaysPaymentsMetric => Boolean(m)
    );
  }, [today]);

  const slices = useMemo<Slice[]>(() => {
    return pieMetrics.map((metric) => {
      const meta = SLICE_META[metric.key] ?? { short: metric.label.slice(0, 6), fill: "#94a3b8" };
      return {
        key: metric.key,
        label: metric.label,
        short: meta.short,
        value: 1,
        fill: meta.fill,
        statusLabel: metricStatusLabel(metric)
      };
    });
  }, [pieMetrics]);

  const methodBars = useMemo<MethodBarRow[]>(() => {
    if (!today) return [];
    return today.methods.map((m) => ({
      ...m,
      amount: Math.max(0, m.amountCents) / 100,
      shortLabel: m.label.length > 14 ? `${m.label.slice(0, 12)}…` : m.label
    }));
  }, [today]);

  if (!today) {
    return <TodaysPaymentsSkeleton />;
  }

  const analysis = today.analysis;
  const tone = analysis?.tone ?? "unknown";
  const toneColor = TOTAL_TONE_COLOR[tone];
  const chipMetrics = pieMetrics.filter((m) => m.key !== "average");
  const barHeight = Math.max(160, methodBars.length * 36 + 24);
  const transactionsView = today.transactionsView ?? {
    label: "View today’s payments",
    day: today.dayKey,
    dayStart: today.dayStart,
    dayEnd: today.dayEnd,
    searchPreset: today.dayKey,
    filter: {
      target: "transactions" as const,
      ids: (today.ledger ?? []).map((r) => r.id),
      day: today.dayKey,
      dayStart: today.dayStart,
      dayEnd: today.dayEnd,
      searchPreset: today.dayKey
    }
  };

  return (
    <>
      <div className="admin-payments-health-pie">
        <div className="admin-payments-health-pie-intro">
          <div className="admin-payments-health-pie-overall admin-payments-today-total-wrap">
            <button
              type="button"
              className="admin-payments-today-total admin-payments-today-total--btn"
              style={{ color: toneColor }}
              tabIndex={0}
              aria-describedby="todays-payments-analysis-tip"
              onClick={() => openDetail({ scope: "collected" })}
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
          </div>
          <p className="admin-payments-health-pie-trend">
            {analysis?.toneLabel ?? "Today’s payments"}
            {analysis?.detail ? ` — ${analysis.detail}` : ""}
          </p>
          <p className="admin-payments-health-pie-sub">
            Total collected today
            {today.source === "demo" ? " · Showing sample activity" : ""}
            {" · "}
            {today.timezone.replace(/_/g, " ")}
            {today.currencies.length > 1 ? ` · ${today.currencies.join(", ")}` : ""}
          </p>
        </div>

        <div className="admin-payments-health-metrics">
          {chipMetrics.slice(0, 4).map((metric) => (
            <button
              key={metric.key}
              type="button"
              className="admin-payments-today-metric-chip"
              onClick={() => openDetail({ scope: "metric", key: metric.key })}
            >
              <span>{metric.label.replace(/\s+payments$/i, "").replace(/\s+amount$/i, "")}</span>
              <strong>{metric.valueLabel}</strong>
            </button>
          ))}
        </div>

        <div className="admin-payments-health-pie-chart">
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
                onMouseEnter={(_, index) => setActiveSlice(index)}
                onMouseLeave={() => setActiveSlice(null)}
                onClick={(_, index) => {
                  const slice = slices[index];
                  if (slice) openDetail({ scope: "metric", key: slice.key });
                }}
                label={(props) => renderPaymentPieSliceLabel(props, props.index === activeSlice)}
                labelLine={false}
                style={{ cursor: "pointer" }}
              >
                {slices.map((slice) => (
                  <Cell key={slice.key} fill={slice.fill} style={{ outline: "none", cursor: "pointer" }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="admin-payments-today-methods-chart" aria-label="Payment methods today">
          <p className="admin-payments-today-block-title">Payment methods</p>
          <p className="admin-payments-today-methods-chart-sub">
            All methods allowed at this venue · collected today
          </p>
          {methodBars.length === 0 ? (
            <p className="admin-payments-today-empty">No payment methods enabled for this venue.</p>
          ) : (
            <div className="admin-payments-today-methods-chart-plot" style={{ height: barHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={methodBars}
                  layout="vertical"
                  margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
                >
                  <XAxis type="number" dataKey="amount" hide />
                  <YAxis
                    type="category"
                    dataKey="shortLabel"
                    width={92}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fill: "var(--admin-config-muted, #475569)", fontSize: 11, fontWeight: 650 }}
                  />
                  <Tooltip cursor={false} content={<MethodBarTooltip />} />
                  <Bar
                    dataKey="amount"
                    radius={5}
                    fill={METHOD_BAR_FILL}
                    cursor="pointer"
                    activeBar={false}
                    background={false}
                    onClick={(data) => {
                      const payload = (data as { payload?: MethodBarRow; key?: string })?.payload ?? data;
                      const key = (payload as MethodBarRow | undefined)?.key;
                      if (key) openDetail({ scope: "method", key });
                    }}
                  >
                    {methodBars.map((row) => (
                      <Cell
                        key={row.key}
                        fill={row.amountCents > 0 ? METHOD_BAR_FILL : "#cbd5e1"}
                        fillOpacity={row.amountCents > 0 ? 1 : 0.55}
                        style={{ outline: "none" }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <button
          type="button"
          className="admin-payments-today-view-all"
          onClick={() => onViewTodaysTransactions?.(transactionsView.filter)}
        >
          {transactionsView.label}
          <span aria-hidden>→</span>
        </button>
      </div>

      <TodaysPaymentsDetailDrawer
        token={token}
        restaurantId={restaurantId}
        query={detailQuery}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailQuery(null);
        }}
      />
    </>
  );
}
