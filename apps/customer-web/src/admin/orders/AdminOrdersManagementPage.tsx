import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AdminBubbleDropdown } from "../AdminBubbleDropdown";
import {
  AdminBtnPrimary,
  AdminBtnSecondary,
  AdminEmptyState,
  AdminInput,
  AdminPanel,
  AdminRefreshButton,
  AdminSectionHeader,
  subPanelCls
} from "../AdminUi";
import {
  AdminSkeletonStatGrid,
  AdminSkeletonTable,
  AdminStaleContent
} from "../AdminSkeleton";
import { useAdminToast } from "../AdminToast";
import { fetchVenueStaff } from "../staffApi";
import { resolveWorkspacePreset, WORKSPACE_META, type WorkspacePreset } from "../adminWorkspaceRouting";
import { FullscreenIcon, KitchenFullscreenView } from "./KitchenFullscreenView";
import { KitchenKanban } from "./KitchenKanban";
import { ordersToKitchenTickets } from "./kitchenData";
import { KitchenMoreMenu, type KitchenMenuAction } from "./KitchenMoreMenu";
import { OrderDetailsDrawer } from "./OrderDetailsDrawer";
import { CreateOrderModal, OrderActionConfirmModal } from "./OrderProfileModals";
import { DEFAULT_ORDERS_PAGE_SIZE, OrdersPagination } from "./OrdersPagination";
import { usePageRecoverySync, useSilentRevalidate } from "../sync/adminPageSync";
import { useOrdersRealtimeSync } from "../sync/useOrdersRealtimeSync";
import { useDebouncedValue } from "./useDebouncedValue";
import { useAdminOrders } from "./useAdminOrders";
import type { AdminOrderVm } from "./ordersApiMappers";
import {
  DEFAULT_FILTERS,
  formatCurrency,
  formatTime,
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  problemLabel,
  waitingTone,
  type AdminOrder,
  type OrderFilters,
  type OrderViewPreset
} from "./ordersTypes";

const FILTER_TRANSITION = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };
const RESULTS_TRANSITION = { duration: 0.52, ease: [0.22, 1, 0.36, 1] as const };
const SEARCH_DEBOUNCE_MS = 480;

const PRESET_DESCRIPTIONS: Record<OrderViewPreset, string> = {
  "all-orders": "Manager overview — all statuses for today.",
  "active-orders": "Operational command center — live tickets in the kitchen flow.",
  "kitchen-view": "KDS workflow — accept, prep, and bump tickets fast.",
  "problem-orders": "Exceptions that need attention — delays, refunds, and failures.",
  "completed-orders": "Recently finished — receipts, complaints, and reprints.",
  "order-history": "Archive and investigation — search across date ranges."
};

const DEFAULT_FILTERS_BY_PRESET: Partial<Record<OrderViewPreset, Partial<OrderFilters>>> = {
  "all-orders": { date: "today", status: "all" },
  "active-orders": { date: "today", status: "all" },
  "completed-orders": { date: "today", status: "COMPLETED" },
  "order-history": { date: "30d", status: "all" },
  "problem-orders": { date: "all", status: "all" }
};

const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" }
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...(Object.keys(ORDER_STATUS_LABELS) as Array<keyof typeof ORDER_STATUS_LABELS>).map((s) => ({
    value: s,
    label: ORDER_STATUS_LABELS[s]
  }))
];

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  ...(Object.keys(ORDER_SOURCE_LABELS) as Array<keyof typeof ORDER_SOURCE_LABELS>).map((s) => ({
    value: s,
    label: ORDER_SOURCE_LABELS[s]
  }))
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "PARTIAL_REFUND", label: "Partial refund" }
];

const DEFAULT_STAFF_OPTIONS = [{ value: "all", label: "All staff" }];

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
      <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">{label}</p>
      <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="admin-stat-hint mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: AdminOrder["status"] }) {
  const tone =
    status === "COMPLETED"
      ? "completed"
      : status === "CANCELLED" || status === "REFUNDED" || status === "ARCHIVED"
        ? "muted"
        : status === "PREPARING" || status === "READY"
          ? "active"
          : status === "REFUND_REQUESTED" || status === "DISPUTED" || status === "PAYMENT_FAILED"
            ? "danger"
            : "default";
  return <span className={`admin-orders-status admin-orders-status--${tone}`}>{ORDER_STATUS_LABELS[status]}</span>;
}

