import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  attachModifierGroup,
  deleteModifierGroup,
  duplicateModifierGroup,
  updateModifierGroup
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
import type { ModifierGroupListRow } from "./modifierGroupListHelpers";

const SCOPE_PAGE_SIZE = 8;

type ItemOption = { id: string; name: string; categoryName: string };

type Props = {
  open: boolean;
  groups: ModifierGroupListRow[];
  selectedIds: Set<string>;
  items: ItemOption[];
  token: string;
  restaurantId: string;
  venueName: string;
  onClose: () => void;
  onRefresh: () => void;
  onClearSelection: () => void;
  onEditGroup: (group: ModifierGroupListRow) => void;
  onPreview: (group: ModifierGroupListRow) => void;
};

type DangerKind = "archive" | "delete" | "detach" | null;
type SingleGroupAction = "edit" | "preview" | "attach";

function singleGroupActionCopy(action: SingleGroupAction) {
  switch (action) {
    case "edit":
      return {
        title: "Edit which group?",
        description: "Choose one modifier group from the list to edit.",
        confirmLabel: "Edit group"
      };
    case "preview":
      return {
        title: "Preview which group?",
        description: "Choose one group — guest preview opens for its linked item.",
        confirmLabel: "Open preview"
      };
    case "attach":
      return {
        title: "Attach which group?",
        description: "Choose one modifier group to copy onto other items.",
        confirmLabel: "Continue"
      };
  }
}

function ScopeChip({ group }: { group: ModifierGroupListRow }) {
  const live = group.lifecycle === "ACTIVE";
  return (
    <li>
      <span
        className={`admin-menu-manage-scope-chip admin-menu-manage-scope-chip--${live ? "live" : "draft"}`}
        title={`${group.name} — ${group.itemName}`}
      >
        {group.name}
      </span>
    </li>
  );
}

