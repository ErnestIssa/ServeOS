import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import {
  createOrderingSession,
  updateModifierOption,
  type MenuCapabilitiesPayload
} from "../../../api";
import { AdminEmptyState, AdminLabel, inputBase } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import type { MenuSectionTab } from "../configRouting";
import type { useAdminMenu } from "../useAdminMenu";
import { CreateModifierOptionModal } from "./CreateModifierOptionModal";
import { DuplicateEntityModal } from "./DuplicateEntityModal";
import { EditModifierOptionModal, type EditModifierOptionTarget } from "./EditModifierOptionModal";
import { MenuActionConfirmModal } from "./MenuActionConfirmModal";
import { MenuEntityActionsMenu } from "./MenuEntityActionsMenu";
import { isUiOnlyListId, matchesListSearch, UI_MOCK_MODIFIER_OPTIONS } from "./menuListUiMocks";
import {
  applyModifierOptionListFilters,
  applyModifierOptionListSort,
  MODIFIER_OPTION_LIST_QUERY
} from "./menuListQuery";
import { MenuListSearchField, MenuToolbarButton } from "./MenuPageUi";
import { MenuPageModalShell, ProfileModalFooter } from "./menuPageModalShell";
import { MenuSurfacePagination } from "./MenuSurfacePagination";
import {
  modifierOptionStatusClass,
  modifierOptionStatusLabel,
  type ModifierOptionListRow
} from "./modifierOptionListHelpers";
import { ModifierGroupProfileDrawer } from "./ModifierGroupProfileDrawer";
import { ModifierOptionProfileDrawer } from "./ModifierOptionProfileDrawer";
import type { ModifierGroupListRow } from "./modifierGroupListHelpers";
import { ModifierOptionManageDrawer } from "./ModifierOptionManageDrawer";
import { useMenuListPagination } from "./useMenuListPagination";

type Props = {
  api: ReturnType<typeof useAdminMenu>;
  token: string;
  restaurantId: string;
  venueName: string;
  can: (entity: keyof MenuCapabilitiesPayload["entities"], action: string) => boolean;
  onNavigateTab: (tab: MenuSectionTab) => void;
};

type PendingRowAction = {
  option: ModifierOptionListRow;
  actionId: string;
};

function optionRowActions(option: ModifierOptionListRow, can: Props["can"], hasOtherGroups: boolean) {
  const actions: Array<{ id: string; label: string; danger?: boolean }> = [];

  if (can("modifier_option", "view") || can("modifier_option", "edit")) {
    actions.push({ id: "option-details", label: "Option details" });
  }
  if (can("modifier_group", "view") || can("modifier_group", "edit")) {
    actions.push({ id: "group-details", label: "Group details" });
  }
  if (can("modifier_option", "create")) {
    actions.push({ id: "duplicate", label: "Duplicate" });
  }
  if (can("modifier_option", "edit") && option.lifecycle === "ACTIVE") {
    if (option.isActive) {
      actions.push({ id: "unavailable", label: "Mark unavailable" });
    } else {
      actions.push({ id: "available", label: "Mark available" });
    }
  }
  if (can("modifier_option", "edit") && hasOtherGroups) {
    actions.push({ id: "move", label: "Move group" });
  }
  actions.push({ id: "preview", label: "Preview" });
  return actions;
}

const DIRECT_OPEN_ACTIONS = new Set(["option-details", "group-details", "preview", "move", "duplicate"]);
/** Runs immediately after confirmation — no further UI. */
const CONFIRM_RUN_ACTIONS = new Set(["unavailable", "available"]);

