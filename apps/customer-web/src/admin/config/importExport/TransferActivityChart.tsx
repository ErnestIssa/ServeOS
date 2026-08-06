import { useEffect, useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getDataTransferActivity,
  type DataTransferActivityPoint,
  type DataTransferActivityRange,
  type DataTransferActivitySeries
} from "../../../api";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import { SkeletonBone } from "../../AdminSkeleton";

type Props = {
  token: string | null;
  restaurantId: string | null;
  /** Bump to refetch after import/export completes. */
  refreshKey?: number;
};

const RANGE_OPTIONS = [
  { value: "90d", label: "Last 3 months", hint: "Daily imports & exports" },
  { value: "30d", label: "Last 30 days", hint: "Recent transfer volume" },
  { value: "7d", label: "Last 7 days", hint: "This week’s activity" }
] as const;

const RANGE_LABELS: Record<DataTransferActivityRange, string> = {
  "90d": "Last 3 months",
  "30d": "Last 30 days",
  "7d": "Last 7 days"
};

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

function emptyPoints(range: DataTransferActivityRange): DataTransferActivityPoint[] {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), imports: 0, exports: 0 };
  });
}

type TooltipPayload = {
  dataKey?: string | number;
  value?: number;
  color?: string;
  name?: string;
};

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
  return (
    <div className="data-transfer-chart-tooltip">
      <p className="data-transfer-chart-tooltip-date">{formatTooltipDate(label)}</p>
      <ul className="data-transfer-chart-tooltip-list">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? "");
          const name = key === "imports" ? "Imports" : key === "exports" ? "Exports" : key;
          return (
            <li key={key}>
              <span className="data-transfer-chart-tooltip-swatch" style={{ background: entry.color }} />
              <span>{name}</span>
              <strong>{entry.value ?? 0}</strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TransferActivityChart({ token, restaurantId, refreshKey = 0 }: Props) {
  const gradId = useId().replace(/:/g, "");
  const [range, setRange] = useState<DataTransferActivityRange>("90d");
  const [activity, setActivity] = useState<DataTransferActivitySeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    if (!token || !restaurantId) return;
    let cancelled = false;
    setLoading(true);
    void getDataTransferActivity(token, restaurantId, range).then((res) => {
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

  const points = useMemo(() => activity?.points ?? emptyPoints(range), [activity, range]);

  const totals = activity?.totals ?? { imports: 0, exports: 0, operations: 0 };
  const description =
    totals.operations === 0
      ? `No import or export operations in the ${RANGE_LABELS[range].toLowerCase()}.`
      : `${totals.operations} operation${totals.operations === 1 ? "" : "s"} · ${totals.imports} import${totals.imports === 1 ? "" : "s"} · ${totals.exports} export${totals.exports === 1 ? "" : "s"}`;

  const importFill = `url(#fillImports-${gradId})`;
  const exportFill = `url(#fillExports-${gradId})`;

  if (!loadedOnce && loading) {
    return (
      <div className="data-transfer-activity-chart" aria-busy aria-label="Loading activity chart">
        <div className="data-transfer-activity-chart-head">
          <div className="min-w-0 flex-1">
            <SkeletonBone className="h-4 w-40" />
            <SkeletonBone className="mt-2 h-3 w-64" rounded="sm" />
          </div>
          <SkeletonBone className="h-9 w-[160px] shrink-0" rounded="lg" />
        </div>
        <SkeletonBone className="mt-4 h-[250px] w-full" rounded="lg" />
      </div>
    );
  }

  return (
    <section className="data-transfer-activity-chart" aria-label="Transfer activity chart">
      <div className="data-transfer-activity-chart-head">
        <div className="min-w-0 flex-1 grid gap-1">
          <h3 className="data-transfer-activity-chart-title">Transfer activity</h3>
          <p className="data-transfer-activity-chart-desc">{description}</p>
        </div>
        <AdminBubbleDropdown
          className="data-transfer-activity-range"
          label="Period"
          value={range}
          bubbleArrow="end"
          options={[...RANGE_OPTIONS]}
          onChange={(value) => setRange(value as DataTransferActivityRange)}
        />
      </div>

      <div className={`data-transfer-activity-chart-body${loading ? " is-refreshing" : ""}`}>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`fillImports-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--data-transfer-chart-imports)" stopOpacity={0.75} />
                <stop offset="95%" stopColor="var(--data-transfer-chart-imports)" stopOpacity={0.06} />
              </linearGradient>
              <linearGradient id={`fillExports-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--data-transfer-chart-exports)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="var(--data-transfer-chart-exports)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--data-transfer-chart-grid)" strokeDasharray="3 6" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={28}
              tick={{ fill: "var(--admin-text-muted)", fontSize: 11, fontWeight: 600 }}
              tickFormatter={formatAxisDate}
            />
            <YAxis
              allowDecimals={false}
              width={28}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tick={{ fill: "var(--admin-text-muted)", fontSize: 11, fontWeight: 600 }}
            />
            <Tooltip
              cursor={{ stroke: "var(--data-transfer-chart-cursor)", strokeWidth: 1 }}
              content={<ChartTooltipBody />}
            />
            <Area
              dataKey="exports"
              type="natural"
              fill={exportFill}
              stroke="var(--data-transfer-chart-exports)"
              strokeWidth={2}
              stackId="a"
              name="Exports"
              isAnimationActive={!loading || !loadedOnce}
            />
            <Area
              dataKey="imports"
              type="natural"
              fill={importFill}
              stroke="var(--data-transfer-chart-imports)"
              strokeWidth={2}
              stackId="a"
              name="Imports"
              isAnimationActive={!loading || !loadedOnce}
            />
          </AreaChart>
        </ResponsiveContainer>

        <div className="data-transfer-activity-legend" aria-hidden>
          <span>
            <i style={{ background: "var(--data-transfer-chart-imports)" }} />
            Imports
          </span>
          <span>
            <i style={{ background: "var(--data-transfer-chart-exports)" }} />
            Exports
          </span>
        </div>
      </div>
    </section>
  );
}
