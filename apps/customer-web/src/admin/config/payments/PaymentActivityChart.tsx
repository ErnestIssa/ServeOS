import { useEffect, useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getVenuePaymentActivity,
  type PaymentActivityPoint,
  type PaymentActivityRange,
  type PaymentActivitySeries
} from "../../../api";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import { PaymentsSectionSpinner } from "./paymentsLoadingUi";
import { formatSekFromCents } from "./paymentsUiHelpers";

type Props = {
  token: string | null;
  restaurantId: string | null;
  refreshKey?: number;
};

const RANGE_OPTIONS = [
  { value: "90d", label: "Last 3 months", hint: "Daily payment volume" },
  { value: "30d", label: "Last 30 days", hint: "Recent activity" },
  { value: "7d", label: "Last 7 days", hint: "This week" }
] as const;

function formatAxisDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatTooltipDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function emptyPoints(range: PaymentActivityRange): PaymentActivityPoint[] {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), onlineCents: 0, venueCents: 0, refundedCents: 0, failedCents: 0 };
  });
}

type TooltipPayload = { dataKey?: string | number; value?: number; color?: string };

function ChartTooltipBody({
  active,
  label,
  payload
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length || !label) return null;
  const names: Record<string, string> = {
    onlineCents: "Online",
    venueCents: "Pay at venue",
    refundedCents: "Refunded",
    failedCents: "Failed"
  };
  return (
    <div className="data-payments-chart-tooltip">
      <p className="data-payments-chart-tooltip-date">{formatTooltipDate(label)}</p>
      <ul className="data-payments-chart-tooltip-list">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? "");
          return (
            <li key={key}>
              <span className="data-payments-chart-tooltip-swatch" style={{ background: entry.color }} />
              <span>{names[key] ?? key}</span>
              <strong>{formatSekFromCents(entry.value ?? 0)}</strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PaymentActivityChart({ token, restaurantId, refreshKey = 0 }: Props) {
  const gradId = useId().replace(/:/g, "");
  const [range, setRange] = useState<PaymentActivityRange>("30d");
  const [activity, setActivity] = useState<PaymentActivitySeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    if (!token || !restaurantId) return;
    let cancelled = false;
    setLoading(true);
    void getVenuePaymentActivity(token, restaurantId, range).then((res) => {
      if (cancelled) return;
      setLoading(false);
      setLoadedOnce(true);
      if (!res.ok || !res.activity) {
        setActivity(null);
        return;
      }
      setActivity(res.activity);
    });
    return () => {
      cancelled = true;
    };
  }, [token, restaurantId, range, refreshKey]);

  const points = useMemo(() => activity?.points?.length ? activity.points : emptyPoints(range), [activity, range]);
  const chartData = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        online: Math.round(p.onlineCents / 100),
        venue: Math.round(p.venueCents / 100)
      })),
    [points]
  );

  return (
    <div className="data-payments-chart-card">
      <div className="data-payments-chart-head">
        <div>
          <p className="data-payments-chart-title">Payment volume</p>
          <p className="data-payments-chart-desc">
            Online vs pay at venue
            {activity?.source === "demo" ? " · Showing sample activity" : ""}
          </p>
        </div>
        <AdminBubbleDropdown
          label="Period"
          value={range}
          options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label, hint: o.hint }))}
          bubbleArrow="end"
          onChange={(v) => setRange(v as PaymentActivityRange)}
        />
      </div>
      <div className="data-payments-chart-body">
        {!loadedOnce && loading ? (
          <div className="admin-payments-chart-loading">
            <PaymentsSectionSpinner label="Loading payment volume" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`fillOnline-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.75} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id={`fillVenue-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.25)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={formatAxisDate}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip cursor={false} content={<ChartTooltipBody />} />
              <Area
                type="natural"
                dataKey="onlineCents"
                name="Online"
                stroke="#2563eb"
                fill={`url(#fillOnline-${gradId})`}
                strokeWidth={2}
                stackId="a"
              />
              <Area
                type="natural"
                dataKey="venueCents"
                name="Pay at venue"
                stroke="#0f766e"
                fill={`url(#fillVenue-${gradId})`}
                strokeWidth={2}
                stackId="a"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="data-payments-chart-footnote">
        Daily collected payments by channel for the selected period — hover a day for exact amounts.
      </p>
    </div>
  );
}
