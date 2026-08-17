import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
import type { PaymentHealthStatus, PaymentReconciliation } from "../../../api";
import { useAdminToast } from "../../AdminToast";
import { MenuActionConfirmModal } from "../menu/MenuActionConfirmModal";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { MenuListSearchField, usePinnedViewportNode } from "../menu/MenuPageUi";
import { MenuSurfacePagination } from "../menu/MenuSurfacePagination";
import { MENU_LIST_PAGE_SIZE, useMenuListPagination } from "../menu/useMenuListPagination";
import { renderPaymentPieSliceLabel } from "./paymentPieLabels";
import { PaymentsSectionSpinner } from "./paymentsLoadingUi";
import { PaySection } from "./paymentsShared";
import { formatSekFromCents, formatWhen } from "./paymentsUiHelpers";
import { ReconciliationMismatchDrawer } from "./ReconciliationMismatchDrawer";
import {
  applyMismatchFilters,
  applyMismatchSort,
  applyMismatchStatusFilter,
  buildMismatchActions,
  groupMismatchesByStatus,
  matchesMismatchSearch,
  mismatchConfirmCopy,
  mismatchStatusBadge,
  mismatchStatusHeading,
  mismatchTone,
  mismatchTypeLabel,
  MISMATCH_STATUS_ORDER,
  MISMATCHES_LIST_QUERY,
  providerLabel,
  toMismatchRows,
  type MismatchActionId,
  type MismatchStatusFilter,
  type ReconciliationMismatchRow
} from "./reconciliationMismatches";

type Props = {
  reconciliation: PaymentReconciliation | null;
  canEdit?: boolean;
};

const STATUS_FILL: Record<PaymentHealthStatus, string> = {
  operational: "#16a34a",
  degraded: "#d97706",
  disabled: "#dc2626",
  unknown: "#94a3b8"
};

const OVERALL_FILL = {
  healthy: "#16a34a",
  degraded: "#d97706",
  critical: "#dc2626"
} as const;

const MATCH_TONE_COLOR = {
  ahead: "#16a34a",
  on_track: "#d97706",
  behind: "#dc2626"
} as const;

const BAR_FILL = {
  matched: "#16a34a",
  mismatched: "#dc2626",
  pending: "#d97706"
} as const;

type HealthSlice = {
  key: string;
  label: string;
  short: string;
  value: number;
  fill: string;
  statusLabel: string;
};

type AgreementBarRow = {
  key: keyof typeof BAR_FILL;
  label: string;
  shortLabel: string;
  count: number;
  sharePercent: number;
};

function dimStatus(ok: boolean, warn: boolean): PaymentHealthStatus {
  if (ok) return "operational";
  if (warn) return "degraded";
  return "disabled";
}

function ChartTooltipBody({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: HealthSlice }>;
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

function AgreementBarTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: AgreementBarRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="admin-payments-health-tooltip">
      <p className="admin-payments-health-tooltip-title">{row.label}</p>
      <p className="admin-payments-health-tooltip-status" style={{ color: BAR_FILL[row.key] }}>
        {row.count} payment{row.count === 1 ? "" : "s"} · {row.sharePercent}%
      </p>
    </div>
  );
}

