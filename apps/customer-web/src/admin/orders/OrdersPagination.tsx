import { AdminBubbleDropdown } from "../AdminBubbleDropdown";
import { AdminBtnSecondary } from "../AdminUi";

const PAGE_SIZE_OPTIONS = [
  { value: "8", label: "8" },
  { value: "10", label: "10" },
  { value: "15", label: "15" },
  { value: "25", label: "25" }
];

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

export function OrdersPagination({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="admin-orders-pagination">
      <p className="admin-orders-pagination-summary">
        {total === 0 ? "No orders" : `Showing ${start}–${end} of ${total}`}
      </p>
      <div className="admin-orders-pagination-controls">
        {onPageSizeChange ? (
          <div className="admin-orders-pagination-size">
            <AdminBubbleDropdown
              label="Per page"
              value={String(pageSize)}
              options={PAGE_SIZE_OPTIONS}
              onChange={(v) => onPageSizeChange(Number(v))}
              className="admin-orders-pagination-dropdown"
            />
          </div>
        ) : null}
        <div className="admin-orders-pagination-buttons">
          <AdminBtnSecondary disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
            Previous
          </AdminBtnSecondary>
          <span className="admin-orders-pagination-page">
            Page {safePage} of {totalPages}
          </span>
          <AdminBtnSecondary disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
            Next
          </AdminBtnSecondary>
        </div>
      </div>
    </div>
  );
}

export const DEFAULT_ORDERS_PAGE_SIZE = 10;

export function paginateSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
