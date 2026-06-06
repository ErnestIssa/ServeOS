import { useEffect, useMemo, useRef, useState } from "react";
import {
  filterMarketingSearch,
  groupMarketingSearchByCategory,
  type MarketingSearchEntry
} from "./marketingSearchIndex";
import { runNavAction, type NavHandlers } from "./navActions";

type Props = {
  darkSurface: boolean;
  onClose: () => void;
  handlers: NavHandlers;
  query: string;
  onContentHeight: (height: number) => void;
  maxPanelHeightPx?: number;
};

const COLUMN_HEADER_PX = 36;
const PAGINATION_BAR_PX = 52;
const PANEL_PADDING_PX = 48;
const CARD_SLOT_PX = 108;

function itemsPerColumnPage(maxPanelHeightPx: number): number {
  if (maxPanelHeightPx <= 0) return 3;
  const reserved = COLUMN_HEADER_PX + PAGINATION_BAR_PX + PANEL_PADDING_PX;
  return Math.max(2, Math.min(6, Math.floor((maxPanelHeightPx - reserved) / CARD_SLOT_PX)));
}

function SearchResultCard({
  item,
  darkSurface,
  onSelect
}: {
  item: MarketingSearchEntry;
  darkSurface: boolean;
  onSelect: () => void;
}) {
  const cardBase = darkSurface
    ? "border-white/12 bg-white/[0.06] hover:border-violet-400/35 hover:bg-white/[0.1] hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
    : "border-slate-200/90 bg-white/90 hover:border-violet-300/80 hover:bg-white hover:shadow-[0_10px_32px_rgba(124,58,237,0.12)]";
  const titleClass = darkSurface ? "text-white group-hover:text-violet-200" : "text-slate-900 group-hover:text-violet-700";
  const subtitleClass = darkSurface ? "text-slate-400" : "text-slate-500";

  return (
    <button
      type="button"
      className={`group flex w-full flex-col rounded-2xl border p-3.5 text-left transition duration-300 ${cardBase}`}
      onClick={onSelect}
    >
      <span className={`text-sm font-semibold leading-snug transition ${titleClass}`}>{item.title}</span>
      <span className={`mt-1.5 text-xs leading-relaxed ${subtitleClass}`}>{item.subtitle}</span>
    </button>
  );
}

export function MarketingSearchPanel({
  darkSurface,
  onClose,
  handlers,
  query,
  onContentHeight,
  maxPanelHeightPx = 0
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const results = useMemo(() => filterMarketingSearch(query), [query]);
  const groups = useMemo(() => groupMarketingSearchByCategory(results), [results]);
  const perPage = useMemo(() => itemsPerColumnPage(maxPanelHeightPx), [maxPanelHeightPx]);

  const maxPages = useMemo(() => {
    if (groups.length === 0) return 1;
    return Math.max(1, ...groups.map((g) => Math.ceil(g.items.length / perPage)));
  }, [groups, perPage]);

  const pagedGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.slice(page * perPage, page * perPage + perPage)
        }))
        .filter((group) => group.items.length > 0),
    [groups, page, perPage]
  );

  useEffect(() => {
    setPage(0);
  }, [query]);

  useEffect(() => {
    if (page > maxPages - 1) setPage(Math.max(0, maxPages - 1));
  }, [page, maxPages]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const report = () => onContentHeight(el.scrollHeight);

    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pagedGroups, query, page, maxPages, onContentHeight]);

  const categoryTitleClass = darkSurface ? "text-violet-300/90" : "text-violet-700/80";
  const subtitleClass = darkSurface ? "text-slate-400" : "text-slate-500";
  const paginationBtn = darkSurface
    ? "border-white/15 bg-white/5 text-slate-200 hover:border-violet-400/40 hover:bg-white/10 disabled:opacity-35"
    : "border-slate-200/90 bg-white/80 text-slate-700 hover:border-violet-300/70 hover:bg-white disabled:opacity-40";

  return (
    <div
      ref={contentRef}
      className="flex w-full flex-col px-3 py-4 sm:px-5 md:px-6 md:py-5"
      role="region"
      aria-label="Search results"
    >
      {results.length === 0 ? (
        <p className={`py-10 text-center text-sm ${subtitleClass}`}>
          No matches — try integrations, KDS, reservations, or pricing.
        </p>
      ) : (
        <>
          <div className="flex gap-5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pagedGroups.map((group) => (
              <div key={group.category} className="flex w-52 shrink-0 flex-col sm:w-56">
                <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${categoryTitleClass}`}>
                  {group.category}
                </p>
                <div className="mt-3 flex flex-col gap-2.5">
                  {group.items.map((item) => (
                    <SearchResultCard
                      key={item.id}
                      item={item}
                      darkSurface={darkSurface}
                      onSelect={() => {
                        runNavAction(item.action, handlers);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {maxPages > 1 ? (
            <div
              className={`mt-4 flex items-center justify-center gap-3 border-t pt-4 ${
                darkSurface ? "border-white/10" : "border-slate-200/80"
              }`}
            >
              <button
                type="button"
                aria-label="Previous page"
                disabled={page === 0}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${paginationBtn}`}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <span className={`text-xs font-semibold tabular-nums ${subtitleClass}`}>
                {page + 1} / {maxPages}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= maxPages - 1}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${paginationBtn}`}
                onClick={() => setPage((p) => Math.min(maxPages - 1, p + 1))}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function useMarketingSearchQuery() {
  const [query, setQuery] = useState("");

  const reset = () => setQuery("");

  return { query, setQuery, reset };
}
