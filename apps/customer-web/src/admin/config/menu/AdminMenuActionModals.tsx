import { useEffect, useState } from "react";
import type { MenuSurfaceRow } from "../../../api";
import {
  archiveRestaurantMenu,
  scheduleRestaurantMenu
} from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  MenuPageModalShell
} from "./menuPageModalShell";
import { DuplicateEntityModal } from "./DuplicateEntityModal";
import { MenuQrGeneratorContent } from "./MenuQrGeneratorContent";
export { ContentTemplatesPanel } from "./ContentTemplatesPanel";

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
  locationDestinations = [],
  onClose,
  onDuplicated
}: Omit<BaseProps, "venueName"> & {
  locationDestinations?: Array<{ id: string; label: string; hint?: string }>;
  onDuplicated: (menu: MenuSurfaceRow | { id: string; name: string }) => void;
}) {
  if (!menu) return null;
  return (
    <DuplicateEntityModal
      open={open}
      kind="menu"
      sourceId={menu.id}
      sourceName={menu.name}
      token={token}
      restaurantId={restaurantId}
      locationDestinations={locationDestinations}
      onClose={onClose}
      onDuplicated={(result) => {
        onDuplicated(result.menu ?? { id: result.id, name: result.name });
      }}
    />
  );
}

export function ScheduleMenuModal({
  open,
  menu,
  token,
  restaurantId,
  onClose,
  onScheduled,
  mode = "release"
}: Omit<BaseProps, "venueName"> & {
  onScheduled: () => void;
  mode?: "release" | "retirement" | "publish" | "unpublish";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const isRetirement = mode === "retirement" || mode === "unpublish";

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
      isRetirement ? { scheduledRetireAt: at } : { scheduledPublishAt: at }
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
      isRetirement ? { scheduledRetireAt: null } : { scheduledPublishAt: null }
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
      title={isRetirement ? "Schedule retirement" : "Schedule release"}
      description={
        isRetirement
          ? `Choose when “${menu?.name ?? "this menu"}” should leave guest view automatically (Retired — not archived).`
          : `Choose when “${menu?.name ?? "this menu"}” should go live as a new published version.`
      }
      titleId={isRetirement ? "schedule-retirement-menu-title" : "schedule-release-menu-title"}
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
