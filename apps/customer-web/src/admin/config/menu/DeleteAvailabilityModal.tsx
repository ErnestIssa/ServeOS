import { useState } from "react";
import type { MenuSurfaceRow } from "../../../api";
import { ProfileModalAlert, ProfileModalFooter, MenuPageModalShell } from "./menuPageModalShell";
import { removeMenuAvailabilityWindow } from "./availabilityHelpers";

type Props = {
  open: boolean;
  windowLabel: string | null;
  windowKey: string | null;
  menuId: string | null;
  menus: MenuSurfaceRow[];
  token: string;
  restaurantId: string;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteAvailabilityModal({
  open,
  windowLabel,
  windowKey,
  menuId,
  menus,
  token,
  restaurantId,
  onClose,
  onDeleted
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!windowKey || !menuId) return;
    const menu = menus.find((m) => m.id === menuId);
    if (!menu) {
      setError("We couldn't find that menu. Refresh the page and try again.");
      return;
    }

    setBusy(true);
    setError(null);
    const res = await removeMenuAvailabilityWindow(token, restaurantId, menuId, menu.availabilityWindows, windowKey);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not delete availability window");
      return;
    }
    onDeleted();
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Delete availability window?"
      description={`“${windowLabel ?? "This window"}” will be removed. This cannot be undone.`}
      titleId="delete-availability-title"
      stackLevel="overlay"
      panelClassName="admin-menu-create-confirm-modal"
      busy={busy}
    >
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Deleting…" : "Delete window"}
        busy={busy}
        confirmDisabled={!windowKey || !menuId}
        danger
      />
    </MenuPageModalShell>
  );
}
