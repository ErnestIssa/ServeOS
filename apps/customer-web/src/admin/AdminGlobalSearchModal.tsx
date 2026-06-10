import { useEffect, useMemo, useRef, useState } from "react";
import { SignupModalShell } from "../signup/SignupModalShell";
import { filterAdminSearch, type AdminSearchEntry } from "./adminSearchIndex";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantName: string;
  ownerName: string;
};

function SearchResultCard({
  item,
  active,
  onSelect
}: {
  item: AdminSearchEntry;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`admin-search-result-card group ${active ? "admin-search-result-card--active" : ""}`}
      onClick={onSelect}
    >
      <span className="admin-search-result-category">{item.category}</span>
      <span className="admin-search-result-title">{item.title}</span>
      <span className="admin-search-result-subtitle">{item.subtitle}</span>
    </button>
  );
}

export function AdminGlobalSearchModal({ open, onClose, restaurantName, ownerName }: Props) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => filterAdminSearch(query), [query]);
  const isSuggested = !query.trim();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveId(null);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [open]);

  function navigate(href: string, id: string) {
    setActiveId(id);
    onClose();
    window.setTimeout(() => {
      window.location.hash = href;
      window.scrollTo({ top: 0, behavior: "auto" });
    }, 80);
  }

  const venue = restaurantName || "your venue";
  const first = ownerName.split(/\s+/)[0] || ownerName;

  return (
    <SignupModalShell
      open={open}
      onClose={onClose}
      labelledBy="admin-search-title"
      backdropLabel="Close workspace search"
      shellClassName="admin-search-modal-shell fixed inset-0 z-[110] flex items-center justify-center overflow-hidden p-4 sm:p-6"
      panelClassName="admin-search-modal-panel relative z-[1] flex w-full max-w-[min(94vw,52rem)] flex-col overflow-hidden rounded-[1.5rem] border shadow-[0_32px_100px_rgba(15,23,42,0.32)] backdrop-blur-xl"
    >
      <div className="admin-search-modal-header shrink-0 border-b px-5 py-5 sm:px-7 sm:py-6">
        <p id="admin-search-title" className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600/90">
          Workspace search
        </p>
        <p className="mt-2 text-center font-display text-xl font-bold sm:text-2xl">
          {first}, what are you looking for at {venue}?
        </p>
        <label className="admin-global-search admin-global-search--modal group relative mx-auto mt-5 block w-full max-w-2xl">
          <span className="sr-only">Search workspace</span>
          <img
            src="/icons/magnifying-glass.png"
            alt=""
            className="admin-search-icon pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Orders, tables, menu, staff, billing, settings…"
            className="admin-search-input admin-search-input--modal relative z-[2] w-full rounded-2xl py-3.5 pl-11 pr-4 text-sm outline-none transition sm:py-4 sm:text-base"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="admin-search-modal-body flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-5 sm:px-7 sm:py-6" role="region" aria-label="Search results">
        <p className="admin-search-modal-kicker shrink-0 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600/80">
          {isSuggested ? "Suggested for you" : "Results"}
        </p>

        {results.length === 0 ? (
          <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-[var(--admin-text-muted)]">
            No matches — try orders, reservations, menu, or billing.
          </p>
        ) : (
          <div className="admin-search-modal-grid mt-4 min-h-0 flex-1 overflow-hidden">
            {results.map((item) => (
              <SearchResultCard
                key={item.id}
                item={item}
                active={activeId === item.id}
                onSelect={() => navigate(item.href, item.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="admin-search-modal-footer flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5 text-xs sm:px-7">
        <span className="text-[var(--admin-text-muted)]">
          {results.length} {isSuggested ? "suggestion" : "result"}
          {results.length === 1 ? "" : "s"}
        </span>
        <button type="button" className="admin-page-link-btn font-semibold" onClick={onClose}>
          Close
        </button>
      </div>
    </SignupModalShell>
  );
}
