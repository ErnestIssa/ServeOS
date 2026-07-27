import type { QrCodeRow, QrCodeType, QrPaymentMode } from "../../../api";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";

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
  onClose: () => void;
};

export function QrDetailsModal({ open, qr, onClose }: Props) {
  if (!qr) return null;

  const locationBits = [qr.locationLabel, qr.areaLabel, qr.tableLabel].filter(Boolean);

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title={qr.name}
      description={`${TYPE_LABEL[qr.type]} · /q/${qr.publicCode}`}
      titleId="qr-details-title"
      maxWidthClass="max-w-lg"
      stackLevel="overlay"
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <DetailRow label="Name" value={qr.name} />
        <DetailRow label="Type" value={TYPE_LABEL[qr.type]} />
        <DetailRow label="Status" value={statusLabel(qr.status)} />
        <DetailRow label="Public code" value={qr.publicCode} />
        <DetailRow label="Public URL" value={qr.publicUrl} />
        <DetailRow label="QR image" value={qr.qrImageUrl} />
        <DetailRow label="Scans" value={String(qr.scanCount)} />
        <DetailRow label="Orders" value={String(qr.orderCount)} />
        <DetailRow label="Location" value={locationBits.length ? locationBits.join(" · ") : "—"} />
        <DetailRow label="Payment" value={PAYMENT_LABEL[qr.paymentMode]} />
        <DetailRow label="Ordering paused" value={qr.orderingPaused ? "Yes" : "No"} />
      </dl>

      <ProfileModalFooter onCancel={onClose} confirmLabel="Close" onConfirm={onClose} />
    </MenuPageModalShell>
  );
}
