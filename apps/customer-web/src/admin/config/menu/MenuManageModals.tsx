import { useEffect, useState } from "react";
import type { MenuSurfaceRow } from "../../../api";
import {
  archiveRestaurantMenu,
  deleteDraftRestaurantMenu,
  deleteRestaurantMenu,
  moveRestaurantMenu,
  unpublishRestaurantMenu
} from "../../../api";
import { AdminBtnSecondary, AdminLabel, AdminSelect } from "../../AdminUi";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  MenuPageModalShell
} from "./menuPageModalShell";
import { MENU_INSIGHT_PRESETS } from "./menuManageHelpers";

type BulkProps = {
  open: boolean;
  menus: MenuSurfaceRow[];
  venueName: string;
  token: string;
  restaurantId: string;
  onClose: () => void;
  onDone: (summary: { ok: number; failed: number }) => void;
};

function menuNames(menus: MenuSurfaceRow[]) {
  if (menus.length <= 3) return menus.map((m) => `“${m.name}”`).join(", ");
  return `${menus.length} menus`;
}

export function BulkArchiveConfirmModal({ open, menus, venueName, token, restaurantId, onClose, onDone }: BulkProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    for (const menu of menus) {
      if (menu.status === "ARCHIVED") continue;
      const res = await archiveRestaurantMenu(token, restaurantId, menu.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setBusy(false);
    if (failed > 0 && ok === 0) {
      setError("Could not archive the selected menus.");
      return;
    }
    onDone({ ok, failed });
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Archive menus?"
      description={`${menuNames(menus)} will be hidden from guests at ${venueName}.`}
      titleId="bulk-archive-menu-title"
      stackLevel="overlay"
    >
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Archiving…" : "Archive"}
        busy={busy}
        confirmDisabled={menus.length === 0}
        danger
      />
    </MenuPageModalShell>
  );
}

export function BulkUnpublishConfirmModal({ open, menus, venueName, token, restaurantId, onClose, onDone }: BulkProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    for (const menu of menus) {
      if (menu.status !== "PUBLISHED") continue;
      const res = await unpublishRestaurantMenu(token, restaurantId, menu.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setBusy(false);
    if (failed > 0 && ok === 0) {
      setError("Could not unpublish the selected menus.");
      return;
    }
    onDone({ ok, failed });
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Unpublish menus?"
      description={`${menuNames(menus)} will return to draft and guests at ${venueName} will no longer order from them.`}
      titleId="bulk-unpublish-menu-title"
      stackLevel="overlay"
    >
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Unpublishing…" : "Unpublish"}
        busy={busy}
        confirmDisabled={menus.length === 0}
        danger
      />
    </MenuPageModalShell>
  );
}

export function BulkDeleteDraftConfirmModal({ open, menus, token, restaurantId, onClose, onDone }: Omit<BulkProps, "venueName">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drafts = menus.filter((m) => m.status === "DRAFT");

  const confirm = async () => {
    setBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    for (const menu of drafts) {
      const res = await deleteDraftRestaurantMenu(token, restaurantId, menu.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setBusy(false);
    if (failed > 0 && ok === 0) {
      setError("Could not delete the selected drafts.");
      return;
    }
    onDone({ ok, failed });
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Delete drafts?"
      description={`Permanently delete ${menuNames(drafts)}? This cannot be undone.`}
      titleId="bulk-delete-draft-title"
      stackLevel="overlay"
    >
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Deleting…" : "Delete drafts"}
        busy={busy}
        confirmDisabled={drafts.length === 0}
        danger
      />
    </MenuPageModalShell>
  );
}

export function BulkDeleteMenuConfirmModal({ open, menus, token, restaurantId, onClose, onDone }: Omit<BulkProps, "venueName">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targets = menus.filter((m) => m.status !== "ARCHIVED");

  const confirm = async () => {
    setBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    for (const menu of targets) {
      const res = await deleteRestaurantMenu(token, restaurantId, menu.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setBusy(false);
    if (failed > 0 && ok === 0) {
      setError("Could not delete the selected menus.");
      return;
    }
    onDone({ ok, failed });
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Delete menus?"
      description={`Remove ${menuNames(targets)}? Drafts are deleted permanently; live menus are archived.`}
      titleId="bulk-delete-menu-title"
      stackLevel="overlay"
    >
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Deleting…" : "Delete menus"}
        busy={busy}
        confirmDisabled={targets.length === 0}
        danger
      />
    </MenuPageModalShell>
  );
}

export function MenuSinglePickerModal({
  open,
  title,
  description,
  menus,
  confirmLabel,
  onClose,
  onPick
}: {
  open: boolean;
  title: string;
  description: string;
  menus: MenuSurfaceRow[];
  confirmLabel: string;
  onClose: () => void;
  onPick: (menu: MenuSurfaceRow) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setSelectedId(menus[0]?.id ?? "");
  }, [open, menus]);

  const selected = menus.find((m) => m.id === selectedId) ?? null;

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      titleId="menu-single-picker-title"
      stackLevel="overlay"
    >
      <AdminLabel>
        <span className="text-xs admin-config-text-muted">Menu</span>
        <AdminSelect className="mt-1" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {menus.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </AdminSelect>
      </AdminLabel>
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => {
          if (selected) onPick(selected);
        }}
        confirmLabel={confirmLabel}
        confirmDisabled={!selected}
      />
    </MenuPageModalShell>
  );
}

export function MenuInsightsPickerModal({
  open,
  menus,
  onClose,
  onContinue
}: {
  open: boolean;
  menus: MenuSurfaceRow[];
  onClose: () => void;
  onContinue: (menuId: string, presetId: string) => void;
}) {
  const [menuId, setMenuId] = useState("");
  const [presetId, setPresetId] = useState<string>(MENU_INSIGHT_PRESETS[0]!.id);

  useEffect(() => {
    if (!open) return;
    setMenuId(menus[0]?.id ?? "");
    setPresetId(MENU_INSIGHT_PRESETS[0]!.id);
  }, [open, menus]);

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title="View menu insights"
      description="Choose which menu and report to open in Insights."
      titleId="menu-insights-picker-title"
      stackLevel="overlay"
    >
      <div className="grid gap-3">
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">Menu</span>
          <AdminSelect className="mt-1" value={menuId} onChange={(e) => setMenuId(e.target.value)}>
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </AdminSelect>
        </AdminLabel>
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">Insight</span>
          <AdminSelect className="mt-1" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {MENU_INSIGHT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </AdminSelect>
        </AdminLabel>
        <p className="admin-config-text-muted text-xs">
          {MENU_INSIGHT_PRESETS.find((p) => p.id === presetId)?.description}
        </p>
      </div>
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => {
          if (menuId) onContinue(menuId, presetId);
        }}
        confirmLabel="Open insights"
        confirmDisabled={!menuId}
      />
    </MenuPageModalShell>
  );
}

export function MoveMenusLocationModal({
  open,
  menus,
  token,
  restaurantId,
  restaurants,
  onClose,
  onMoved
}: {
  open: boolean;
  menus: MenuSurfaceRow[];
  token: string;
  restaurantId: string;
  restaurants: Array<{ id: string; name: string }>;
  onClose: () => void;
  onMoved: (summary: { ok: number; failed: number }) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = restaurants.filter((r) => r.id !== restaurantId);

  useEffect(() => {
    if (!open) return;
    setTargetId(options[0]?.id ?? "");
    setError(null);
  }, [open, options]);

  const confirm = async () => {
    if (!targetId) return;
    setBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    for (const menu of menus) {
      if (menu.status === "ARCHIVED") continue;
      const res = await moveRestaurantMenu(token, restaurantId, menu.id, targetId);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setBusy(false);
    if (failed > 0 && ok === 0) {
      setError("Could not move the selected menus.");
      return;
    }
    onMoved({ ok, failed });
    onClose();
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Move to another location"
      description={`Transfer ${menuNames(menus)} to a different venue.`}
      titleId="move-menu-location-title"
      stackLevel="overlay"
    >
      <AdminLabel>
        <span className="text-xs admin-config-text-muted">Destination</span>
        <AdminSelect className="mt-1" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {options.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </AdminSelect>
      </AdminLabel>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Moving…" : "Move menus"}
        busy={busy}
        confirmDisabled={!targetId || options.length === 0}
      />
    </MenuPageModalShell>
  );
}
