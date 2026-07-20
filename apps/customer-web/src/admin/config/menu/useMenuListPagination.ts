import { useEffect, useMemo, useState } from "react";

export const MENU_LIST_PAGE_SIZE = 15;

export type MenuListPageDirection = "next" | "prev" | "jump";

type Options = {
  pageSize?: number;
  /** Reset to page 1 when this changes (e.g. active tab or search query). */
  resetKey?: string | number;
};

export function useMenuListPagination<T>(items: readonly T[], options?: Options) {
  const pageSize = options?.pageSize ?? MENU_LIST_PAGE_SIZE;
  const resetKey = options?.resetKey ?? "";
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState<MenuListPageDirection>("jump");

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
    setDirection("jump");
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped === safePage) return;
    setDirection(clamped > safePage ? "next" : "prev");
    setPage(clamped);
  };

  return {
    page: safePage,
    totalPages,
    totalItems,
    pageSize,
    pagedItems,
    direction,
    goToPage,
    showPagination: totalItems >= pageSize,
    pageClassName: `admin-menu-list-page admin-menu-list-page--${direction}`,
    pageKey: `menu-list-page-${safePage}-${resetKey}`
  };
}
