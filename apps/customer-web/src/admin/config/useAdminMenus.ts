import { useCallback, useEffect, useRef, useState } from "react";
import {
  listRestaurantMenus,
  type MenuListPagination,
  type MenuListStatusFilter,
  type MenuSurfaceRow
} from "../../api";

export function useAdminMenus(
  token: string | null,
  restaurantId: string | null,
  status: MenuListStatusFilter = "active",
  enabled = true
) {
  const [menus, setMenus] = useState<MenuSurfaceRow[]>([]);
  const [pagination, setPagination] = useState<MenuListPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const hookEnabled = Boolean(token && restaurantId && enabled);
  const initialLoading = loading && !hasLoadedOnce.current;
  const refreshing = loading && hasLoadedOnce.current;

  const reload = useCallback(async () => {
    if (!hookEnabled || !token || !restaurantId) return;
    setLoading(true);
    setError(null);
    // Full list from backend (SSOT total); UI paginates after merging preview rows.
    const res = await listRestaurantMenus(token, restaurantId, status);
    setLoading(false);
    hasLoadedOnce.current = true;
    if (!res.ok || !res.menus) {
      setError(res.message ?? res.error ?? "Failed to load menus");
      if (!menus.length) {
        setMenus([]);
        setPagination(null);
      }
      return;
    }
    setMenus(res.menus);
    setPagination(
      res.pagination ?? {
        page: 1,
        pageSize: Math.max(res.menus.length, 1),
        total: res.menus.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      }
    );
  }, [hookEnabled, token, restaurantId, status]);

  useEffect(() => {
    hasLoadedOnce.current = false;
    setMenus([]);
    setPagination(null);
  }, [token, restaurantId, status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    menus,
    pagination,
    backendTotal: pagination?.total ?? menus.length,
    meta: { enabled: hookEnabled, initialLoading, refreshing, error, status },
    refresh: reload,
    upsertMenu: (menu: MenuSurfaceRow) => {
      setMenus((prev) => {
        const idx = prev.findIndex((m) => m.id === menu.id);
        const next =
          idx === -1
            ? [...prev, menu].sort((a, b) => a.sortOrder - b.sortOrder)
            : prev.map((m, i) => (i === idx ? menu : m));
        setPagination((p) => {
          const total = next.length;
          const pageSize = p?.pageSize ?? Math.max(total, 1);
          const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
          return {
            page: Math.min(p?.page ?? 1, totalPages),
            pageSize,
            total,
            totalPages,
            hasNextPage: (p?.page ?? 1) < totalPages,
            hasPrevPage: (p?.page ?? 1) > 1
          };
        });
        return next;
      });
    }
  };
}
