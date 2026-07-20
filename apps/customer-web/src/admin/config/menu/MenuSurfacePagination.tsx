import type { ReactNode } from "react";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label?: string;
  /** Compact controls for dense drawers (e.g. manage In scope). */
  size?: "default" | "compact";
  /** Hide the “Showing X–Y of Z” line. */
  hideMeta?: boolean;
};

function pageWindow(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1, page - 2, page + 2]);
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

export function MenuSurfacePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  label = "List pagination",
  size = "default",
  hideMeta = false
}: Props) {
  if (totalItems < pageSize) return null;

  const pills = pageWindow(page, totalPages);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const compact = size === "compact";

  const nodes: ReactNode[] = [];
  for (let i = 0; i < pills.length; i += 1) {
    const p = pills[i]!;
    const prev = pills[i - 1];
    if (prev != null && p - prev > 1) {
      nodes.push(
        <span key={`gap-${prev}-${p}`} className="admin-menu-pager-ellipsis" aria-hidden>
          …
        </span>
      );
    }
    nodes.push(
      <button
        key={p}
        type="button"
        className={`admin-menu-pager-pill${p === page ? " is-active" : ""}`}
        aria-label={`Page ${p}`}
        aria-current={p === page ? "page" : undefined}
        onClick={() => onPageChange(p)}
      >
        {p}
      </button>
    );
  }

  return (
    <nav
      className={`admin-menu-pager${compact ? " admin-menu-pager--compact" : ""}`}
      aria-label={label}
    >
      {hideMeta ? null : (
        <p className="admin-menu-pager-meta">
          Showing <strong>{from}–{to}</strong> of <strong>{totalItems}</strong>
        </p>
      )}
      <div className="admin-menu-pager-controls">
        <button
          type="button"
          className="admin-menu-pager-chevron"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden className="admin-menu-pager-chevron-icon">
            <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="admin-menu-pager-pills">{nodes}</div>
        <button
          type="button"
          className="admin-menu-pager-chevron"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden className="admin-menu-pager-chevron-icon">
            <path d="M7.5 4.5L13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