function confirmCopyForAction(action: PendingRowAction) {
  const name = action.option.name;
  switch (action.actionId) {
    case "unavailable":
      return {
        title: "Mark unavailable?",
        description: `“${name}” will be hidden from guest selection.`,
        confirmLabel: "Mark unavailable",
        danger: true,
        titleId: "mod-option-confirm-unavailable"
      };
    case "available":
      return {
        title: "Mark available?",
        description: `“${name}” will be selectable again for guests.`,
        confirmLabel: "Mark available",
        danger: false,
        titleId: "mod-option-confirm-available"
      };
    default:
      return {
        title: "Confirm action?",
        description: `Continue with this action for “${name}”?`,
        confirmLabel: "Confirm",
        danger: false,
        titleId: "mod-option-confirm-action"
      };
  }
}

function toEditTarget(option: ModifierOptionListRow): EditModifierOptionTarget {
  return {
    id: option.id,
    name: option.name,
    groupId: option.groupId,
    groupName: option.groupName,
    itemName: option.itemName,
    priceDeltaCents: option.priceDeltaCents,
    isActive: option.isActive
  };
}

export function AdminModifierOptionsTabPanel({
  api,
  token,
  restaurantId,
  venueName,
  can,
  onNavigateTab
}: Props) {
  const { pushToast } = useAdminToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditModifierOptionTarget | null>(null);
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
  const [groupDetailsTarget, setGroupDetailsTarget] = useState<ModifierGroupListRow | null>(null);
  const [optionDetailsOpen, setOptionDetailsOpen] = useState(false);
  const [optionDetailsTarget, setOptionDetailsTarget] = useState<ModifierOptionListRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(MODIFIER_OPTION_LIST_QUERY.defaultSort);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingRowAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<ModifierOptionListRow | null>(null);

  const [moveOption, setMoveOption] = useState<ModifierOptionListRow | null>(null);
  const [moveGroupId, setMoveGroupId] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);

  const options = useMemo(
    () => [...api.flatModifiers, ...UI_MOCK_MODIFIER_OPTIONS],
    [api.flatModifiers]
  );

  const realOptions = useMemo(() => options.filter((o) => !isUiOnlyListId(o.id)), [options]);

  const modalGroups = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    for (const cat of api.menu?.categories ?? []) {
      for (const item of cat.items) {
        for (const g of item.modifierGroups) {
          out.push({ id: g.id, label: `${item.name} → ${g.name}` });
        }
      }
    }
    return out;
  }, [api.menu?.categories]);

  const filtered = useMemo(() => {
    const searched = options.filter((o) =>
      matchesListSearch(
        searchQuery,
        o.name,
        o.groupName,
        o.itemName,
        o.priceDeltaCents,
        modifierOptionStatusLabel(o)
      )
    );
    return applyModifierOptionListSort(
      applyModifierOptionListFilters(searched, activeFilters),
      activeSort
    );
  }, [options, searchQuery, activeFilters, activeSort]);

  const pager = useMenuListPagination(filtered, {
    resetKey: `${searchQuery.trim().toLowerCase()}:${activeFilters.join(",")}:${activeSort}`
  });

  const selectablePaged = useMemo(
    () => pager.pagedItems.filter((o) => !isUiOnlyListId(o.id)),
    [pager.pagedItems]
  );

  const allPageSelected =
    selectablePaged.length > 0 && selectablePaged.every((o) => selectedIds.has(o.id));
  const somePageSelected = selectablePaged.some((o) => selectedIds.has(o.id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = somePageSelected && !allPageSelected;
  }, [somePageSelected, allPageSelected]);

  useEffect(() => {
    if (!moveOption) {
      setMoveGroupId("");
      setMoveBusy(false);
      return;
    }
    const candidates = modalGroups.filter((g) => g.id !== moveOption.groupId && !isUiOnlyListId(g.id));
    if (!moveGroupId || !candidates.some((g) => g.id === moveGroupId)) {
      setMoveGroupId(candidates[0]?.id ?? "");
    }
  }, [moveOption, modalGroups, moveGroupId]);

  const moveCandidates = useMemo(() => {
    if (!moveOption) return [];
    return modalGroups.filter((g) => g.id !== moveOption.groupId && !isUiOnlyListId(g.id));
  }, [moveOption, modalGroups]);

  const toggleSelection = (id: string, checked?: boolean) => {
    if (isUiOnlyListId(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const should = checked ?? !next.has(id);
      if (should) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const o of selectablePaged) {
        if (checked) next.add(o.id);
        else next.delete(o.id);
      }
      return next;
    });
  };

  const toastPreview = () => pushToast("Preview option only — not connected to the backend.", "error");

  const openEdit = (option: ModifierOptionListRow) => {
    setEditTarget(toEditTarget(option));
    setEditOpen(true);
  };

  const openGroupDetails = (option: ModifierOptionListRow) => {
    const group = api.flatModifierGroups.find((g) => g.id === option.groupId);
    if (group) {
      setGroupDetailsTarget(group);
      setGroupDetailsOpen(true);
      return;
    }
    if (isUiOnlyListId(option.id) || isUiOnlyListId(option.groupId)) {
      // Still allow preview groups from mocks
      setGroupDetailsTarget({
        id: option.groupId,
        name: option.groupName,
        itemName: option.itemName,
        itemId: `ui-mock-item-from-option`,
        minSelect: 0,
        maxSelect: 1,
        optionCount: 0,
        lifecycle: "ACTIVE"
      });
      setGroupDetailsOpen(true);
      return;
    }
    pushToast("Couldn’t find this option’s group.", "error");
  };

  const handlePreview = async (option: ModifierOptionListRow) => {
    if (previewBusy) return;
    if (isUiOnlyListId(option.id)) {
      toastPreview();
      return;
    }
    setPreviewBusy(true);
    const created = await createOrderingSession(token, restaurantId, {
      paymentMode: "PAY_AT_VENUE"
    });
    setPreviewBusy(false);
    if (!created.ok || !created.session?.menuUrl) {
      pushToast(created.message ?? created.error ?? "Could not open guest preview.", "error");
      return;
    }
    window.open(created.session.menuUrl, "_blank", "noopener,noreferrer");
  };

  const runDirectAction = (option: ModifierOptionListRow, actionId: string) => {
    if (actionId === "option-details") {
      setOptionDetailsTarget(option);
      setOptionDetailsOpen(true);
      return;
    }
    if (actionId === "group-details") {
      openGroupDetails(option);
      return;
    }
    if (actionId === "preview") {
      void handlePreview(option);
      return;
    }
    if (actionId === "move") {
      if (isUiOnlyListId(option.id)) {
        toastPreview();
        return;
      }
      setMoveOption(option);
      return;
    }
    if (actionId === "duplicate") {
      if (isUiOnlyListId(option.id)) {
        toastPreview();
        return;
      }
      setDuplicateTarget(option);
    }
  };

  const handleAction = (option: ModifierOptionListRow, actionId: string) => {
    setOpenActionsId(null);
    if (DIRECT_OPEN_ACTIONS.has(actionId)) {
      runDirectAction(option, actionId);
      return;
    }
    if (isUiOnlyListId(option.id)) {
      toastPreview();
      return;
    }
    if (!CONFIRM_RUN_ACTIONS.has(actionId)) {
      pushToast("Unknown action.", "error");
      return;
    }
    setPendingAction({ option, actionId });
  };

  const closeConfirm = () => {
    if (confirmBusy) return;
    setPendingAction(null);
  };

  const runConfirmedAction = async () => {
    if (!pendingAction) return;
    const { option, actionId } = pendingAction;
    setConfirmBusy(true);

    if (actionId === "unavailable" || actionId === "available") {
      const res = await updateModifierOption(token, restaurantId, option.id, {
        isActive: actionId === "available"
      });
      setConfirmBusy(false);
      if (!res.ok) {
        pushToast(res.message ?? res.error ?? "Could not update option.", "error");
        return;
      }
      pushToast(
        actionId === "available" ? "Modifier option marked available." : "Modifier option marked unavailable.",
        "success"
      );
      api.refresh();
      setPendingAction(null);
      return;
    }

    setConfirmBusy(false);
    setPendingAction(null);
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
    api.refresh();
    setMoveOption(null);
  };

  const hasSelection = selectedIds.size > 0;
  const canManage = realOptions.length > 0;
  const confirmCopy = pendingAction ? confirmCopyForAction(pendingAction) : null;

  return (
    <>
      <div className="admin-menu-surface-board">
        <div className="admin-menu-surface-board-head">
          <div className="min-w-0">
            <h3 className="admin-menu-surface-board-title">Modifier options</h3>
            <p className="admin-menu-surface-board-desc">
              Choices guests pick inside a group — name, extra price, and availability.
            </p>
          </div>
          <div className="admin-menu-surface-board-actions">
            {canManage ? (
              <MenuToolbarButton onClick={() => setManageOpen(true)}>
                {hasSelection ? "Manage selected" : "Manage"}
              </MenuToolbarButton>
            ) : null}
            {can("modifier_option", "create") ? (
              <MenuToolbarButton primary onClick={() => setCreateOpen(true)}>
                Create
              </MenuToolbarButton>
            ) : null}
          </div>
        </div>

        {options.length > 0 ? (
          <MenuListSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search modifier options by name, group, or item…"
            aria-label="Search modifier options"
            filterGroups={MODIFIER_OPTION_LIST_QUERY.filterGroups}
            sortOptions={MODIFIER_OPTION_LIST_QUERY.sortOptions}
            defaultSort={MODIFIER_OPTION_LIST_QUERY.defaultSort}
            activeFilters={activeFilters}
            activeSort={activeSort}
            totalCount={options.length}
            resultCount={filtered.length}
            onFiltersChange={setActiveFilters}
            onSortChange={setActiveSort}
            filterTitle="Filter modifier options"
            sortTitle="Sort modifier options"
          />
        ) : null}

        {options.length === 0 ? (
          <AdminEmptyState>No modifier options yet — add Small, Medium, Large, or similar choices.</AdminEmptyState>
        ) : filtered.length === 0 ? (
          <p className="admin-config-text-muted py-2 text-sm">No modifier options match your search or filters.</p>
        ) : (
          <>
            <label className="admin-menu-surface-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="admin-menu-surface-checkbox"
                checked={allPageSelected}
                aria-label="Select all modifier options on this page"
                onChange={(e) => toggleSelectAllPage(e.target.checked)}
              />
              <span className="admin-menu-surface-select-all-label">Select all on page</span>
            </label>

            <ul className={`admin-menu-surface-list ${pager.pageClassName}`} key={pager.pageKey}>
              {pager.pagedItems.map((option, index) => {
                const hasOtherGroups = modalGroups.some(
                  (g) => g.id !== option.groupId && !isUiOnlyListId(g.id)
                );
                const actions = optionRowActions(option, can, hasOtherGroups);
                const isSelected = selectedIds.has(option.id);
                const uiOnly = isUiOnlyListId(option.id);
                const stats = [
                  option.groupName,
                  option.itemName,
                  option.priceDeltaCents ? `+${formatMoneyCents(option.priceDeltaCents)}` : "No extra"
                ].join(" · ");
                return (
                  <li
                    key={option.id}
                    className="admin-menu-surface-list-item"
                    style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                  >
                    <div className={`admin-menu-surface-card${isSelected ? " is-selected" : ""}`}>
                      <label className="admin-menu-surface-checkbox-wrap">
                        <input
                          type="checkbox"
                          className="admin-menu-surface-checkbox"
                          checked={isSelected}
                          disabled={uiOnly}
                          aria-label={uiOnly ? `${option.name} (preview only)` : `Select ${option.name}`}
                          onChange={(e) => toggleSelection(option.id, e.target.checked)}
                        />
                      </label>

                      <span className={`admin-menu-surface-status ${modifierOptionStatusClass(option)}`}>
                        {modifierOptionStatusLabel(option)}
                      </span>

                      <div className="admin-menu-surface-main">
                        <span className="admin-menu-surface-name">{option.name}</span>
                        <span className="admin-menu-surface-sep" aria-hidden>
                          ·
                        </span>
                        <span className="admin-menu-surface-desc">In {option.groupName}</span>
                        <span className="admin-menu-surface-sep" aria-hidden>
                          ·
                        </span>
                        <span className="admin-menu-surface-meta">{stats}</span>
                      </div>

                      <div className="admin-menu-surface-actions">
                        {actions.length > 0 ? (
                          <MenuEntityActionsMenu
                            entityName={option.name}
                            hideHeader
                            open={openActionsId === option.id}
                            actions={actions}
                            onToggle={() => setOpenActionsId((id) => (id === option.id ? null : option.id))}
                            onAction={(actionId) => handleAction(option, actionId)}
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {pager.showPagination ? (
              <MenuSurfacePagination
                page={pager.page}
                totalPages={pager.totalPages}
                totalItems={pager.totalItems}
                pageSize={pager.pageSize}
                onPageChange={pager.goToPage}
                label="Modifier options pagination"
              />
            ) : null}
          </>
        )}
      </div>

      <ModifierOptionManageDrawer
        open={manageOpen}
        options={options}
        selectedIds={selectedIds}
        groups={modalGroups}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        onClose={() => setManageOpen(false)}
        onRefresh={() => api.refresh()}
        onClearSelection={() => setSelectedIds(new Set())}
        onEditOption={openEdit}
        onPreview={(option) => void handlePreview(option)}
      />

      <CreateModifierOptionModal
        open={createOpen}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        groups={modalGroups}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          pushToast("Modifier option created.", "success");
          api.refresh();
        }}
        onNavigateTab={onNavigateTab}
      />

      <EditModifierOptionModal
        open={editOpen}
        target={editTarget}
        canEdit={can("modifier_option", "edit")}
        token={token}
        restaurantId={restaurantId}
        onClose={() => {
          setEditOpen(false);
          setEditTarget(null);
        }}
        onSaved={() => {
          pushToast("Modifier option updated.", "success");
          api.refresh();
        }}
      />

      <ModifierGroupProfileDrawer
        group={groupDetailsTarget}
        open={groupDetailsOpen}
        venueName={venueName}
        onClose={() => {
          setGroupDetailsOpen(false);
          setGroupDetailsTarget(null);
        }}
      />

      <ModifierOptionProfileDrawer
        option={optionDetailsTarget}
        open={optionDetailsOpen}
        venueName={venueName}
        onClose={() => {
          setOptionDetailsOpen(false);
          setOptionDetailsTarget(null);
        }}
      />

      <MenuPageModalShell
        open={Boolean(moveOption)}
        onClose={moveBusy ? () => undefined : () => setMoveOption(null)}
        title="Move group"
        description={
          moveOption
            ? `Move “${moveOption.name}” from ${moveOption.groupName} into another group.`
            : "Choose a destination modifier group."
        }
        titleId="mod-option-row-move-title"
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

      <DuplicateEntityModal
        open={Boolean(duplicateTarget)}
        kind="modifier_option"
        sourceId={duplicateTarget?.id ?? ""}
        sourceName={duplicateTarget?.name ?? "Modifier option"}
        token={token}
        restaurantId={restaurantId}
        onClose={() => setDuplicateTarget(null)}
        onDuplicated={(result) => {
          pushToast(`“${result.name}” created as a draft copy.`, "success");
          api.refresh();
        }}
      />

      <MenuActionConfirmModal
        open={Boolean(pendingAction && confirmCopy)}
        title={confirmCopy?.title ?? ""}
        description={confirmCopy?.description ?? ""}
        confirmLabel={confirmCopy?.confirmLabel}
        titleId={confirmCopy?.titleId}
        danger={confirmCopy?.danger}
        busy={confirmBusy}
        onClose={closeConfirm}
        onConfirm={() => void runConfirmedAction()}
      />
    </>
  );
}
