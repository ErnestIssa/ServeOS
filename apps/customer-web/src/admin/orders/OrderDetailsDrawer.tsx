import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AdminBtnPrimary, AdminBtnSecondary } from "../AdminUi";
import {
  formatCurrency,
  formatDateTime,
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  type AdminOrder
} from "./ordersTypes";
import { OrderEngineActionsPanel } from "./OrderEngineActionsPanel";
import type { AdminOrderVm } from "./ordersApiMappers";

type Props = {
  order: (AdminOrder & { version?: number }) | null;
  open: boolean;
  onClose: () => void;
  onUpdateStatus?: () => void;
  onPrintReceipt?: () => void;
  token?: string | null;
  restaurantId?: string | null;
  onOrderRefresh?: () => void;
  onToast?: (msg: string, tone?: "success" | "error") => void;
};

function StatusBadge({ status }: { status: AdminOrder["status"] }) {
  const tone =
    status === "COMPLETED"
      ? "completed"
      : status === "CANCELLED" || status === "REFUNDED"
        ? "muted"
        : status === "PREPARING" || status === "READY"
          ? "active"
          : status === "REFUND_REQUESTED" || status === "DISPUTED" || status === "PAYMENT_FAILED"
            ? "danger"
            : "default";
  return <span className={`admin-orders-status admin-orders-status--${tone}`}>{ORDER_STATUS_LABELS[status]}</span>;
}

export function OrderDetailsDrawer({
  order,
  open,
  onClose,
  onUpdateStatus,
  onPrintReceipt,
  token,
  restaurantId,
  onOrderRefresh,
  onToast
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`admin-orders-drawer-shell ${open ? "admin-orders-drawer-shell--open" : ""}`}
      aria-hidden={!open}
    >
      <button type="button" className="admin-orders-drawer-backdrop" aria-label="Close order details" onClick={onClose} />
      <aside
        className={`admin-orders-drawer-panel ${open ? "admin-orders-drawer-panel--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-drawer-title"
      >
        {order ? (
          <>
            <header className="admin-orders-drawer-header">
              <div className="min-w-0">
                <p className="admin-orders-drawer-eyebrow">Order details</p>
                <h2 id="order-drawer-title" className="admin-orders-drawer-title">
                  {order.displayNumber}
                </h2>
                <p className="admin-orders-drawer-sub">
                  {ORDER_SOURCE_LABELS[order.source]}
                  {order.tableNumber ? ` · Table ${order.tableNumber}` : ""}
                </p>
              </div>
              <button type="button" className="admin-orders-drawer-close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </header>

            <div className="admin-orders-drawer-body">
              <section className="admin-orders-drawer-section">
                <div className="admin-orders-drawer-row">
                  <StatusBadge status={order.status} />
                  <span className="admin-orders-drawer-total">{formatCurrency(order.total)}</span>
                </div>
                {order.problemReason ? (
                  <p className="admin-orders-drawer-alert">{order.problemReason}</p>
                ) : null}
              </section>

              <section className="admin-orders-drawer-section">
                <h3 className="admin-orders-drawer-section-title">Customer</h3>
                <p className="admin-orders-drawer-text">{order.customerName}</p>
                {order.customerPhone ? <p className="admin-orders-drawer-muted">{order.customerPhone}</p> : null}
                {order.customerEmail ? <p className="admin-orders-drawer-muted">{order.customerEmail}</p> : null}
              </section>

              <section className="admin-orders-drawer-section">
                <h3 className="admin-orders-drawer-section-title">Items</h3>
                <ul className="admin-orders-items-list">
                  {order.items.map((item) => (
                    <li key={item.id} className="admin-orders-item-row">
                      <div className="min-w-0 flex-1">
                        <p className="admin-orders-drawer-text">
                          {item.qty}× {item.name}
                        </p>
                        {item.modifiers?.length ? (
                          <p className="admin-orders-drawer-muted">{item.modifiers.join(", ")}</p>
                        ) : null}
                        {item.notes ? <p className="admin-orders-drawer-note">{item.notes}</p> : null}
                      </div>
                      <span className="admin-orders-drawer-muted">{formatCurrency(item.unitPrice * item.qty)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="admin-orders-drawer-section">
                <h3 className="admin-orders-drawer-section-title">Payment</h3>
                <div className="admin-orders-drawer-kv">
                  <span>Status</span>
                  <span>{order.paymentStatus}</span>
                  <span>Method</span>
                  <span>{order.paymentMethod ?? "—"}</span>
                  <span>Staff</span>
                  <span>{order.assignedStaff ?? "—"}</span>
                </div>
              </section>

              {order.refunds?.length ? (
                <section className="admin-orders-drawer-section">
                  <h3 className="admin-orders-drawer-section-title">Refunds</h3>
                  <ul className="admin-orders-refund-list">
                    {order.refunds.map((r, i) => (
                      <li key={i}>
                        <span>{formatCurrency(r.amount)}</span>
                        <span className="admin-orders-drawer-muted">{r.reason}</span>
                        <span className="admin-orders-drawer-muted">{formatDateTime(r.at)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {order.notes ? (
                <section className="admin-orders-drawer-section">
                  <h3 className="admin-orders-drawer-section-title">Notes</h3>
                  <p className="admin-orders-drawer-muted">{order.notes}</p>
                </section>
              ) : null}

              <section className="admin-orders-drawer-section">
                <h3 className="admin-orders-drawer-section-title">Timeline</h3>
                <ol className="admin-orders-timeline">
                  {order.timeline.map((ev, i) => (
                    <li key={i}>
                      <span className="admin-orders-timeline-time">{formatDateTime(ev.at)}</span>
                      <span className="admin-orders-timeline-label">{ev.label}</span>
                      {ev.actor ? <span className="admin-orders-timeline-actor">{ev.actor}</span> : null}
                    </li>
                  ))}
                </ol>
              </section>

              {order.auditLog?.length ? (
                <section className="admin-orders-drawer-section">
                  <h3 className="admin-orders-drawer-section-title">Audit log</h3>
                  <ul className="admin-orders-audit-list">
                    {order.auditLog.map((entry, i) => (
                      <li key={i}>
                        <span className="admin-orders-drawer-muted">{formatDateTime(entry.at)}</span>
                        <span>{entry.action}</span>
                        <span className="admin-orders-drawer-muted">{entry.actor}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {token && order ? (
                <OrderEngineActionsPanel
                  token={token}
                  restaurantId={restaurantId ?? ""}
                  order={order as AdminOrderVm}
                  onUpdated={() => onOrderRefresh?.()}
                  onToast={(msg, tone) => onToast?.(msg, tone)}
                />
              ) : null}
            </div>

            <footer className="admin-orders-drawer-footer">
              <AdminBtnSecondary onClick={onClose}>Close</AdminBtnSecondary>
              <AdminBtnSecondary onClick={onPrintReceipt}>Print receipt</AdminBtnSecondary>
              <AdminBtnPrimary onClick={onUpdateStatus}>Update status</AdminBtnPrimary>
            </footer>
          </>
        ) : null}
      </aside>
    </div>,
    document.body
  );
}
