import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { QrCodeRow } from "../../../api";

const COLS = 5;
const ROWS_COLLAPSED = 2;
/** Visible chip slots when collapsed (last slot reserved for ··· when needed). */
const COLLAPSED_CHIP_SLOTS = COLS * ROWS_COLLAPSED - 1; // 9
export const QR_SCOPE_VISIBLE_COUNT = COLS * ROWS_COLLAPSED; // 10 cells

function scopeTone(status: QrCodeRow["status"]) {
  if (status === "ACTIVE") return "live";
  if (status === "INACTIVE") return "draft";
  return "retired";
}

function ScopeChip({ qr }: { qr: QrCodeRow }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [qr.name]);

  return (
    <li className="admin-qr-scope-cell">
      <span
        className={`admin-menu-manage-scope-chip admin-qr-scope-chip admin-menu-manage-scope-chip--${scopeTone(qr.status)}`}
        title={`${qr.name} — ${qr.status}`}
      >
        <span
          ref={textRef}
          className={`admin-qr-scope-chip-text${overflows ? " is-overflowing" : ""}`}
        >
          {qr.name}
        </span>
      </span>
    </li>
  );
}

type Props = {
  items: QrCodeRow[];
};

/**
 * In-scope QR chips: 5 per row, 2 rows collapsed.
 * When more than 10, the last cell is ··· (hover: View more) — click expands downward.
 * Long names ellipsize; hovering an overflowing chip scrolls the label inside the cell.
 */
export function QrInScopeGrid({ items }: Props) {
  const [expanded, setExpanded] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const [collapsedMax, setCollapsedMax] = useState<number | undefined>(undefined);
  const itemsKey = items.map((i) => i.id).join(",");

  const hasOverflow = items.length > QR_SCOPE_VISIBLE_COUNT;
  const showMoreControl = hasOverflow && !expanded;
  const visibleItems =
    expanded || !hasOverflow
      ? items
      : items.slice(0, COLLAPSED_CHIP_SLOTS);

  const hiddenCount = Math.max(0, items.length - COLLAPSED_CHIP_SLOTS);

  useEffect(() => {
    setExpanded(false);
  }, [itemsKey]);

  useLayoutEffect(() => {
    const list = measureRef.current;
    if (!list) return;
    // Measure height of exactly two rows from the grid gap/row sizes.
    const first = list.querySelector(".admin-qr-scope-cell") as HTMLElement | null;
    if (!first) {
      setCollapsedMax(undefined);
      return;
    }
    const styles = getComputedStyle(list);
    const gap = parseFloat(styles.rowGap || styles.gap || "0") || 0;
    const rowH = first.getBoundingClientRect().height;
    setCollapsedMax(rowH * ROWS_COLLAPSED + gap * (ROWS_COLLAPSED - 1));
  }, [itemsKey, expanded, visibleItems.length]);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    if (!expanded) {
      if (collapsedMax != null) vp.style.maxHeight = `${collapsedMax}px`;
      return;
    }
    const full = measureRef.current?.scrollHeight ?? vp.scrollHeight;
    // Force reflow so transition runs from collapsed → full.
    void vp.offsetHeight;
    vp.style.maxHeight = `${full}px`;
  }, [expanded, collapsedMax, visibleItems.length, showMoreControl]);

  return (
    <div className="admin-qr-scope">
      <div
        ref={viewportRef}
        className={`admin-qr-scope-viewport${expanded ? " is-expanded" : ""}`}
      >
        <ul ref={measureRef} className="admin-qr-scope-grid" aria-label="QR codes in scope">
          {visibleItems.map((q) => (
            <ScopeChip key={q.id} qr={q} />
          ))}
          {showMoreControl ? (
            <li className="admin-qr-scope-cell admin-qr-scope-cell--more">
              <button
                type="button"
                className="admin-qr-scope-more"
                title="View more"
                aria-label={`View more (${hiddenCount} more)`}
                onClick={() => setExpanded(true)}
              >
                <span className="admin-qr-scope-more-dots" aria-hidden>
                  ···
                </span>
                <span className="admin-qr-scope-more-hint">View more</span>
              </button>
            </li>
          ) : null}
        </ul>
      </div>

      {hasOverflow && expanded ? (
        <button type="button" className="admin-qr-scope-collapse" onClick={() => setExpanded(false)}>
          Show less
        </button>
      ) : null}
    </div>
  );
}
