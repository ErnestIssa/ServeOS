import { useEffect, useState } from "react";
import type { MenuSurfaceRow } from "../../../api";
import {
  archiveRestaurantMenu,
  duplicateRestaurantMenu,
  scheduleRestaurantMenu
} from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  MenuPageModalShell
} from "./menuPageModalShell";
import { MenuQrGeneratorContent } from "./MenuQrGeneratorContent";

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
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) {
      setTyped("");
      setError(null);
      return;
    }
    setTyped("");
    setError(null);
  }, [open, menu?.id]);

  useEffect(() => {
    if (!open) return;
    const clear = () => setTyped("");
    const onVisibility = () => {
      if (document.visibilityState === "hidden") clear();
    };
    window.addEventListener("blur", clear);
    window.addEventListener("pagehide", clear);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", clear);
      window.removeEventListener("pagehide", clear);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open]);

  const matches = Boolean(menu && typed === menu.name);

  const confirm = async () => {
    if (!menu || !matches) return;
    setBusy(true);
    setError(null);
    const res = await archiveRestaurantMenu(token, restaurantId, menu.id, menu.name);
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Could not archive menu");
      return;
    }
    onArchived();
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Archive menu?"
      description={`“${menu?.name ?? "This menu"}” will be hidden from guests and removed from the active menu list at ${venueName}.`}
      titleId="archive-menu-title"
      stackLevel="overlay"
    >
      {menu ? (
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">
            Type <strong>{menu.name}</strong> to confirm (paste disabled)
          </span>
          <AdminInput
            className="mt-1 admin-menu-danger-confirm-input"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            placeholder={menu.name}
            onChange={(e) => setTyped(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
          />
        </AdminLabel>
      ) : null}
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Archiving…" : "Archive menu"}
        busy={busy}
        confirmDisabled={!menu || !matches}
        danger
      />
    </MenuPageModalShell>
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
    <MenuPageModalShell
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
    </MenuPageModalShell>
  );
}

export function ScheduleMenuModal({
  open,
  menu,
  token,
  restaurantId,
  onClose,
  onScheduled,
  mode = "publish"
}: Omit<BaseProps, "venueName"> & {
  onScheduled: () => void;
  mode?: "publish" | "unpublish";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const isUnpublish = mode === "unpublish";

  useEffect(() => {
    if (!open) return;
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setDate(d.toISOString().slice(0, 10));
    setTime("12:00");
    setError(null);
  }, [open, menu?.id, mode]);

  const confirm = async () => {
    if (!menu) return;
    setBusy(true);
    setError(null);
    const at = date ? new Date(`${date}T${time}:00`).toISOString() : null;
    const res = await scheduleRestaurantMenu(
      token,
      restaurantId,
      menu.id,
      isUnpublish ? { scheduledUnpublishAt: at } : { scheduledPublishAt: at }
    );
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
    const res = await scheduleRestaurantMenu(
      token,
      restaurantId,
      menu.id,
      isUnpublish ? { scheduledUnpublishAt: null } : { scheduledPublishAt: null }
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Could not clear schedule");
      return;
    }
    onScheduled();
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={isUnpublish ? "Schedule archive" : "Schedule release"}
      description={
        isUnpublish
          ? `Choose when “${menu?.name ?? "this menu"}” should leave guest view automatically.`
          : `Choose when “${menu?.name ?? "this menu"}” should publish a new guest version automatically.`
      }
      titleId={isUnpublish ? "schedule-unpublish-menu-title" : "schedule-release-menu-title"}
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
    </MenuPageModalShell>
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
  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title="QR menu generator"
      description="Create a guest ordering link and download a printable QR code."
      titleId="menu-qr-title"
      stackLevel="overlay"
    >
      <MenuQrGeneratorContent token={token} restaurantId={restaurantId} compact />
      <div className="mt-6 flex justify-end">
        <AdminBtnSecondary type="button" onClick={onClose}>
          Close
        </AdminBtnSecondary>
      </div>
    </MenuPageModalShell>
  );
}