export function PaymentsReconciliationTab({ reconciliation, canEdit = false }: Props) {
  const { pushToast } = useAdminToast();
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(MISMATCHES_LIST_QUERY.defaultSort);
  const [statusFilter, setStatusFilter] = useState<MismatchStatusFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<ReconciliationMismatchRow | null>(null);
  const [confirm, setConfirm] = useState<{ action: MismatchActionId; row: ReconciliationMismatchRow } | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Partial<ReconciliationMismatchRow>>>({});
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const { nodeRef: mismatchPinRef, pin: pinMismatchList } = usePinnedViewportNode();
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultsMinHeightRef = useRef(0);

  const rows = useMemo(() => {
    if (!reconciliation) return [] as ReconciliationMismatchRow[];
    const hidden = new Set(hiddenIds);
    return toMismatchRows(reconciliation)
      .map((row) => ({ ...row, ...overrides[row.id] }))
      .filter((row) => !hidden.has(row.id) && row.status !== "resolved");
  }, [reconciliation, overrides, hiddenIds]);

  const filtered = useMemo(() => {
    const searched = rows.filter((r) => matchesMismatchSearch(r, searchQuery));
    const narrowed = applyMismatchFilters(searched, activeFilters);
    const byStatus = applyMismatchStatusFilter(narrowed, statusFilter);
    return applyMismatchSort(byStatus, activeSort);
  }, [rows, searchQuery, activeFilters, activeSort, statusFilter]);

  const pager = useMenuListPagination(filtered, {
    pageSize: MENU_LIST_PAGE_SIZE,
    resetKey: `${searchQuery}:${activeFilters.join(",")}:${activeSort}:${statusFilter}`
  });
  const paged = pager.pagedItems;
  const sections = useMemo(() => groupMismatchesByStatus(paged), [paged]);
  const listedSections =
    statusFilter === "all" ? sections : [{ status: statusFilter, label: "", rows: paged }];
  const statusChipOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.status));
    return MISMATCH_STATUS_ORDER.filter((s) => present.has(s));
  }, [rows]);

  useLayoutEffect(() => {
    const el = resultsRef.current;
    if (!el) return;
    resultsMinHeightRef.current = Math.max(resultsMinHeightRef.current, el.getBoundingClientRect().height);
    el.style.minHeight = `${resultsMinHeightRef.current}px`;
  }, [filtered, paged, statusFilter]);

  const view = useMemo(() => {
    if (!reconciliation) return null;
    const mismatched = rows.length;
    const pending = reconciliation.pendingProviderEvents;
    const payments = reconciliation.payments;
    const orders = reconciliation.orders;
    const matched = Math.max(0, payments - mismatched);
    const matchRate = payments > 0 ? Math.round((matched / payments) * 1000) / 10 : 100;
    const orderGap = Math.abs(orders - payments);
    const overall =
      mismatched === 0 && pending === 0 && orderGap <= 1
        ? ("healthy" as const)
        : matchRate < 95 || mismatched > 8
          ? ("critical" as const)
          : ("degraded" as const);
    const overallLabel = overall === "healthy" ? "In agreement" : overall === "critical" ? "Out of sync" : "Needs review";
    const summary =
      mismatched === 0
        ? "ServeOS and the payment provider agree on the current ledger."
        : `ServeOS and the provider disagree on ${mismatched} payment${mismatched === 1 ? "" : "s"}.`;
    const matchTone = mismatched === 0 || matchRate >= 99.9 ? "ahead" : matchRate >= 97 ? "on_track" : "behind";
    const matchToneLabel = matchTone === "ahead" ? "Clean match" : matchTone === "on_track" ? "Mostly matched" : "Needs attention";
    const newest = rows[0]?.createdAt ?? new Date().toISOString();
    return {
      source: reconciliation.source,
      orders,
      payments,
      matched,
      mismatched,
      pending,
      matchRate,
      overall,
      overallLabel,
      summary,
      matchTone,
      matchToneLabel,
      evaluatedAt: newest,
      lastPaymentAt: newest,
      lastWebhookAt: newest,
      lastReconciliationAt: newest
    };
  }, [reconciliation, rows]);

  const slices = useMemo<HealthSlice[]>(() => {
    if (!view) return [];
    const matchOk = view.mismatched === 0;
    const eventsOk = view.pending === 0;
    const ordersOk = Math.abs(view.orders - view.payments) <= 1;
    const gapsOk = view.mismatched === 0;
    const items: Array<{ key: string; label: string; short: string; status: PaymentHealthStatus; statusLabel: string }> = [
      {
        key: "match",
        label: "Ledger match",
        short: "Match",
        status: dimStatus(matchOk, view.matchRate >= 97),
        statusLabel: `${view.matched.toLocaleString()} of ${view.payments.toLocaleString()} matched`
      },
      {
        key: "events",
        label: "Provider events",
        short: "Events",
        status: dimStatus(eventsOk, view.pending <= 3),
        statusLabel: eventsOk ? "No events waiting" : `${view.pending} event${view.pending === 1 ? "" : "s"} waiting`
      },
      {
        key: "orders",
        label: "Order coverage",
        short: "Orders",
        status: dimStatus(ordersOk, Math.abs(view.orders - view.payments) <= 5),
        statusLabel: `${view.orders.toLocaleString()} orders · ${view.payments.toLocaleString()} payments`
      },
      {
        key: "gaps",
        label: "Open mismatches",
        short: "Gaps",
        status: dimStatus(gapsOk, view.mismatched <= 5),
        statusLabel: gapsOk ? "No open mismatches" : `${view.mismatched} open`
      }
    ];
    return items.map((item) => ({
      ...item,
      value: 1,
      fill: STATUS_FILL[item.status]
    }));
  }, [view]);

  const agreementBars = useMemo<AgreementBarRow[]>(() => {
    if (!view) return [];
    const total = Math.max(1, view.payments);
    return [
      {
        key: "matched",
        label: "Matched",
        shortLabel: "Matched",
        count: view.matched,
        sharePercent: Math.round((view.matched / total) * 100)
      },
      {
        key: "mismatched",
        label: "Mismatched",
        shortLabel: "Mismatched",
        count: view.mismatched,
        sharePercent: Math.round((view.mismatched / total) * 100)
      },
      {
        key: "pending",
        label: "Pending events",
        shortLabel: "Pending",
        count: view.pending,
        sharePercent: Math.round((view.pending / total) * 100)
      }
    ];
  }, [view]);

  const copyText = async (value: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast(ok, "success");
    } catch {
      pushToast("Could not copy to clipboard.", "error");
    }
  };

  const runAction = async (action: MismatchActionId, row: ReconciliationMismatchRow) => {
    if (action === "view") {
      setDetailRow(row);
      return;
    }
    if (action === "copy_id") {
      await copyText(row.id, "Mismatch ID copied.");
      return;
    }
    if (action === "copy_order_id" && row.orderId) {
      await copyText(row.orderId, "Order ID copied.");
      return;
    }
    if (action === "copy_payment_id" && row.paymentId) {
      await copyText(row.paymentId, "Payment ID copied.");
      return;
    }
    setBusy(true);
    await new Promise((r) => window.setTimeout(r, 280));
    if (action === "mark_investigating") {
      setOverrides((cur) => ({ ...cur, [row.id]: { ...cur[row.id], status: "investigating" } }));
      pushToast("Mismatch marked as investigating.", "success");
    } else if (action === "mark_resolved" || action === "ignore" || action === "match_to_order") {
      setHiddenIds((cur) => [...cur, row.id]);
      pushToast(
        action === "ignore" ? "Mismatch ignored." : action === "match_to_order" ? "Payment matched to an order." : "Mismatch resolved.",
        "success"
      );
    } else if (action === "recalculate_amount") {
      setOverrides((cur) => ({ ...cur, [row.id]: { ...cur[row.id], status: "investigating" } }));
      pushToast("Amount recalculated against the provider capture.", "success");
    } else if (action === "retry_provider") {
      pushToast(`Latest events pulled from ${providerLabel(row.provider)}.`, "success");
    }
    setBusy(false);
    setConfirm(null);
  };

  const handleAction = (row: ReconciliationMismatchRow, actionId: string) => {
    setOpenMenuId(null);
    const action = actionId as MismatchActionId;
    if (
      action === "match_to_order" ||
      action === "recalculate_amount" ||
      action === "retry_provider" ||
      action === "mark_investigating" ||
      action === "mark_resolved" ||
      action === "ignore"
    ) {
      setConfirm({ action, row });
      return;
    }
    void runAction(action, row);
  };

  const scrollToMismatches = () => {
    document.getElementById("payments-reconciliation-mismatches")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!reconciliation || !view) {
    return <PaymentsSectionSpinner label="Loading reconciliation" />;
  }

  const confirmCopy = confirm
    ? mismatchConfirmCopy(confirm.action, confirm.row)
    : { title: "", description: "", label: "Confirm", danger: false };
  const barHeight = Math.max(160, agreementBars.length * 36 + 24);

  return (
    <div className="admin-payments-tab-stack">
      <div className="admin-payments-overview-grid">
        <PaySection title="Reconciliation" description="Does ServeOS agree with the payment provider?" borderless>
          <div className="admin-payments-health-pie">
            <div className="admin-payments-health-pie-intro">
              <div className="admin-payments-today-total-wrap">
                <span
                  className="admin-payments-health-pie-overall admin-payments-today-total"
                  style={{ color: OVERALL_FILL[view.overall] }}
                  tabIndex={0}
                  aria-describedby="reconciliation-overall-tip"
                >
                  {view.overallLabel}
                  <span
                    id="reconciliation-overall-tip"
                    className="admin-payments-today-total-tip admin-payments-health-tooltip"
                    role="tooltip"
                  >
                    <span className="admin-payments-health-tooltip-title">{view.overallLabel}</span>
                    <span className="admin-payments-health-tooltip-status" style={{ color: OVERALL_FILL[view.overall] }}>
                      {view.summary}
                    </span>
                    <span className="admin-payments-today-total-tip-meta">
                      Match {view.matchRate}%
                      {" · "}
                      Open {view.mismatched}
                      {" · "}
                      Last checked {formatWhen(view.evaluatedAt)}
                    </span>
                  </span>
                </span>
              </div>
              <p className="admin-payments-health-pie-trend">{view.summary}</p>
              <p className="admin-payments-health-pie-sub">
                Last checked {formatWhen(view.evaluatedAt)}
                {view.source === "demo" ? " · Showing sample activity" : ""}
              </p>
            </div>

            <div className="admin-payments-health-metrics" aria-readonly="true">
              <div>
                <span>Orders</span>
                <strong>{view.orders.toLocaleString()}</strong>
              </div>
              <div>
                <span>Payments</span>
                <strong>{view.payments.toLocaleString()}</strong>
              </div>
              <div>
                <span>Matched</span>
                <strong>{view.matched.toLocaleString()}</strong>
              </div>
              <div>
                <span>Mismatches</span>
                <strong>{view.mismatched.toLocaleString()}</strong>
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

            <div className="admin-payments-health-timestamps">
              <span>Last payment {formatWhen(view.lastPaymentAt)}</span>
              <span>Last webhook {formatWhen(view.lastWebhookAt)}</span>
              <span>Last reconcile {formatWhen(view.lastReconciliationAt)}</span>
            </div>
          </div>
        </PaySection>

        <PaySection title="Match rate" description="Share of payments that reconcile cleanly." borderless>
          <div className="admin-payments-health-pie">
            <div className="admin-payments-health-pie-intro">
              <div className="admin-payments-health-pie-overall admin-payments-today-total-wrap">
                <button
                  type="button"
                  className="admin-payments-today-total admin-payments-today-total--btn"
                  style={{ color: MATCH_TONE_COLOR[view.matchTone] }}
                  tabIndex={0}
                  aria-describedby="reconciliation-match-tip"
                  onClick={scrollToMismatches}
                >
                  {view.matchRate}%
                  <span
                    id="reconciliation-match-tip"
                    className="admin-payments-today-total-tip admin-payments-health-tooltip"
                    role="tooltip"
                  >
                    <span className="admin-payments-health-tooltip-title">{view.matchToneLabel}</span>
                    <span
                      className="admin-payments-health-tooltip-status"
                      style={{ color: MATCH_TONE_COLOR[view.matchTone] }}
                    >
                      {view.matched.toLocaleString()} of {view.payments.toLocaleString()} payments agree
                    </span>
                    <span className="admin-payments-today-total-tip-meta">
                      Open mismatches {view.mismatched}
                      {" · "}
                      Pending events {view.pending}
                    </span>
                  </span>
                </button>
              </div>
              <p className="admin-payments-health-pie-trend">
                {view.matchToneLabel} — {view.matched.toLocaleString()} of {view.payments.toLocaleString()} payments agree
              </p>
              <p className="admin-payments-health-pie-sub">
                Share of payments that reconcile cleanly
                {view.source === "demo" ? " · Showing sample activity" : ""}
              </p>
            </div>

            <div className="admin-payments-health-metrics" aria-readonly="true">
              <div>
                <span>Matched</span>
                <strong>{view.matched.toLocaleString()}</strong>
              </div>
              <div>
                <span>Mismatched</span>
                <strong>{view.mismatched.toLocaleString()}</strong>
              </div>
              <div>
                <span>Pending</span>
                <strong>{view.pending.toLocaleString()}</strong>
              </div>
              <div>
                <span>Payments</span>
                <strong>{view.payments.toLocaleString()}</strong>
              </div>
            </div>

            <div className="admin-payments-today-methods-chart" aria-label="Agreement breakdown">
              <p className="admin-payments-today-block-title">Agreement breakdown</p>
              <p className="admin-payments-today-methods-chart-sub">Matched, open mismatches, and provider events still waiting</p>
              <div className="admin-payments-today-methods-chart-plot" style={{ height: barHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agreementBars} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
                    <XAxis type="number" dataKey="count" hide />
                    <YAxis
                      type="category"
                      dataKey="shortLabel"
                      width={92}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fill: "var(--admin-config-muted, #475569)", fontSize: 11, fontWeight: 650 }}
                    />
                    <Tooltip cursor={false} content={<AgreementBarTooltip />} />
                    <Bar dataKey="count" radius={5} cursor="pointer" activeBar={false} background={false} onClick={scrollToMismatches}>
                      {agreementBars.map((row) => (
                        <Cell
                          key={row.key}
                          fill={row.count > 0 ? BAR_FILL[row.key] : "#cbd5e1"}
                          fillOpacity={row.count > 0 ? 1 : 0.55}
                          style={{ outline: "none" }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </PaySection>
      </div>

      <PaySection title="Mismatches" description="Investigate before settlement closes." borderless>
        <div
          id="payments-reconciliation-mismatches"
          ref={mismatchPinRef}
          className="admin-payments-methods-page admin-payments-methods-page--unified"
        >
          <MenuListSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search mismatches by type, order, payment, or provider…"
            aria-label="Search mismatches"
            filterGroups={MISMATCHES_LIST_QUERY.filterGroups}
            sortOptions={MISMATCHES_LIST_QUERY.sortOptions}
            defaultSort={MISMATCHES_LIST_QUERY.defaultSort}
            activeFilters={activeFilters}
            activeSort={activeSort}
            totalCount={rows.length}
            resultCount={filtered.length}
            onFiltersChange={setActiveFilters}
            onSortChange={setActiveSort}
            filterTitle="Filter mismatches"
            filterSubtitle="Narrow by status, type, and provider."
            sortTitle="Sort mismatches"
            sortSubtitle="Changes apply to the list instantly."
          />

          <div className="admin-payments-methods-list-toolbar">
            <div className="admin-payments-methods-family-chips" role="tablist" aria-label="Mismatch status groups">
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "all"}
                className={`admin-payments-methods-family-chip${statusFilter === "all" ? " is-active" : ""}`}
                onClick={() => {
                  pinMismatchList();
                  setStatusFilter("all");
                }}
              >
                All
              </button>
              {statusChipOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === status}
                  className={`admin-payments-methods-family-chip${statusFilter === status ? " is-active" : ""}`}
                  onClick={() => {
                    pinMismatchList();
                    setStatusFilter(status);
                  }}
                >
                  {mismatchStatusHeading(status)}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div ref={resultsRef} className="admin-payments-list-results">
              <p className="admin-config-text-muted py-2 text-sm">No mismatches match your search or filters.</p>
            </div>
          ) : (
            <div ref={resultsRef} className="admin-payments-list-results">
              <div className={`admin-payments-methods-grouped-list ${pager.pageClassName}`}>
                {listedSections.map((section) => (
                  <section key={section.status} className="admin-payments-methods-family-section">
                    {statusFilter === "all" && section.label ? (
                      <h3 className="admin-payments-methods-family-heading">{section.label}</h3>
                    ) : null}
                    <ul className="admin-menu-surface-list admin-payments-methods-surface-list">
                      {section.rows.map((row, index) => {
                        const tone = mismatchTone(row);
                        return (
                          <li
                            key={row.id}
                            className="admin-menu-surface-list-item"
                            style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                          >
                            <div
                              className={`admin-menu-surface-card admin-payments-method-card-row is-${tone}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => setDetailRow(row)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setDetailRow(row);
                                }
                              }}
                            >
                              <span className={`admin-menu-surface-status admin-payments-method-tone is-${tone}`}>
                                {mismatchStatusBadge(row.status)}
                              </span>
                              <div className="admin-menu-surface-main">
                                <span className={`admin-menu-surface-name admin-payments-method-tone is-${tone}`}>
                                  {mismatchTypeLabel(row.type)}
                                </span>
                                <span className="admin-menu-surface-sep" aria-hidden>
                                  ·
                                </span>
                                <span className="admin-menu-surface-desc">{row.summary}</span>
                                <span className="admin-menu-surface-sep" aria-hidden>
                                  ·
                                </span>
                                <span className="admin-menu-surface-meta">
                                  {providerLabel(row.provider)}
                                  {row.orderId ? ` · ${row.orderId}` : ""}
                                  {" · "}
                                  {formatWhen(row.createdAt)}
                                </span>
                              </div>
                              <strong className="admin-menu-surface-meta">
                                {row.amountCents != null ? formatSekFromCents(row.amountCents) : "—"}
                              </strong>
                              <div
                                className="admin-menu-surface-actions"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <MenuEntityActionsMenu
                                  entityName={mismatchTypeLabel(row.type)}
                                  subtitle={row.summary}
                                  hideHeader
                                  open={openMenuId === row.id}
                                  actions={buildMismatchActions(row, { canEdit })}
                                  onToggle={() => setOpenMenuId((cur) => (cur === row.id ? null : row.id))}
                                  onAction={(id) => handleAction(row, id)}
                                />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
              {pager.showPagination ? (
                <MenuSurfacePagination
                  page={pager.page}
                  totalPages={pager.totalPages}
                  totalItems={pager.totalItems}
                  pageSize={pager.pageSize}
                  onPageChange={pager.goToPage}
                  label="Mismatches pagination"
                />
              ) : null}
            </div>
          )}
        </div>
      </PaySection>

      <ReconciliationMismatchDrawer open={Boolean(detailRow)} mismatch={detailRow} onClose={() => setDetailRow(null)} />

      <MenuActionConfirmModal
        open={Boolean(confirm)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.label}
        danger={confirmCopy.danger}
        busy={busy}
        onClose={() => (busy ? undefined : setConfirm(null))}
        onConfirm={() => {
          if (!confirm) return;
          void runAction(confirm.action, confirm.row);
        }}
      />
    </div>
  );
}
