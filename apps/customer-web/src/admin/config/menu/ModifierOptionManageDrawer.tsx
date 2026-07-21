import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  deleteModifierOption,
  duplicateModifierOption,
  updateModifierOption
} from "../../../api";
import { AdminLabel, inputBase } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS,
  MenuPageModalShell,
  ProfileModalAlert,
  ProfileModalFooter
} from "./menuPageModalShell";
import { MenuSurfacePagination } from "./MenuSurfacePagination";
import { useMenuListPagination } from "./useMenuListPagination";
import { isUiOnlyListId } from "./menuListUiMocks";
import type { ModifierOptionListRow } from "./modifierOptionListHelpers";

const SCOPE_PAGE_SIZE = 8;

type GroupOption = { id: string; label: string };

type Props = {
  open: boolean;
  options: ModifierOptionListRow[];
  selectedIds: Set<string>;
  groups: GroupOption[];
  token: string;
  restaurantId: string;
  venueName: string;
  onClose: () => void;
  onRefresh: () => void;
  onClearSelection: () => void;
  onEditOption: (option: ModifierOptionListRow) => void;
  onPreview: (option: ModifierOptionListRow) => void;
};

type DangerKind = "archive" | "delete" | null;
type SingleOptionAction = "edit" | "preview" | "move";

function singleOptionActionCopy(action: SingleOptionAction) {
  switch (action) {
    case "edit":
      return {
        title: "Edit which option?",
        description: "Choose one modifier option from the list to edit.",
        confirmLabel: "Edit option"
      };
    case "preview":
      return {
        title: "Preview which option?",
        description: "Choose one option — guest preview opens for its linked item.",
        confirmLabel: "Open preview"
      };
    case "move":
      return {
        title: "Move which option?",
        description: "Choose one option to move into another modifier group.",
        confirmLabel: "Continue"
      };
  }
}

function ScopeChip({ option }: { option: ModifierOptionListRow }) {
  const live = option.lifecycle === "ACTIVE" && option.isActive;
  return (
    <li>
      <span
        className={`admin-menu-manage-scope-chip admin-menu-manage-scope-chip--${live ? "live" : "draft"}`}
        title={`${option.name} — ${option.groupName} · ${option.itemName}`}
      >
        {option.name}
      </span>
    </li>
  );
}