export function ModifierGroupManageDrawer({
  open,
  groups,
  selectedIds,
  items,
  token,
  restaurantId,
  venueName,
  onClose,
  onRefresh,
  onClearSelection,
  onEditGroup,
  onPreview
}: Props) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const [pickAction, setPickAction] = useState<SingleGroupAction | null>(null);
  const [pickedGroupId, setPickedGroupId] = useState("");

  const [attachGroup, setAttachGroup] = useState<ModifierGroupListRow | null>(null);
  const [attachItemIds, setAttachItemIds] = useState<Set<string>>(() => new Set());
  const [attachBusy, setAttachBusy] = useState(false);

  const [dangerKind, setDangerKind] = useState<DangerKind>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);

  const targets = useMemo(() => {
    const real = groups.filter((g) => !isUiOnlyListId(g.id));
    if (selectedIds.size === 0) return real;
    return real.filter((g) => selectedIds.has(g.id));
  }, [groups, selectedIds]);

  const scopePager = useMenuListPagination(targets, {
    pageSize: SCOPE_PAGE_SIZE,
    resetKey: `${open ? "open" : "closed"}:${targets.map((g) => g.id).join(",")}`
  });

  const anyActive = targets.some((g) => g.lifecycle === "ACTIVE");
  const anyArchived = targets.some((g) => g.lifecycle === "ARCHIVED");

  const selectionLabel =
    selectedIds.size > 0 ? `${selectedIds.size} selected` : `${targets.length} in list`;

  const pickOpen = pickAction != null;
  const attachOpen = attachGroup != null;
  const dangerOpen = dangerKind != null;
  const showManageShell = mounted && !dangerOpen && !pickOpen && !attachOpen;

  const attachCandidates = useMemo(() => {
    if (!attachGroup) return [];
    return items.filter((item) => !isUiOnlyListId(item.id) && item.id !== attachGroup.itemId);
  }, [attachGroup, items]);

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

  useModalScrollLock(mounted || dangerOpen || pickOpen || attachOpen);

  useEffect(() => {
    if (!visible || dangerOpen || pickOpen || attachOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dangerOpen, pickOpen, attachOpen, onClose]);

  useEffect(() => {
    if (open) return;
    setPickAction(null);
    setPickedGroupId("");
    setAttachGroup(null);
    setAttachItemIds(new Set());
    setDangerKind(null);
  }, [open]);

  useEffect(() => {
    if (!dangerOpen) setDangerError(null);
  }, [dangerOpen]);

  useEffect(() => {
    if (!pickOpen) {
      setPickedGroupId("");
      return;
    }
    if (!pickedGroupId || !targets.some((g) => g.id === pickedGroupId)) {
      setPickedGroupId(targets[0]?.id ?? "");
    }
  }, [pickOpen, targets, pickedGroupId]);

  useEffect(() => {
    if (!attachOpen) {
      setAttachItemIds(new Set());
      setAttachBusy(false);
    }
  }, [attachOpen]);

  const runDuplicate = async () => {
    let ok = 0;
    let failed = 0;
    for (const group of targets) {
      const res = await duplicateModifierGroup(token, restaurantId, group.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    if (ok > 0) {
      pushToast(ok === 1 ? "Modifier group duplicated." : `${ok} groups duplicated.`, "success");
      onRefresh();
    }
    if (failed > 0) {
      pushToast(
        failed === 1 ? "One group could not be duplicated." : `${failed} could not be duplicated.`,
        "error"
      );
    }
  };

  const runLifecycle = async (lifecycle: "ACTIVE" | "ARCHIVED", label: string) => {
    setDangerBusy(true);
    setDangerError(null);
    let ok = 0;
    let failed = 0;
    for (const group of targets) {
      if (group.lifecycle === lifecycle) continue;
      const res = await updateModifierGroup(token, restaurantId, group.id, { lifecycle });
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setDangerBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? `${label} completed.` : `${ok} groups updated.`, "success");
      onRefresh();
      onClearSelection();
      setDangerKind(null);
      onClose();
    }
    if (failed > 0 && ok === 0) {
      setDangerError(`Could not ${label.toLowerCase()} the selected groups.`);
    } else if (failed > 0) {
      pushToast(`${failed} could not be updated.`, "error");
      setDangerKind(null);
      onClose();
    }
  };

  const runDeleteOrDetach = async (label: string) => {
    setDangerBusy(true);
    setDangerError(null);
    let ok = 0;
    let failed = 0;
    for (const group of targets) {
      const res = await deleteModifierGroup(token, restaurantId, group.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setDangerBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? `${label} completed.` : `${ok} groups updated.`, "success");
      onRefresh();
      onClearSelection();
      setDangerKind(null);
      onClose();
    }
    if (failed > 0 && ok === 0) {
      setDangerError(`Could not complete ${label.toLowerCase()}.`);
    } else if (failed > 0) {
      pushToast(`${failed} could not be updated.`, "error");
      setDangerKind(null);
      onClose();
    }
  };

  const openSinglePick = (action: SingleGroupAction) => {
    if (targets.length < 1) return;
    setPickAction(action);
  };

  const confirmPickedGroup = () => {
    if (!pickAction) return;
    const group = targets.find((g) => g.id === pickedGroupId);
    if (!group) {
      pushToast("Choose a modifier group to continue.", "error");
      return;
    }
    const action = pickAction;
    setPickAction(null);
    if (action === "edit") {
      onEditGroup(group);
      onClose();
      return;
    }
    if (action === "preview") {
      onPreview(group);
      onClose();
      return;
    }
    setAttachGroup(group);
  };

  const toggleAttachItem = (itemId: string, checked: boolean) => {
    setAttachItemIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  const runAttach = async () => {
    if (!attachGroup || attachItemIds.size === 0) return;
    setAttachBusy(true);
    const res = await attachModifierGroup(token, restaurantId, attachGroup.id, {
      itemIds: [...attachItemIds]
    });
    setAttachBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Could not attach group.", "error");
      return;
    }
    const count = res.groups?.length ?? attachItemIds.size;
    pushToast(
      count === 1 ? "Modifier group attached to 1 item." : `Modifier group attached to ${count} items.`,
      "success"
    );
    onRefresh();
    onClearSelection();
    setAttachGroup(null);
    onClose();
  };

  const pickCopy = pickAction ? singleGroupActionCopy(pickAction) : null;

  if (!mounted && !dangerOpen && !pickOpen && !attachOpen) return null;

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
            aria-label="Close manage modifier groups"
            tabIndex={visible ? 0 : -1}
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            tabIndex={visible ? 0 : -1}
            aria-label="Manage modifier groups"
            className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
          >
            <header className="admin-staff-profile-header">
              <div className="min-w-0 flex-1">
                <h3 className="admin-staff-profile-title">Manage modifier groups</h3>
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
                <p className="admin-staff-drawer-hint">Select modifier groups from the list to manage them.</p>
              ) : (
                <>
                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">In scope</h4>
                    <ul className={`admin-menu-manage-scope-list ${scopePager.pageClassName}`} key={scopePager.pageKey}>
                      {scopePager.pagedItems.map((group) => (
                        <ScopeChip key={group.id} group={group} />
                      ))}
                    </ul>
                    {scopePager.showPagination ? (
                      <MenuSurfacePagination
                        page={scopePager.page}
                        totalPages={scopePager.totalPages}
                        totalItems={scopePager.totalItems}
                        pageSize={scopePager.pageSize}
                        onPageChange={scopePager.goToPage}
                        label="In-scope modifier groups pagination"
                        size="compact"
                      />
                    ) : null}
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Actions</h4>
                    <div className="admin-menu-manage-actions">
                      <button type="button" className="admin-menu-manage-action" onClick={() => openSinglePick("edit")}>
                        <span className="admin-menu-manage-action-label">Edit</span>
                        <span className="admin-menu-manage-action-desc">
                          Update name and selection rules for one group.
                        </span>
                      </button>
                      <button type="button" className="admin-menu-manage-action" onClick={() => void runDuplicate()}>
                        <span className="admin-menu-manage-action-label">
                          {targets.length === 1 ? "Duplicate" : `Duplicate ${targets.length}`}
                        </span>
                        <span className="admin-menu-manage-action-desc">
                          Create copies of the selected groups on their items.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={items.length === 0}
                        onClick={() => openSinglePick("attach")}
                      >
                        <span className="admin-menu-manage-action-label">Attach to items</span>
                        <span className="admin-menu-manage-action-desc">Copy one group onto other menu items.</span>
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
                          Open the guest ordering preview for a group’s item.
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section admin-menu-manage-danger-zone">
                    <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">Danger Zone</h4>
                    <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous group actions">
                      <button
                        type="button"
                        className="admin-menu-manage-danger-btn"
                        onClick={() => setDangerKind("detach")}
                      >
                        <span className="admin-menu-manage-danger-btn-label">
                          {targets.length > 1 ? "Detach groups" : "Detach from items"}
                        </span>
                        <span className="admin-menu-manage-danger-btn-desc">
                          Remove selected groups from their linked items.
                        </span>
                      </button>
                      {anyActive ? (
                        <button
                          type="button"
                          className="admin-menu-manage-danger-btn"
                          onClick={() => setDangerKind("archive")}
                        >
                          <span className="admin-menu-manage-danger-btn-label">
                            {targets.length > 1 ? "Archive groups" : "Archive"}
                          </span>
                          <span className="admin-menu-manage-danger-btn-desc">Hide groups from guest menus.</span>
                        </button>
                      ) : null}
                      {anyArchived ? (
                        <button
                          type="button"
                          className="admin-menu-manage-danger-btn"
                          onClick={() => void runLifecycle("ACTIVE", "Restore")}
                        >
                          <span className="admin-menu-manage-danger-btn-label">Restore</span>
                          <span className="admin-menu-manage-danger-btn-desc">Make archived groups active again.</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="admin-menu-manage-danger-btn"
                        onClick={() => setDangerKind("delete")}
                      >
                        <span className="admin-menu-manage-danger-btn-label">
                          {targets.length > 1 ? "Delete groups" : "Delete"}
                        </span>
                        <span className="admin-menu-manage-danger-btn-desc">Permanently remove groups and options.</span>
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
        title={pickCopy?.title ?? "Choose a group"}
        description={pickCopy?.description ?? "Select one modifier group to continue."}
        titleId="mod-group-pick-title"
        stackLevel="overlay"
      >
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">Modifier group</span>
          <select
            className={`${inputBase} mt-1 w-full`}
            value={pickedGroupId}
            onChange={(e) => setPickedGroupId(e.target.value)}
            aria-label="Choose modifier group"
          >
            {targets.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} — {group.itemName}
              </option>
            ))}
          </select>
        </AdminLabel>
        <ProfileModalFooter
          onCancel={() => setPickAction(null)}
          onConfirm={confirmPickedGroup}
          confirmLabel={pickCopy?.confirmLabel ?? "Continue"}
          confirmDisabled={!pickedGroupId || targets.length === 0}
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={attachOpen}
        onClose={attachBusy ? () => undefined : () => setAttachGroup(null)}
        title="Attach to items"
        description={
          attachGroup
            ? `Copy “${attachGroup.name}” onto other items. Guests will see the same options on each.`
            : "Choose items to attach this group to."
        }
        titleId="mod-group-attach-title"
        stackLevel="overlay"
      >
        {attachCandidates.length === 0 ? (
          <p className="admin-config-text-muted text-sm">No other items available to attach to.</p>
        ) : (
          <ul className="admin-menu-manage-scope-list max-h-64 overflow-y-auto" role="listbox" aria-label="Items">
            {attachCandidates.map((item) => {
              const checked = attachItemIds.has(item.id);
              return (
                <li key={item.id}>
                  <label className="admin-menu-surface-select-all">
                    <input
                      type="checkbox"
                      className="admin-menu-surface-checkbox"
                      checked={checked}
                      disabled={attachBusy}
                      onChange={(e) => toggleAttachItem(item.id, e.target.checked)}
                    />
                    <span className="admin-menu-surface-select-all-label">
                      {item.name}
                      <span className="admin-config-text-muted"> · {item.categoryName}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <ProfileModalFooter
          onCancel={() => setAttachGroup(null)}
          onConfirm={() => void runAttach()}
          confirmLabel={attachBusy ? "Attaching…" : "Attach"}
          busy={attachBusy}
          confirmDisabled={attachItemIds.size === 0 || attachCandidates.length === 0}
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerKind === "archive"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Archive modifier groups?"
        description={`${targets.length === 1 ? `“${targets[0]?.name}”` : `${targets.length} groups`} will be hidden from guests.`}
        titleId="archive-mod-group-title"
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
        open={dangerKind === "detach"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Detach from items?"
        description={`${targets.length === 1 ? `“${targets[0]?.name}”` : `${targets.length} groups`} will be removed from their linked items.`}
        titleId="detach-mod-group-title"
        stackLevel="overlay"
      >
        {dangerError ? <ProfileModalAlert tone="error">{dangerError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setDangerKind(null)}
          onConfirm={() => void runDeleteOrDetach("Detach")}
          confirmLabel={dangerBusy ? "Detaching…" : "Detach"}
          busy={dangerBusy}
          danger
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerKind === "delete"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Delete modifier groups?"
        description={`${targets.length === 1 ? `“${targets[0]?.name}”` : `${targets.length} groups`} and their options will be permanently removed.`}
        titleId="delete-mod-group-title"
        stackLevel="overlay"
      >
        {dangerError ? <ProfileModalAlert tone="error">{dangerError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setDangerKind(null)}
          onConfirm={() => void runDeleteOrDetach("Delete")}
          confirmLabel={dangerBusy ? "Deleting…" : "Delete"}
          busy={dangerBusy}
          danger
        />
      </MenuPageModalShell>
    </>,
    document.body
  );
}
