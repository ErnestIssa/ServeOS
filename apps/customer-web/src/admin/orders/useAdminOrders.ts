import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyOrderEdit,
  fetchAdminOrderDetail,
  fetchAdminOrderStats,
  fetchAdminOrders,
  fetchOrderById,
  patchOrderStatus,
  recordSourceInterpretation,
  type OrderEditOperation,
  type SourceInterpretation
} from "./ordersApi";
import { enrichOrderDetail, mapApiOrderRow, presetToApiQuery } from "./ordersApiMappers";
import type { AdminOrderVm } from "./ordersApiMappers";
import type { OrderFilters, OrderViewPreset } from "./ordersTypes";

export function useAdminOrders(input: {
  token: string | null;
  restaurantId: string | null;
  viewPreset: OrderViewPreset;
  filters: OrderFilters;
  debouncedSearch: string;
  page: number;
  pageSize: number;
}) {
  const [orders, setOrders] = useState<AdminOrderVm[]>([]);
  const [stats, setStats] = useState({ open: 0, avgWait: 0, problems: 0, completedToday: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const versionMap = useRef<Record<string, number>>({});

  const enabled = Boolean(input.token && input.restaurantId);

  const reload = useCallback(async () => {
    if (!enabled || !input.token || !input.restaurantId) return;
    setLoading(true);
    setError(null);
    const presetQuery = presetToApiQuery(input.viewPreset);
    const [listRes, statsRes] = await Promise.all([
      fetchAdminOrders(input.token, input.restaurantId, {
        page: input.page,
        pageSize: input.pageSize,
        ...presetQuery,
        status: input.filters.status,
        source: input.filters.source,
        paymentStatus: input.filters.paymentStatus,
        search: buildSearch(input.debouncedSearch, input.filters)
      }),
      fetchAdminOrderStats(input.token, input.restaurantId)
    ]);
    setLoading(false);
    if (!listRes.ok) {
      setError(listRes.error ?? "Failed to load orders");
      return;
    }
    const mapped = (listRes.orders ?? []).map((r) => {
      const row = mapApiOrderRow(r);
      row.version = versionMap.current[r.id] ?? row.version;
      return row;
    });
    setOrders(mapped);
    setTotal(listRes.total ?? mapped.length);
    if (statsRes.ok && statsRes.stats) setStats(statsRes.stats);
  }, [
    enabled,
    input.token,
    input.restaurantId,
    input.page,
    input.pageSize,
    input.viewPreset,
    input.filters,
    input.debouncedSearch
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadOrderDetail = useCallback(
    async (orderId: string): Promise<AdminOrderVm | null> => {
      if (!input.token || !input.restaurantId) return null;
      const [detailRes, versionRes] = await Promise.all([
        fetchAdminOrderDetail(input.token, input.restaurantId, orderId),
        fetchOrderById(input.token, orderId)
      ]);
      if (!detailRes.ok || !detailRes.order) return null;
      const base = mapApiOrderRow(detailRes.order);
      const version = versionRes.ok && versionRes.order ? versionRes.order.version : base.version;
      versionMap.current[orderId] = version;
      return enrichOrderDetail({ ...base, version }, detailRes.order);
    },
    [input.token, input.restaurantId]
  );

  const updateStatus = useCallback(
    async (orderId: string, status: string) => {
      if (!input.token) return { ok: false as const, error: "Not signed in" };
      const res = await patchOrderStatus(input.token, orderId, status);
      if (res.ok) void reload();
      return res;
    },
    [input.token, reload]
  );

  const runEdit = useCallback(
    async (
      order: AdminOrderVm,
      operation: OrderEditOperation,
      payload: Record<string, unknown>,
      reason?: string
    ) => {
      if (!input.token) return { ok: false as const, error: "Not signed in" };
      const res = await applyOrderEdit(input.token, order.id, {
        expectedVersion: order.version,
        operation,
        payload,
        reason,
        requestSource: "UI"
      });
      if (res.ok && res.version != null) versionMap.current[order.id] = res.version;
      if (res.ok) void reload();
      return res;
    },
    [input.token, reload]
  );

  const runSourceInterpretation = useCallback(
    async (orderId: string, interpretation: SourceInterpretation, note?: string) => {
      if (!input.token) return { ok: false as const, error: "Not signed in" };
      const res = await recordSourceInterpretation(input.token, orderId, { interpretation, note });
      if (res.ok) void reload();
      return res;
    },
    [input.token, reload]
  );

  return {
    orders,
    stats,
    meta: { enabled, loading, error, total },
    refresh: reload,
    loadOrderDetail,
    updateStatus,
    runEdit,
    runSourceInterpretation
  };
}

function buildSearch(debounced: string, filters: OrderFilters): string {
  return [debounced.trim(), filters.customer.trim(), filters.table.trim()].filter(Boolean).join(" ");
}