export function ModifierOptionManageDrawer({
  open,
  options,
  selectedIds,
  groups,
  token,
  restaurantId,
  venueName,
  onClose,
  onRefresh,
  onClearSelection,
  onEditOption,
  onPreview
}: Props) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const [pickAction, setPickAction] = useState<SingleOptionAction | null>(null);
  const [pickedOptionId, setPickedOptionId] = useState("");

  const [moveOption, setMoveOption] = useState<ModifierOptionListRow | null>(null);
  const [moveGroupId, setMoveGroupId] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);

  const [dangerKind, setDangerKind] = useState<DangerKind>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);

  const targets = useMemo(() => {
    const real = options.filter((o) => !isUiOnlyListId(o.id));
    if (selectedIds.size === 0) return real;
    return real.filter((o) => selectedIds.has(o.id));
  }, [options, selectedIds]);

  const scopePager = useMenuListPagination(targets, {
    pageSize: SCOPE_PAGE_SIZE,
    resetKey: `${open ? "open" : "closed"}:${targets.map((o) => o.id).join(",")}`
  });

  const anyAvailable = targets.some((o) => o.isActive && o.lifecycle === "ACTIVE");
  const anyUnavailable = targets.some((o) => !o.isActive && o.lifecycle === "ACTIVE");
  const anyActive = targets.some((o) => o.lifecycle === "ACTIVE");
  const anyArchived = targets.some((o) => o.lifecycle === "ARCHIVED");

  const selectionLabel =
    selectedIds.size > 0 ? `${selectedIds.size} selected` : `${targets.length} in list`;

  const pickOpen = pickAction != null;
  const moveOpen = moveOption != null;
  const dangerOpen = dangerKind != null;
  const showManageShell = mounted && !dangerOpen && !pickOpen && !moveOpen;

  const moveCandidates = useMemo(() => {
    if (!moveOption) return groups;
    return groups.filter((g) => g.id !== moveOption.groupId && !isUiOnlyListId(g.id));
  }, [moveOption, groups]);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (open) {
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
  }, [open]);

  useModalScrollLock(mounted || dangerOpen || pickOpen || moveOpen);

  useEffect(() => {
    if (!visible || dangerOpen || pickOpen || moveOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dangerOpen, pickOpen, moveOpen, onClose]);

  useEffect(() => {
    if (open) return;
    setPickAction(null);
    setPickedOptionId("");
    setMoveOption(null);
    setMoveGroupId("");
    setDangerKind(null);
  }, [open]);

  useEffect(() => {
    if (!dangerOpen) setDangerError(null);
  }, [dangerOpen]);

  useEffect(() => {
    if (!pickOpen) {
      setPickedOptionId("");
      return;
    }
    if (!pickedOptionId || !targets.some((o) => o.id === pickedOptionId)) {
      setPickedOptionId(targets[0]?.id ?? "");
    }
  }, [pickOpen, targets, pickedOptionId]);

  useEffect(() => {
    if (!moveOpen) {
      setMoveGroupId("");
      setMoveBusy(false);
      return;
    }
    if (!moveGroupId || !moveCandidates.some((g) => g.id === moveGroupId)) {
      setMoveGroupId(moveCandidates[0]?.id ?? "");
    }
  }, [moveOpen, moveCandidates, moveGroupId]);

  const runDuplicate = async () => {
    let ok = 0;
    let failed = 0;
    for (const option of targets) {
      const res = await duplicateModifierOption(token, restaurantId, option.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    if (ok > 0) {
      pushToast(ok === 1 ? "Modifier option duplicated." : `${ok} options duplicated.`, "success");
      onRefresh();
    }
    if (failed > 0) {
      pushToast(
        failed === 1 ? "One option could not be duplicated." : `${failed} could not be duplicated.`,
        "error"
      );
    }
  };

  const runAvailability = async (isActive: boolean, label: string) => {
    let ok = 0;
    let failed = 0;
    for (const option of targets) {
      if (option.isActive === isActive) continue;
      const res = await updateModifierOption(token, restaurantId, option.id, { isActive });
      if (res.ok) ok += 1;
      else failed += 1;
    }
    if (ok > 0) {
      pushToast(ok === 1 ? `${label} completed.` : `${ok} options updated.`, "success");
      onRefresh();
      onClearSelection();
    }
    if (failed > 0) {
      pushToast(failed === 1 ? "One option could not be updated." : `${failed} could not be updated.`, "error");
    }
  };

  const runLifecycle = async (lifecycle: "ACTIVE" | "ARCHIVED", label: string) => {
    setDangerBusy(true);
    setDangerError(null);
    let ok = 0;
    let failed = 0;
    for (const option of targets) {
      if (option.lifecycle === lifecycle) continue;
      const res = await updateModifierOption(token, restaurantId, option.id, { lifecycle });
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setDangerBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? `${label} completed.` : `${ok} options updated.`, "success");
      onRefresh();
      onClearSelection();
      setDangerKind(null);
      onClose();
    }
    if (failed > 0 && ok === 0) {
      setDangerError(`Could not ${label.toLowerCase()} the selected options.`);
    } else if (failed > 0) {
      pushToast(`${failed} could not be updated.`, "error");
      setDangerKind(null);
      onClose();
    }
  };

  const runDelete = async () => {
    setDangerBusy(true);
    setDangerError(null);
    let ok = 0;
    let failed = 0;
    for (const option of targets) {
      const res = await deleteModifierOption(token, restaurantId, option.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setDangerBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? "Modifier option deleted." : `${ok} options deleted.`, "success");
      onRefresh();
      onClearSelection();
      setDangerKind(null);
      onClose();
    }
    if (failed > 0 && ok === 0) {
      setDangerError("Could not delete the selected options.");
    } else if (failed > 0) {
      pushToast(`${failed} could not be deleted.`, "error");
      setDangerKind(null);
      onClose();
    }
  };

  const openSinglePick = (action: SingleOptionAction) => {
    if (targets.length < 1) return;
    setPickAction(action);
  };

  const confirmPickedOption = () => {
    if (!pickAction) return;
    const option = targets.find((o) => o.id === pickedOptionId);
    if (!option) {
      pushToast("Choose a modifier option to continue.", "error");
      return;
    }
    const action = pickAction;
    setPickAction(null);
    if (action === "edit") {
      onEditOption(option);
      onClose();
      return;
    }
    if (action === "preview") {
      onPreview(option);
      onClose();
      return;
    }
    setMoveOption(option);
  };

  const runMove = async () => {
    if (!moveOption || !moveGroupId) return;
    setMoveBusy(true);
    const res = await updateModifierOption(token, restaurantId, moveOption.id, {
      modifierGroupId: moveGroupId
    });
    setMoveBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Could not move option.", "error");
      return;
    }
    pushToast("Modifier option moved.", "success");
    onRefresh();
    onClearSelection();
    setMoveOption(null);
    onClose();
  };

  const pickCopy = pickAction ? singleOptionActionCopy(pickAction) : null;

  if (!mounted && !dangerOpen && !pickOpen && !moveOpen) return null;

  return createPortal(
    <>
      {showManageShell ? (
        <div
          className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
          role="presentation"
          aria-hidden={!visible}
        >
          <button
            type="button"
            className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
            aria-label="Close manage modifier options"
            tabIndex={visible ? 0 : -1}
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            tabIndex={visible ? 0 : -1}
            aria-label="Manage modifier options"
            className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
          >
            <header className="admin-staff-profile-header">
              <div className="min-w-0 flex-1">
                <h3 className="admin-staff-profile-title">Manage modifier options</h3>
                <p className="admin-staff-profile-sub">
                  {selectionLabel} at {venueName}
                </p>
              </div>
              <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>

            <div className="admin-staff-profile-body admin-menu-item-profile-body admin-menu-manage-body">
              {targets.length === 0 ? (
                <p className="admin-staff-drawer-hint">Select modifier options from the list to manage them.</p>
              ) : (
                <>
                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">In scope</h4>
                    <ul className={`admin-menu-manage-scope-list ${scopePager.pageClassName}`} key={scopePager.pageKey}>
                      {scopePager.pagedItems.map((option) => (
                        <ScopeChip key={option.id} option={option} />
                      ))}
                    </ul>
                    {scopePager.showPagination ? (
                      <MenuSurfacePagination
                        page={scopePager.page}
                        totalPages={scopePager.totalPages}
                        totalItems={scopePager.totalItems}
                        pageSize={scopePager.pageSize}
                        onPageChange={scopePager.goToPage}
                        label="In-scope modifier options pagination"
                        size="compact"
                      />
                    ) : null}
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Actions</h4>
                    <div className="admin-menu-manage-actions">
                      <button type="button" className="admin-menu-manage-action" onClick={() => openSinglePick("edit")}>
                        <span className="admin-menu-manage-action-label">Edit</span>
                        <span className="admin-menu-manage-action-desc">Update name and extra price for one option.</span>
                      </button>
                      <button type="button" className="admin-menu-manage-action" onClick={() => void runDuplicate()}>
                        <span className="admin-menu-manage-action-label">
                          {targets.length === 1 ? "Duplicate" : `Duplicate ${targets.length}`}
                        </span>
                        <span className="admin-menu-manage-action-desc">
                          Create copies of the selected options in their groups.
                        </span>
                      </button>
                      {anyAvailable ? (
                        <button
                          type="button"
                          className="admin-menu-manage-action"
                          onClick={() => void runAvailability(false, "Mark unavailable")}
                        >
                          <span className="admin-menu-manage-action-label">Mark unavailable</span>
                          <span className="admin-menu-manage-action-desc">
                            Hide options from guest selection without deleting them.
                          </span>
                        </button>
                      ) : null}
                      {anyUnavailable ? (
                        <button
                          type="button"
                          className="admin-menu-manage-action"
                          onClick={() => void runAvailability(true, "Mark available")}
                        >
                          <span className="admin-menu-manage-action-label">Mark available</span>
                          <span className="admin-menu-manage-action-desc">Make options selectable again for guests.</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={groups.length === 0}
                        onClick={() => openSinglePick("move")}
                      >
                        <span className="admin-menu-manage-action-label">Move group</span>
                        <span className="admin-menu-manage-action-desc">
                          Move one option into a different modifier group.
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">More</h4>
                    <div className="admin-menu-manage-actions">
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        onClick={() => openSinglePick("preview")}
                      >
                        <span className="admin-menu-manage-action-label">Preview</span>
                        <span className="admin-menu-manage-action-desc">
                          Open the guest ordering preview for an option’s item.
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section admin-menu-manage-danger-zone">
                    <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">Danger Zone</h4>
                    <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous option actions">
                      {anyActive ? (
                        <button
                          type="button"
                          className="admin-menu-manage-danger-btn"
                          onClick={() => setDangerKind("archive")}
                        >
                          <span className="admin-menu-manage-danger-btn-label">
                            {targets.length > 1 ? "Archive options" : "Archive"}
                          </span>
                          <span className="admin-menu-manage-danger-btn-desc">Hide options from guest menus.</span>
                        </button>
                      ) : null}
                      {anyArchived ? (
                        <button
                          type="button"
                          className="admin-menu-manage-danger-btn"
                          onClick={() => void runLifecycle("ACTIVE", "Restore")}
                        >
                          <span className="admin-menu-manage-danger-btn-label">Restore</span>
                          <span className="admin-menu-manage-danger-btn-desc">Make archived options active again.</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="admin-menu-manage-danger-btn"
                        onClick={() => setDangerKind("delete")}
                      >
                        <span className="admin-menu-manage-danger-btn-label">
                          {targets.length > 1 ? "Delete options" : "Delete"}
                        </span>
                        <span className="admin-menu-manage-danger-btn-desc">Permanently remove options.</span>
                      </button>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <MenuPageModalShell
        open={pickOpen}
        onClose={() => setPickAction(null)}
        title={pickCopy?.title ?? "Choose an option"}
        description={pickCopy?.description ?? "Select one modifier option to continue."}
        titleId="mod-option-pick-title"
        stackLevel="overlay"
      >
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">Modifier option</span>
          <select
            className={`${inputBase} mt-1 w-full`}
            value={pickedOptionId}
            onChange={(e) => setPickedOptionId(e.target.value)}
            aria-label="Choose modifier option"
          >
            {targets.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} — {option.groupName}
              </option>
            ))}
          </select>
        </AdminLabel>
        <ProfileModalFooter
          onCancel={() => setPickAction(null)}
          onConfirm={confirmPickedOption}
          confirmLabel={pickCopy?.confirmLabel ?? "Continue"}
          confirmDisabled={!pickedOptionId || targets.length === 0}
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={moveOpen}
        onClose={moveBusy ? () => undefined : () => setMoveOption(null)}
        title="Move group"
        description={
          moveOption
            ? `Move “${moveOption.name}” from ${moveOption.groupName} into another group.`
            : "Choose a destination modifier group."
        }
        titleId="mod-option-move-title"
        stackLevel="overlay"
      >
        {moveCandidates.length === 0 ? (
          <p className="admin-config-text-muted text-sm">No other modifier groups available.</p>
        ) : (
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Destination group</span>
            <select
              className={`${inputBase} mt-1 w-full`}
              value={moveGroupId}
              onChange={(e) => setMoveGroupId(e.target.value)}
              disabled={moveBusy}
            >
              {moveCandidates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </AdminLabel>
        )}
        <ProfileModalFooter
          onCancel={() => setMoveOption(null)}
          onConfirm={() => void runMove()}
          confirmLabel={moveBusy ? "Moving…" : "Move"}
          busy={moveBusy}
          confirmDisabled={!moveGroupId || moveCandidates.length === 0}
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerKind === "archive"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Archive modifier options?"
        description={`${targets.length === 1 ? `“${targets[0]?.name}”` : `${targets.length} options`} will be hidden from guests.`}
        titleId="archive-mod-option-title"
        stackLevel="overlay"
      >
        {dangerError ? <ProfileModalAlert tone="error">{dangerError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setDangerKind(null)}
          onConfirm={() => void runLifecycle("ARCHIVED", "Archive")}
          confirmLabel={dangerBusy ? "Archiving…" : "Archive"}
          busy={dangerBusy}
          danger
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerKind === "delete"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Delete modifier options?"
        description={`${targets.length === 1 ? `“${targets[0]?.name}”` : `${targets.length} options`} will be permanently removed.`}
        titleId="delete-mod-option-title"
        stackLevel="overlay"
      >
        {dangerError ? <ProfileModalAlert tone="error">{dangerError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setDangerKind(null)}
          onConfirm={() => void runDelete()}
          confirmLabel={dangerBusy ? "Deleting…" : "Delete"}
          busy={dangerBusy}
          danger
        />
      </MenuPageModalShell>
    </>,
    document.body
  );
}
