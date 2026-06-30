import { useEffect, useState } from "react";
import type { MenuSurfaceRow } from "../../../api";
import {
  createOrderingSession,
  duplicateRestaurantMenu,
  archiveRestaurantMenu,
  getOrderingSessionQr,
  scheduleRestaurantMenu
} from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalShell
} from "../../profile/ProfileModalShell";

type BaseProps = {
  open: boolean;
  menu: MenuSurfaceRow | null;
  venueName: string;
  token: string;
  restaurantId: string;
  onClose: () => void;
};

export function ArchiveMenuConfirmModal({
  open,
  menu,
  venueName,
  token,
  restaurantId,
  onClose,
  onArchived
}: BaseProps & { onArchived: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!menu) return;
    setBusy(true);
    setError(null);
    const res = await archiveRestaurantMenu(token, restaurantId, menu.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Could not archive menu");
      return;
    }
    onArchived();
    onClose();
  };

  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Archive menu?"
      description={`“${menu?.name ?? "This menu"}” will be hidden from guests and removed from the active menu list at ${venueName}.`}
      titleId="archive-menu-title"
      stackLevel="overlay"
    >
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Archiving…" : "Archive menu"}
        busy={busy}
        confirmDisabled={!menu}
        danger
      />
    </ProfileModalShell>
  );
}

export function DuplicateMenuConfirmModal({
  open,
  menu,
  token,
  restaurantId,
  onClose,
  onDuplicated
}: Omit<BaseProps, "venueName"> & { onDuplicated: (menu: MenuSurfaceRow) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!menu) return;
    setBusy(true);
    setError(null);
    const res = await duplicateRestaurantMenu(token, restaurantId, menu.id);
    setBusy(false);
    if (!res.ok || !res.menu) {
      setError(res.message ?? res.error ?? "Could not duplicate menu");
      return;
    }
    onDuplicated(res.menu);
    onClose();
  };

  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Duplicate menu?"
      description={`Create a draft copy of “${menu?.name ?? "this menu"}” including categories, items, and modifiers.`}
      titleId="duplicate-menu-title"
      stackLevel="overlay"
    >
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Duplicating…" : "Duplicate"}
        busy={busy}
        confirmDisabled={!menu}
      />
    </ProfileModalShell>
  );
}

export function ScheduleMenuModal({
  open,
  menu,
  token,
  restaurantId,
  onClose,
  onScheduled
}: Omit<BaseProps, "venueName"> & { onScheduled: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");

  useEffect(() => {
    if (!open) return;
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setDate(d.toISOString().slice(0, 10));
    setTime("12:00");
    setError(null);
  }, [open, menu?.id]);

  const confirm = async () => {
    if (!menu) return;
    setBusy(true);
    setError(null);
    const scheduledPublishAt = date ? new Date(`${date}T${time}:00`).toISOString() : null;
    const res = await scheduleRestaurantMenu(token, restaurantId, menu.id, { scheduledPublishAt });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Could not save schedule");
      return;
    }
    onScheduled();
    onClose();
  };

  const clearSchedule = async () => {
    if (!menu) return;
    setBusy(true);
    const res = await scheduleRestaurantMenu(token, restaurantId, menu.id, { scheduledPublishAt: null });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Could not clear schedule");
      return;
    }
    onScheduled();
    onClose();
  };

  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Schedule publish"
      description={`Choose when “${menu?.name ?? "this menu"}” should go live automatically.`}
      titleId="schedule-menu-title"
      stackLevel="overlay"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">Date</span>
          <AdminInput className="mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </AdminLabel>
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">Time</span>
          <AdminInput className="mt-1" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </AdminLabel>
      </div>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <AdminBtnSecondary type="button" className="mt-4" disabled={busy} onClick={() => void clearSchedule()}>
        Clear schedule
      </AdminBtnSecondary>
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Saving…" : "Save schedule"}
        busy={busy}
        confirmDisabled={!menu || !date}
      />
    </ProfileModalShell>
  );
}

export function MenuQrGeneratorModal({
  open,
  token,
  restaurantId,
  onClose
}: {
  open: boolean;
  token: string;
  restaurantId: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState("");
  const [menuUrl, setMenuUrl] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [pngDownloadUrl, setPngDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMenuUrl(null);
      setQrImageUrl(null);
      setPngDownloadUrl(null);
      setError(null);
      setTableLabel("");
    }
  }, [open]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    const created = await createOrderingSession(token, restaurantId, {
      tableLabel: tableLabel.trim() || undefined,
      paymentMode: "PAY_AT_VENUE"
    });
    if (!created.ok || !created.session) {
      setBusy(false);
      setError(created.message ?? created.error ?? "Could not create session");
      return;
    }
    const qr = await getOrderingSessionQr(token, restaurantId, created.session.id);
    setBusy(false);
    if (!qr.ok) {
      setError(qr.message ?? qr.error ?? "Could not load QR");
      return;
    }
    setMenuUrl(qr.menuUrl ?? created.session.menuUrl);
    setQrImageUrl(qr.qrImageUrl ?? null);
    setPngDownloadUrl(qr.pngDownloadUrl ?? null);
  };

  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="QR menu generator"
      description="Create a guest ordering link and download a printable QR code."
      titleId="menu-qr-title"
      stackLevel="overlay"
    >
      <AdminLabel>
        <span className="text-xs admin-config-text-muted">Table label (optional)</span>
        <AdminInput
          className="mt-1"
          placeholder="e.g. Table 12"
          value={tableLabel}
          onChange={(e) => setTableLabel(e.target.value)}
        />
      </AdminLabel>

      {menuUrl ? (
        <div className="admin-menu-qr-preview mt-4 rounded-xl border p-4 text-center">
          {qrImageUrl ? (
            <img src={qrImageUrl} alt="Ordering QR code" className="mx-auto h-48 w-48 rounded-lg border bg-white p-2" />
          ) : null}
          <p className="admin-config-text-subtle mt-3 break-all text-xs">{menuUrl}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {pngDownloadUrl ? (
              <a className="admin-btn-secondary inline-flex" href={pngDownloadUrl} download="serveos-menu-qr.png" target="_blank" rel="noreferrer">
                Download PNG
              </a>
            ) : null}
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => void navigator.clipboard.writeText(menuUrl)}
            >
              Copy link
            </button>
          </div>
        </div>
      ) : null}

      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void generate()}
        confirmLabel={busy ? "Generating…" : menuUrl ? "Generate new QR" : "Generate QR"}
        cancelLabel="Close"
        busy={busy}
      />
    </ProfileModalShell>
  );
}