function WaitingBadge({ minutes }: { minutes: number }) {
  const tone = waitingTone(minutes);
  return <span className={`admin-orders-wait admin-orders-wait--${tone}`}>{minutes} min</span>;
}

function PriorityDot({ priority }: { priority: AdminOrder["priority"] }) {
  if (priority === "normal") return null;
  return (
    <span className={`admin-orders-priority admin-orders-priority--${priority}`}>
      {priority === "rush" ? "Rush" : "High"}
    </span>
  );
}

function OrderFilterBar({
  filters,
  onChange,
  searchValue,
  onSearchChange,
  searchPending,
  showExtended,
  staffOptions
}: {
  filters: OrderFilters;
  onChange: (next: OrderFilters) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPending?: boolean;
  showExtended: boolean;
  staffOptions: Array<{ value: string; label: string }>;
}) {
  const set = <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="admin-orders-filters">
      <div className="admin-orders-filters-row">
        <label className="admin-orders-filter-field admin-orders-filter-field--grow">
          <span className="admin-orders-search-label">
            Search
            {searchPending ? <span className="admin-orders-search-pending">Updating…</span> : null}
          </span>
          <AdminInput
            className={searchPending ? "admin-orders-search-input--pending" : ""}
            placeholder="Order ID, customer, table…"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
        <div className="admin-orders-filter-field">
          <AdminBubbleDropdown
            label="Date"
            value={filters.date}
            options={DATE_OPTIONS}
            onChange={(v) => set("date", v as OrderFilters["date"])}
            className="admin-orders-filter-dropdown"
          />
        </div>
        <div className="admin-orders-filter-field">
          <AdminBubbleDropdown
            label="Status"
            value={filters.status}
            options={STATUS_OPTIONS}
            onChange={(v) => set("status", v as OrderFilters["status"])}
            className="admin-orders-filter-dropdown"
          />
        </div>
        <div className="admin-orders-filter-field">
          <AdminBubbleDropdown
            label="Source"
            value={filters.source}
            options={SOURCE_OPTIONS}
            onChange={(v) => set("source", v as OrderFilters["source"])}
            className="admin-orders-filter-dropdown"
          />
        </div>
      </div>
      {showExtended ? (
        <div className="admin-orders-filters-row admin-orders-filters-row--secondary">
          <div className="admin-orders-filter-field">
            <AdminBubbleDropdown
              label="Payment"
              value={filters.paymentStatus}
              options={PAYMENT_OPTIONS}
              onChange={(v) => set("paymentStatus", v as OrderFilters["paymentStatus"])}
              className="admin-orders-filter-dropdown"
            />
          </div>
          <div className="admin-orders-filter-field">
            <AdminBubbleDropdown
              label="Staff"
              value={filters.staff || "all"}
              options={staffOptions}
              onChange={(v) => set("staff", v === "all" ? "" : v)}
              className="admin-orders-filter-dropdown"
            />
          </div>
          <label className="admin-orders-filter-field">
            <span>Table</span>
            <AdminInput placeholder="e.g. T12" value={filters.table} onChange={(e) => set("table", e.target.value)} />
          </label>
          <label className="admin-orders-filter-field">
            <span>Customer</span>
            <AdminInput
              placeholder="Name"
              value={filters.customer}
              onChange={(e) => set("customer", e.target.value)}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function RowActions({
  onView,
  onStatus,
  onPrint
}: {
  onView: () => void;
  onStatus: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="admin-orders-row-actions" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="admin-orders-action-btn" onClick={onView}>
        View
      </button>
      <button type="button" className="admin-orders-action-btn" onClick={onStatus}>
        Status
      </button>
      <button type="button" className="admin-orders-action-btn admin-orders-action-btn--ghost" onClick={onPrint}>
        Print
      </button>
    </div>
  );
}

function OrdersTable({
  orders,
  variant,
  onOpen,
  onStatus,
  onPrint,
  optimisticIds
}: {
  orders: AdminOrder[];
  variant: "all" | "active" | "completed" | "problem" | "history";
  onOpen: (order: AdminOrder) => void;
  onStatus: (order: AdminOrder) => void;
  onPrint: (order: AdminOrder) => void;
  optimisticIds?: Set<string>;
}) {
  if (!orders.length) {
    return <p className="admin-orders-empty">No orders match this view.</p>;
  }

  return (
    <div className="admin-orders-table-scroll">
      <table className="admin-orders-table w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr>
            <th>Order</th>
            {variant !== "completed" ? <th>Status</th> : null}
            <th>Customer</th>
            <th>Source</th>
            <th>Items</th>
            <th>Total</th>
            {variant === "completed" ? <th>Completed</th> : <th>Created</th>}
            {variant === "active" || variant === "all" ? <th>Waiting</th> : null}
            {variant === "active" ? (
              <>
                <th>Kitchen</th>
                <th>Priority</th>
              </>
            ) : null}
            {variant === "completed" ? <th>Payment</th> : null}
            <th>Staff</th>
            {variant === "problem" ? <th>Issue</th> : null}
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              className={`admin-orders-row${optimisticIds?.has(order.id) ? " admin-orders-row--optimistic" : ""}`}
              onClick={() => onOpen(order)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(order);
                }
              }}
              tabIndex={0}
              role="button"
            >
              <td>
                <p className="font-semibold admin-orders-text">{order.displayNumber}</p>
                {order.tableNumber ? <p className="text-xs admin-orders-text-muted">Table {order.tableNumber}</p> : null}
              </td>
              {variant !== "completed" ? (
                <td>
                  <StatusBadge status={order.status} />
                </td>
              ) : null}
              <td>
                <p className="admin-orders-text">{order.customerName}</p>
              </td>
              <td>
                <span className="admin-orders-source-pill">{ORDER_SOURCE_LABELS[order.source]}</span>
              </td>
              <td>
                <p className="max-w-[12rem] truncate admin-orders-text-muted">{order.itemsSummary}</p>
                <p className="text-xs admin-orders-text-subtle">{order.itemCount} items</p>
              </td>
              <td className="font-semibold admin-orders-text">{formatCurrency(order.total)}</td>
              <td className="admin-orders-text-muted">
                {variant === "completed" && order.completedAt
                  ? formatTime(order.completedAt)
                  : formatTime(order.createdAt)}
              </td>
              {variant === "active" || variant === "all" ? (
                <td>
                  {["CREATED", "ACCEPTED", "PREPARING", "READY"].includes(order.status) ? (
                    <WaitingBadge minutes={order.waitingMinutes} />
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
              {variant === "active" ? (
                <>
                  <td>
                    <span className="admin-orders-kitchen-pill">{order.kitchenStatus}</span>
                  </td>
                  <td>
                    <PriorityDot priority={order.priority} />
                  </td>
                </>
              ) : null}
              {variant === "completed" ? (
                <td>
                  <span className="admin-orders-payment-pill">{order.paymentStatus}</span>
                </td>
              ) : null}
              <td className="admin-orders-text-muted">{order.assignedStaff ?? "—"}</td>
              {variant === "problem" ? (
                <td>
                  <span className="admin-orders-problem-pill">{problemLabel(order)}</span>
                </td>
              ) : null}
              <td className="text-right">
                <RowActions
                  onView={() => onOpen(order)}
                  onStatus={() => onStatus(order)}
                  onPrint={() => onPrint(order)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PendingOrderAction =
  | { type: "export" }
  | { type: "status"; order: AdminOrder }
  | { type: "print"; order: AdminOrder }
  | { type: "drawer-status"; order: AdminOrder }
  | { type: "drawer-print"; order: AdminOrder };

type Props = {
  presetId: string;
  venueName?: string;
  token?: string | null;
  restaurantId?: string | null;
};

export function AdminOrdersManagementPage({ presetId, venueName = "", token = null, restaurantId = null }: Props) {
  const preset = resolveWorkspacePreset("orders", presetId) as WorkspacePreset & { id: OrderViewPreset };
  const viewPreset = (preset.id in PRESET_DESCRIPTIONS ? preset.id : "all-orders") as OrderViewPreset;
  const meta = WORKSPACE_META.orders;
  const { pushToast } = useAdminToast();

  const [filters, setFilters] = useState<OrderFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...DEFAULT_FILTERS_BY_PRESET[viewPreset]
  }));
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ORDERS_PAGE_SIZE);
  const [kdsFullscreen, setKdsFullscreen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingOrderAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [staffOptions, setStaffOptions] = useState(DEFAULT_STAFF_OPTIONS);
  const [optimisticOrderIds, setOptimisticOrderIds] = useState<Set<string>>(() => new Set());

  const apiEnabled = Boolean(token && restaurantId);

  useEffect(() => {
    const next = { ...DEFAULT_FILTERS, ...DEFAULT_FILTERS_BY_PRESET[viewPreset] };
    setFilters(next);
    setSearchInput(next.search);
    setPage(1);
  }, [viewPreset]);

  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const searchPending = searchInput.trim() !== debouncedSearch.trim();

  useEffect(() => {
    if (!token || !restaurantId) {
      setStaffOptions(DEFAULT_STAFF_OPTIONS);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchVenueStaff(token, restaurantId);
      if (cancelled || !res.ok) return;
      const members = (res.members ?? []).filter((m) => m.status === "ACTIVE" || m.status === "APPROVED");
      setStaffOptions([
        ...DEFAULT_STAFF_OPTIONS,
        ...members.map((m) => ({ value: m.userId, label: m.fullName || m.email || m.userId }))
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, restaurantId]);

  const api = useAdminOrders({
    token,
    restaurantId,
    viewPreset,
    filters,
    debouncedSearch,
    page,
    pageSize
  });

  const { recover, recovering } = usePageRecoverySync([() => api.refresh()]);
  useSilentRevalidate(() => api.refresh({ soft: true }), {
    enabled: Boolean(token && restaurantId),
    minIntervalMs: 12_000,
    intervalMs: 0
  });
  useOrdersRealtimeSync({
    token,
    restaurantId,
    enabled: Boolean(token && restaurantId),
    onEvent: () => {
      void api.refresh({ soft: true });
    }
  });

  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );

  useEffect(() => {
    setPage(1);
  }, [effectiveFilters, pageSize]);

  const stats = api.stats;
  const filtered = api.orders;
  const pagedOrders = filtered;
  const listTotal = api.meta.total;

  const kitchenTickets = useMemo(() => ordersToKitchenTickets(api.orders), [api.orders]);

  const handleKitchenStatusChange = useCallback(
    async (ticket: AdminOrder, nextStatus: string, label: string) => {
      if (!token || !apiEnabled) return;
      setOptimisticOrderIds((prev) => new Set(prev).add(ticket.id));
      const res = await api.updateStatus(ticket.id, nextStatus);
      setOptimisticOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(ticket.id);
        return next;
      });
      if (!res.ok) {
        pushToast(res.error ?? "Status update failed", "error");
        return;
      }
      pushToast(label, "success");
    },
    [token, apiEnabled, api, pushToast]
  );

  const resultsAnimationKey = useMemo(
    () =>
      JSON.stringify({
        viewPreset,
        filters: effectiveFilters,
        page,
        pageSize
      }),
    [viewPreset, effectiveFilters, page, pageSize]
  );

  const openOrder = async (order: AdminOrder) => {
    if (apiEnabled && token) {
      const detail = await api.loadOrderDetail(order.id);
      setSelectedOrder(detail ?? (order as AdminOrderVm));
    } else {
      setSelectedOrder(order);
    }
    setDrawerOpen(true);
  };

  const tableVariant =
    viewPreset === "active-orders"
      ? "active"
      : viewPreset === "completed-orders"
        ? "completed"
        : viewPreset === "problem-orders"
          ? "problem"
          : viewPreset === "order-history"
            ? "history"
            : "all";

  const showExtendedFilters = viewPreset === "order-history" || viewPreset === "all-orders";

  const kdsKanbanProps = {
    tickets: kitchenTickets,
    initialLoading: api.meta.initialLoading,
    refreshing: api.meta.refreshing,
    onOpen: openOrder,
    onStatusChange: handleKitchenStatusChange
  };

  const handleKitchenMenuAction = (action: KitchenMenuAction) => {
    if (action === "fullscreen") {
      setKdsFullscreen(true);
      return;
    }
    pushToast("This action is not available yet.", "success");
  };

  const runPendingAction = async () => {
    if (!pendingAction) return;
    if (!apiEnabled || !token) {
      pushToast("Sign in and select a venue to manage orders.", "error");
      setPendingAction(null);
      return;
    }
    setActionBusy(true);

    if (pendingAction.type === "status" || pendingAction.type === "drawer-status") {
      const raw = pendingAction.order.apiStatus ?? pendingAction.order.status;
      const next =
        raw === "CREATED" || raw === "PENDING_PAYMENT" || raw === "PAID"
          ? "ACCEPTED"
          : raw === "ACCEPTED"
            ? "PREPARING"
            : raw === "PREPARING"
              ? "READY"
              : raw === "READY"
                ? "COMPLETED"
                : pendingAction.order.status;
      setOptimisticOrderIds((prev) => new Set(prev).add(pendingAction.order.id));
      const res = await api.updateStatus(pendingAction.order.id, next);
      setOptimisticOrderIds((prev) => {
        const n = new Set(prev);
        n.delete(pendingAction.order.id);
        return n;
      });
      setActionBusy(false);
      if (!res.ok) {
        pushToast(res.error ?? "Status update failed", "error");
      } else {
        pushToast(`${pendingAction.order.displayNumber} → ${next}`, "success");
      }
      setPendingAction(null);
      return;
    }

    setActionBusy(false);

    if (pendingAction.type === "export") {
      pushToast("Export is not available yet.", "success");
    } else if (pendingAction.type === "print" || pendingAction.type === "drawer-print") {
      pushToast(`Print is not available yet for ${pendingAction.order.displayNumber}.`, "success");
    }

    setPendingAction(null);
  };

  const actionConfirmCopy = (action: PendingOrderAction) => {
    switch (action.type) {
      case "export":
        return {
          title: "Export orders?",
          description: "A spreadsheet of the current filtered view will be prepared for download.",
          note: `${filtered.length} order${filtered.length === 1 ? "" : "s"} in this view.`,
          confirmLabel: "Export"
        };
      case "status":
      case "drawer-status":
        return {
          title: "Update order status?",
          description: `Open the status workflow for ${action.order.displayNumber}?`,
          note: (
            <>
              Customer: <strong>{action.order.customerName}</strong>
              <br />
              Current status: <strong>{ORDER_STATUS_LABELS[action.order.status]}</strong>
            </>
          ),
          confirmLabel: "Continue"
        };
      case "print":
      case "drawer-print":
        return {
          title: "Print receipt?",
          description: `Send ${action.order.displayNumber} to the receipt printer?`,
          note: (
            <>
              Total: <strong>{formatCurrency(action.order.total)}</strong>
              <br />
              Payment: <strong>{action.order.paymentStatus}</strong>
            </>
          ),
          confirmLabel: "Print"
        };
    }
  };

  const pendingCopy = pendingAction ? actionConfirmCopy(pendingAction) : null;

  if (!apiEnabled) {
    return (
      <AdminPanel id="ws-orders" className="admin-top-page admin-panel--edge admin-orders-page">
        <AdminSectionHeader
          eyebrowText={meta.eyebrow}
          title={preset.label}
          description={PRESET_DESCRIPTIONS[viewPreset]}
        />
        <div className={`${subPanelCls} mt-8 p-6`}>
          <AdminEmptyState>Sign in and select a venue to view and manage orders.</AdminEmptyState>
        </div>
      </AdminPanel>
    );
  }

  return (
    <>
      <AdminPanel id="ws-orders" className="admin-top-page admin-panel--edge admin-orders-page">
        <AdminSectionHeader
          eyebrowText={meta.eyebrow}
          title={preset.label}
          description={PRESET_DESCRIPTIONS[viewPreset]}
          action={
            viewPreset === "kitchen-view" ? (
              <div className="admin-orders-kitchen-actions">
                <AdminRefreshButton
                  onRefresh={() => void recover()}
                  refreshing={recovering || api.meta.refreshing}
                  label="Sync orders"
                />
                <AdminBtnSecondary className="admin-orders-fullscreen-btn" onClick={() => setKdsFullscreen(true)}>
                  <FullscreenIcon className="admin-orders-fullscreen-icon" />
                  Full screen
                </AdminBtnSecondary>
                <KitchenMoreMenu onAction={handleKitchenMenuAction} />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <AdminRefreshButton
                  onRefresh={() => void recover()}
                  refreshing={recovering || api.meta.refreshing}
                  label="Sync orders"
                />
                <AdminBtnSecondary onClick={() => setPendingAction({ type: "export" })}>Export</AdminBtnSecondary>
                <AdminBtnPrimary onClick={() => setCreateOpen(true)}>Create order</AdminBtnPrimary>
              </div>
            )
          }
        />

        <AdminStaleContent refreshing={api.meta.refreshing}>
          {api.meta.initialLoading ? (
            <div className="mt-8">
              <AdminSkeletonStatGrid />
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Open tickets" value={String(stats.open)} hint="Active in kitchen flow" />
              <StatTile label="Avg wait" value={`${stats.avgWait} min`} hint="Active orders only" />
              <StatTile label="Problems" value={String(stats.problems)} hint="Needs manager attention" />
              <StatTile label="Completed today" value={String(stats.completedToday)} hint="Finished orders" />
            </div>
          )}

        {viewPreset !== "kitchen-view" ? (
          <div className={`${subPanelCls} admin-orders-section mt-5 p-4`}>
            <OrderFilterBar
              filters={filters}
              onChange={setFilters}
              searchValue={searchInput}
              onSearchChange={setSearchInput}
              searchPending={searchPending}
              showExtended={showExtendedFilters}
              staffOptions={staffOptions}
            />
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={viewPreset}
            className="mt-5"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={FILTER_TRANSITION}
          >
            <div className={`${subPanelCls} admin-orders-section overflow-hidden p-0`}>
              {viewPreset === "kitchen-view" ? (
                kdsFullscreen ? (
                  <p className="admin-orders-kds-handoff">Kitchen display is open in full screen mode.</p>
                ) : (
                  <KitchenKanban {...kdsKanbanProps} />
                )
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={resultsAnimationKey}
                    className="admin-orders-results-panel"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={RESULTS_TRANSITION}
                  >
                    <AdminStaleContent refreshing={api.meta.refreshing}>
                      {api.meta.initialLoading ? (
                        <AdminSkeletonTable rows={8} columns={tableVariant === "active" ? 9 : 7} />
                      ) : (
                        <>
                          <OrdersTable
                            orders={pagedOrders}
                            variant={tableVariant}
                            onOpen={openOrder}
                            onStatus={(order) => setPendingAction({ type: "status", order })}
                            onPrint={(order) => setPendingAction({ type: "print", order })}
                            optimisticIds={optimisticOrderIds}
                          />
                          <OrdersPagination
                            page={page}
                            pageSize={pageSize}
                            total={listTotal}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                          />
                        </>
                      )}
                    </AdminStaleContent>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {viewPreset !== "kitchen-view" ? (
          <p className="mt-4 text-xs admin-orders-text-subtle">
            {listTotal} order{listTotal === 1 ? "" : "s"} in this view
            {api.meta.error ? ` · ${api.meta.error}` : ""}
          </p>
        ) : null}
        </AdminStaleContent>
      </AdminPanel>

      <KitchenFullscreenView
        open={kdsFullscreen}
        onClose={() => setKdsFullscreen(false)}
        venueName={venueName}
      >
        <KitchenKanban {...kdsKanbanProps} fullscreen />
      </KitchenFullscreenView>

      <OrderDetailsDrawer
        order={selectedOrder}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        token={token}
        restaurantId={restaurantId}
        onOrderRefresh={async () => {
          api.refresh();
          if (selectedOrder && token) {
            const detail = await api.loadOrderDetail(selectedOrder.id);
            if (detail) setSelectedOrder(detail);
          }
        }}
        onToast={(msg, tone) => pushToast(msg, tone ?? "success")}
        onUpdateStatus={
          selectedOrder
            ? () => setPendingAction({ type: "drawer-status", order: selectedOrder })
            : undefined
        }
        onPrintReceipt={
          selectedOrder ? () => setPendingAction({ type: "drawer-print", order: selectedOrder }) : undefined
        }
      />

      <CreateOrderModal
        open={createOpen}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        staffOptions={staffOptions.filter((s) => s.value !== "all")}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          api.refresh();
          pushToast("Order created.", "success");
        }}
      />

      {pendingCopy ? (
        <OrderActionConfirmModal
          open={Boolean(pendingAction)}
          title={pendingCopy.title}
          description={pendingCopy.description}
          note={pendingCopy.note}
          confirmLabel={pendingCopy.confirmLabel}
          busy={actionBusy}
          onCancel={() => {
            if (!actionBusy) setPendingAction(null);
          }}
          onConfirm={() => void runPendingAction()}
        />
      ) : null}
    </>
  );
}
