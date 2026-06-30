import { useCallback, useEffect, useRef, useState } from "react";
import { listRestaurantMenus, type MenuSurfaceRow } from "../../api";

export function useAdminMenus(token: string | null, restaurantId: string | null) {
  const [menus, setMenus] = useState<MenuSurfaceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const enabled = Boolean(token && restaurantId);
  const initialLoading = loading && !hasLoadedOnce.current;
  const refreshing = loading && hasLoadedOnce.current;

  const reload = useCallback(async () => {
    if (!enabled || !token || !restaurantId) return;
    setLoading(true);
    setError(null);
    const res = await listRestaurantMenus(token, restaurantId);
    setLoading(false);
    hasLoadedOnce.current = true;
    if (!res.ok || !res.menus) {
      setError(res.message ?? res.error ?? "Failed to load menus");
      if (!menus.length) setMenus([]);
      return;
    }
    setMenus(res.menus);
  }, [enabled, token, restaurantId]);

  useEffect(() => {
    hasLoadedOnce.current = false;
    setMenus([]);
  }, [token, restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    menus,
    meta: { enabled, initialLoading, refreshing, error },
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
