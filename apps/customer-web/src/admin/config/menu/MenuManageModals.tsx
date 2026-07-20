import { useEffect, useMemo, useState, type ClipboardEvent } from "react";
import type { MenuSurfaceRow } from "../../../api";
import {
  archiveRestaurantMenu,
  deleteDraftRestaurantMenu,
  deleteRestaurantMenu,
  moveRestaurantMenu,
  unpublishRestaurantMenu
} from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel, AdminSelect } from "../../AdminUi";
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

/** Exact confirmation string the user must type (UI gate). Backend still verifies each menu name. */
export function expectedDangerConfirmText(menus: MenuSurfaceRow[]) {
  return menus.map((m) => m.name).join(", ");
}

function useDangerNameConfirm(open: boolean, menus: MenuSurfaceRow[]) {
  const [typed, setTyped] = useState("");
  const expected = useMemo(() => expectedDangerConfirmText(menus), [menus]);
  const matches = typed === expected && expected.length > 0;

  const reset = () => setTyped("");

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    reset();
  }, [open, expected]);

  useEffect(() => {
    if (!open) return;

    const clearOnLeave = () => reset();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") clearOnLeave();
    };

    window.addEventListener("blur", clearOnLeave);
    window.addEventListener("pagehide", clearOnLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", clearOnLeave);
      window.removeEventListener("pagehide", clearOnLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open]);

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
  };

  return { typed, setTyped, expected, matches, onPaste, reset };
}

function DangerNameConfirmField({
  open,
  menus,
  typed,
  setTyped,
  expected,
  onPaste,
  disabled
}: {
  open: boolean;
  menus: MenuSurfaceRow[];
  typed: string;
  setTyped: (v: string) => void;
  expected: string;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  if (!open || menus.length === 0) return null;

  return (
    <div className="admin-menu-danger-confirm">
      <p className="admin-menu-danger-confirm-hint">
        {menus.length === 1 ? (
          <>
            Type <strong>{expected}</strong> to confirm. Pasting is disabled.
          </>
        ) : (
          <>
            Type every menu name exactly, separated by commas, to confirm:
            <br />
            <strong>{expected}</strong>
            <br />
            Pasting is disabled.
          </>
        )}
      </p>
      <AdminLabel>
        <span className="text-xs admin-config-text-muted">Confirm by typing</span>
        <AdminInput
          className="mt-1 admin-menu-danger-confirm-input"
          value={typed}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={expected}
          onChange={(e) => setTyped(e.target.value)}
          onPaste={onPaste}
          onDrop={(e) => e.preventDefault()}
        />
      </AdminLabel>
    </div>
  );
}

export function BulkArchiveConfirmModal({ open, menus, venueName, token, restaurantId, onClose, onDone }: BulkProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmGate = useDangerNameConfirm(open, menus);

  const confirm = async () => {
    if (!confirmGate.matches) return;
    setBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (const menu of menus) {
      if (menu.status === "ARCHIVED") continue;
      const res = await archiveRestaurantMenu(token, restaurantId, menu.id, menu.name);
      if (res.ok) ok += 1;
      else {
        failed += 1;
        if (!firstError) firstError = res.message ?? res.error ?? "Could not archive the selected menus.";
      }
    }
    setBusy(false);
    if (failed > 0 && ok === 0) {
      setError(firstError ?? "Could not archive the selected menus.");
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
      <DangerNameConfirmField
        open={open}
        menus={menus}
        typed={confirmGate.typed}
        setTyped={confirmGate.setTyped}
        expected={confirmGate.expected}
        onPaste={confirmGate.onPaste}
        disabled={busy}
      />
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Archiving…" : "Archive"}
        busy={busy}
        confirmDisabled={menus.length === 0 || !confirmGate.matches}
        danger
      />
    </MenuPageModalShell>
  );
}

export function BulkUnpublishConfirmModal({ open, menus, venueName, token, restaurantId, onClose, onDone }: BulkProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmGate = useDangerNameConfirm(open, menus);

  const confirm = async () => {
    if (!confirmGate.matches) return;
    setBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (const menu of menus) {
      if (menu.status !== "PUBLISHED") continue;
      const res = await unpublishRestaurantMenu(token, restaurantId, menu.id, menu.name);
      if (res.ok) ok += 1;
      else {
        failed += 1;
        if (!firstError) firstError = res.message ?? res.error ?? "Could not unpublish the selected menus.";
      }
    }
    setBusy(false);
    if (failed > 0 && ok === 0) {
      setError(firstError ?? "Could not unpublish the selected menus.");
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
      <DangerNameConfirmField
        open={open}
        menus={menus}
        typed={confirmGate.typed}
        setTyped={confirmGate.setTyped}
        expected={confirmGate.expected}
        onPaste={confirmGate.onPaste}
        disabled={busy}
      />
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Unpublishing…" : "Unpublish"}
        busy={busy}
        confirmDisabled={menus.length === 0 || !confirmGate.matches}
        danger
      />
    </MenuPageModalShell>
  );
}

export function BulkDeleteDraftConfirmModal({ open, menus, token, restaurantId, onClose, onDone }: Omit<BulkProps, "venueName">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drafts = menus.filter((m) => m.status === "DRAFT");
  const confirmGate = useDangerNameConfirm(open, drafts);

  const confirm = async () => {
    if (!confirmGate.matches) return;
    setBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (const menu of drafts) {
      const res = await deleteDraftRestaurantMenu(token, restaurantId, menu.id, menu.name);
      if (res.ok) ok += 1;
      else {
        failed += 1;
        if (!firstError) firstError = res.message ?? res.error ?? "Could not delete the selected drafts.";
      }
    }
    setBusy(false);
    if (failed > 0 && ok === 0) {
      setError(firstError ?? "Could not delete the selected drafts.");
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
      <DangerNameConfirmField
        open={open}
        menus={drafts}
        typed={confirmGate.typed}
        setTyped={confirmGate.setTyped}
        expected={confirmGate.expected}
        onPaste={confirmGate.onPaste}
        disabled={busy}
      />
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Deleting…" : "Delete drafts"}
        busy={busy}
        confirmDisabled={drafts.length === 0 || !confirmGate.matches}
        danger
      />
    </MenuPageModalShell>
  );
}

export function BulkDeleteMenuConfirmModal({ open, menus, token, restaurantId, onClose, onDone }: Omit<BulkProps, "venueName">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targets = menus.filter((m) => m.status !== "ARCHIVED");
  const confirmGate = useDangerNameConfirm(open, targets);

  const confirm = async () => {
    if (!confirmGate.matches) return;
    setBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (const menu of targets) {
      const res = await deleteRestaurantMenu(token, restaurantId, menu.id, menu.name);
      if (res.ok) ok += 1;
      else {
        failed += 1;
        if (!firstError) firstError = res.message ?? res.error ?? "Could not delete the selected menus.";
      }
    }
    setBusy(false);
    if (failed > 0 && ok === 0) {
      setError(firstError ?? "Could not delete the selected menus.");
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
      <DangerNameConfirmField
        open={open}
        menus={targets}
        typed={confirmGate.typed}
        setTyped={confirmGate.setTyped}
        expected={confirmGate.expected}
        onPaste={confirmGate.onPaste}
        disabled={busy}
      />
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onClose}
        onConfirm={() => void confirm()}
        confirmLabel={busy ? "Deleting…" : "Delete menus"}
        busy={busy}
        confirmDisabled={targets.length === 0 || !confirmGate.matches}
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
