import { useCallback, useEffect, useRef, useState } from "react";
import { listRestaurantMenus, type MenuListStatusFilter, type MenuSurfaceRow } from "../../api";

export function useAdminMenus(
  token: string | null,
  restaurantId: string | null,
  status: MenuListStatusFilter = "active",
  enabled = true
) {
  const [menus, setMenus] = useState<MenuSurfaceRow[]>([]);
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
    const res = await listRestaurantMenus(token, restaurantId, status);
    setLoading(false);
    hasLoadedOnce.current = true;
    if (!res.ok || !res.menus) {
      setError(res.message ?? res.error ?? "Failed to load menus");
      if (!menus.length) setMenus([]);
      return;
    }
    setMenus(res.menus);
  }, [hookEnabled, token, restaurantId, status]);

  useEffect(() => {
    hasLoadedOnce.current = false;
    setMenus([]);
  }, [token, restaurantId, status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    menus,
    meta: { enabled: hookEnabled, initialLoading, refreshing, error, status },
    refresh: reload,
    upsertMenu: (menu: MenuSurfaceRow) => {
      setMenus((prev) => {
        const idx = prev.findIndex((m) => m.id === menu.id);
        if (idx === -1) return [...prev, menu].sort((a, b) => a.sortOrder - b.sortOrder);
        const next = [...prev];
        next[idx] = menu;
        return next;
      });
    }
  };
}
