import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { QrCodeRow, QrCodeType, QrPaymentMode } from "../../../api";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "../menu/menuPageModalShell";

const TYPE_LABEL: Record<QrCodeType, string> = {
  TABLE: "Table",
  MENU: "Menu",
  TAKEAWAY: "Takeaway",
  STAFF: "Staff",
  MARKETING: "Marketing",
  FEEDBACK: "Feedback"
};

const PAYMENT_LABEL: Record<QrPaymentMode, string> = {
  PAY_AT_VENUE: "Pay at venue",
  PREPAY: "Pay online",
  HYBRID: "Both"
};

function statusLabel(status: QrCodeRow["status"]) {
  if (status === "ACTIVE") return "Active";
  if (status === "INACTIVE") return "Inactive";
  if (status === "ARCHIVED") return "Archived";
  return "Rotated";
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="break-all text-sm text-slate-800">{value}</dd>
    </div>
  );
}

type Props = {
  open: boolean;
  qr: QrCodeRow | null;
  venueName?: string;
  onClose: () => void;
  onOpenManage?: () => void;
};

/** Read-only QR details — same drawer shell / motion as QrManageDrawer. */
export function QrDetailsModal({ open, qr, venueName = "", onClose, onOpenManage }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useModalScrollLock(mounted);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open && qr) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
    }, 520);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, qr]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!mounted || !qr) return null;

  const locationBits = [qr.locationLabel, qr.areaLabel, qr.tableLabel].filter(Boolean);

  return createPortal(
    <div
      className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
      role="presentation"
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
        aria-label="Close QR details"
        tabIndex={visible ? 0 : -1}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="QR details"
        className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
      >
        <header className="admin-staff-profile-header">
          <div className="min-w-0 flex-1">
            <h3 className="admin-staff-profile-title">QR details</h3>
            <p className="admin-staff-profile-sub">
              {qr.name}
              {venueName ? ` at ${venueName}` : ""}
            </p>
          </div>
          <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="admin-staff-profile-body admin-menu-item-profile-body admin-menu-manage-body">
          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title">Identity</h4>
            <div className="mb-4 flex justify-center">
              <img
                src={qr.qrImageUrl}
                alt={`QR for ${qr.name}`}
                className="h-40 w-40 rounded-xl border border-slate-200 bg-white object-contain p-2 shadow-sm"
              />
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="Name" value={qr.name} />
              <DetailRow label="Type" value={TYPE_LABEL[qr.type]} />
              <DetailRow label="Status" value={statusLabel(qr.status)} />
              <DetailRow label="Public code" value={qr.publicCode} />
              <DetailRow label="Public URL" value={qr.publicUrl} />
              <DetailRow label="Payment" value={PAYMENT_LABEL[qr.paymentMode]} />
              <DetailRow label="Location" value={locationBits.length ? locationBits.join(" · ") : "—"} />
              <DetailRow label="Menu" value={qr.menuName ?? "Auto / none"} />
              <DetailRow label="Ordering" value={qr.allowOrdering ? (qr.orderingPaused ? "Paused" : "Enabled") : "Disabled"} />
              <DetailRow label="Scans" value={String(qr.scanCount)} />
              <DetailRow label="Orders" value={String(qr.orderCount)} />
              <DetailRow label="Created" value={formatWhen(qr.createdAt)} />
              <DetailRow label="Last used" value={formatWhen(qr.lastUsedAt)} />
            </dl>
          </section>

          {qr.description ? (
            <section className="admin-staff-drawer-section">
              <h4 className="admin-staff-drawer-section-title">Notes</h4>
              <p className="text-sm text-slate-700">{qr.description}</p>
            </section>
          ) : null}

          {onOpenManage ? (
            <section className="admin-staff-drawer-section">
              <button
                type="button"
                className="admin-menu-manage-action w-full"
                onClick={() => {
                  onClose();
                  onOpenManage();
                }}
              >
                <span className="admin-menu-manage-action-label">Open in QR Manager</span>
                <span className="admin-menu-manage-action-desc">Edit destination, ordering, and print</span>
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
