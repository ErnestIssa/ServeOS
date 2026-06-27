import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMenuAdmin, type MenuTree } from "../../api";

export function useAdminMenu(token: string | null, restaurantId: string | null) {
  const [menu, setMenu] = useState<MenuTree | null>(null);
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
    const res = await getMenuAdmin(token, restaurantId);
    setLoading(false);
    hasLoadedOnce.current = true;
    if (!res.ok || !res.categories) {
      setError(res.error ?? "Failed to load menu");
      if (!menu) setMenu(null);
      return;
    }
    setMenu({
      restaurant: res.restaurant!,
      categories: res.categories
    });
  }, [enabled, token, restaurantId]);

  useEffect(() => {
    hasLoadedOnce.current = false;
    setMenu(null);
  }, [token, restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = useMemo(() => {
    const categories = menu?.categories ?? [];
    const items = categories.flatMap((c) => c.items);
    const modifierGroups = items.flatMap((i) => i.modifierGroups);
    const modifierOptions = modifierGroups.flatMap((g) => g.options);
    return {
      menus: 1,
      categories: categories.length,
      items: items.length,
      modifiers: modifierOptions.length,
      activeCategories: categories.filter((c) => c.isActive).length,
      activeItems: items.filter((i) => i.isActive).length
    };
  }, [menu]);

  const flatItems = useMemo(() => {
    const out: Array<{
      id: string;
      name: string;
      categoryName: string;
      categoryId: string;
      priceCents: number;
      isActive: boolean;
      modifierCount: number;
      description: string | null;
      sortOrder: number;
    }> = [];
    for (const cat of menu?.categories ?? []) {
      for (const item of cat.items) {
        out.push({
          id: item.id,
          name: item.name,
          categoryName: cat.name,
          categoryId: cat.id,
          priceCents: item.priceCents,
          isActive: item.isActive,
          modifierCount: item.modifierGroups.length,
          description: item.description,
          sortOrder: item.sortOrder
        });
      }
    }
    return out;
  }, [menu]);

  const flatModifiers = useMemo(() => {
    const out: Array<{
      id: string;
      name: string;
      itemName: string;
      groupName: string;
      priceDeltaCents: number;
      isActive: boolean;
    }> = [];
    for (const cat of menu?.categories ?? []) {
      for (const item of cat.items) {
        for (const group of item.modifierGroups) {
          for (const opt of group.options) {
            out.push({
              id: opt.id,
              name: opt.name,
              itemName: item.name,
              groupName: group.name,
              priceDeltaCents: opt.priceDeltaCents,
              isActive: opt.isActive
            });
          }
        }
      }
    }
    return out;
  }, [menu]);

  const flatModifierGroups = useMemo(() => {
    const out: Array<{
      id: string;
      name: string;
      itemName: string;
      itemId: string;
      minSelect: number;
      maxSelect: number;
      optionCount: number;
    }> = [];
    for (const cat of menu?.categories ?? []) {
      for (const item of cat.items) {
        for (const group of item.modifierGroups) {
          out.push({
            id: group.id,
            name: group.name,
            itemName: item.name,
            itemId: item.id,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            optionCount: group.options.length
          });
        }
      }
    }
    return out;
  }, [menu]);

  return {
    menu,
    stats,
    flatItems,
    flatModifiers,
    flatModifierGroups,
    meta: { enabled, initialLoading, refreshing, error },
    refresh: reload
  };
}
