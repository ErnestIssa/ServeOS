import { useEffect, useMemo, useRef, useState } from "react";
import {
  attachModifierGroup,
  createOrderingSession,
  deleteModifierGroup,
  type MenuCapabilitiesPayload
} from "../../../api";
import { AdminEmptyState } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import type { MenuSectionTab } from "../configRouting";
import type { useAdminMenu } from "../useAdminMenu";
import { CreateModifierGroupModal } from "./CreateModifierGroupModal";
import { DuplicateEntityModal } from "./DuplicateEntityModal";
import { EditModifierGroupModal, type EditModifierGroupTarget } from "./EditModifierGroupModal";
import { MenuActionConfirmModal } from "./MenuActionConfirmModal";
import { MenuEntityActionsMenu } from "./MenuEntityActionsMenu";
import { isUiOnlyListId, matchesListSearch, UI_MOCK_MODIFIER_GROUPS } from "./menuListUiMocks";
import {
  applyModifierGroupListFilters,
  applyModifierGroupListSort,
  MODIFIER_GROUP_LIST_QUERY
} from "./menuListQuery";
import { MenuListSearchField, MenuToolbarButton } from "./MenuPageUi";
import { MenuPageModalShell, ProfileModalFooter } from "./menuPageModalShell";
import { MenuSurfacePagination } from "./MenuSurfacePagination";
import {
  modifierGroupStatusClass,
  modifierGroupStatusLabel,
  type ModifierGroupListRow
} from "./modifierGroupListHelpers";
import { ModifierGroupManageDrawer } from "./ModifierGroupManageDrawer";
import { ModifierGroupProfileDrawer } from "./ModifierGroupProfileDrawer";
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
  group: ModifierGroupListRow;
  actionId: string;
};

function groupRowActions(
  group: ModifierGroupListRow,
  can: Props["can"],
  hasAttachTargets: boolean
) {
  const actions: Array<{ id: string; label: string; danger?: boolean }> = [];
  const isAttached = Boolean(group.itemId);

  if (can("modifier_group", "view") || can("modifier_group", "edit")) {
    actions.push({ id: "group-details", label: "Group details" });
  }
  if (can("modifier_group", "create")) {
    actions.push({ id: "duplicate", label: "Duplicate" });
  }
  // Attach when other items can still receive this group; Detach when linked to a current item.
  if (can("modifier_group", "create") && hasAttachTargets) {
    actions.push({ id: "attach", label: "Attach to items" });
  }
  if (can("modifier_group", "delete") && isAttached) {
    actions.push({ id: "detach", label: "Detach from items" });
  }
  actions.push({ id: "preview", label: "Preview" });
  return actions;
}

const DIRECT_OPEN_ACTIONS = new Set(["group-details", "preview", "attach", "duplicate"]);

function confirmCopyForAction(action: PendingRowAction) {
  const name = action.group.name;
  switch (action.actionId) {
    case "detach":
      return {
        title: "Detach from item?",
        description: `Remove “${name}” from ${action.group.itemName}.`,
        confirmLabel: "Detach",
        danger: true,
        titleId: "mod-group-confirm-detach"
      };
    default:
      return {
        title: "Confirm action?",
        description: `Continue with this action for “${name}”?`,
        confirmLabel: "Confirm",
        danger: false,
        titleId: "mod-group-confirm-action"
      };
  }
}

function toEditTarget(group: ModifierGroupListRow): EditModifierGroupTarget {
  return {
    id: group.id,
    name: group.name,
    itemId: group.itemId,
    itemName: group.itemName,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect
  };
}

export function AdminModifierGroupsTabPanel({
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
  const [editTarget, setEditTarget] = useState<EditModifierGroupTarget | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsGroup, setDetailsGroup] = useState<ModifierGroupListRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(MODIFIER_GROUP_LIST_QUERY.defaultSort);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingRowAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<ModifierGroupListRow | null>(null);

  const [attachGroup, setAttachGroup] = useState<ModifierGroupListRow | null>(null);
  const [attachItemIds, setAttachItemIds] = useState<Set<string>>(() => new Set());
  const [attachBusy, setAttachBusy] = useState(false);

  const groups = useMemo(
    () => [...api.flatModifierGroups, ...UI_MOCK_MODIFIER_GROUPS],
    [api.flatModifierGroups]
  );

  const realGroups = useMemo(() => groups.filter((g) => !isUiOnlyListId(g.id)), [groups]);

  const modalItems = useMemo(
    () => api.flatItems.map((i) => ({ id: i.id, name: i.name, categoryName: i.categoryName })),
    [api.flatItems]
  );

  const filtered = useMemo(() => {
    const searched = groups.filter((g) =>
      matchesListSearch(
        searchQuery,
        g.name,
        g.itemName,
        g.minSelect,
        g.maxSelect,
        g.optionCount,
        modifierGroupStatusLabel(g)
      )
    );
    return applyModifierGroupListSort(
      applyModifierGroupListFilters(searched, activeFilters),
      activeSort
    );
  }, [groups, searchQuery, activeFilters, activeSort]);

  const pager = useMenuListPagination(filtered, {
    resetKey: `${searchQuery.trim().toLowerCase()}:${activeFilters.join(",")}:${activeSort}`
  });

  const selectablePaged = useMemo(
    () => pager.pagedItems.filter((g) => !isUiOnlyListId(g.id)),
    [pager.pagedItems]
  );

  const allPageSelected =
    selectablePaged.length > 0 && selectablePaged.every((g) => selectedIds.has(g.id));
  const somePageSelected = selectablePaged.some((g) => selectedIds.has(g.id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = somePageSelected && !allPageSelected;
  }, [somePageSelected, allPageSelected]);

  useEffect(() => {
    if (!attachGroup) {
      setAttachItemIds(new Set());
      setAttachBusy(false);
    }
  }, [attachGroup]);

  const attachCandidates = useMemo(() => {
    if (!attachGroup) return [];
    return modalItems.filter((item) => item.id !== attachGroup.itemId);
  }, [attachGroup, modalItems]);

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
      for (const g of selectablePaged) {
        if (checked) next.add(g.id);
        else next.delete(g.id);
      }
      return next;
    });
  };

  const toastPreview = () => pushToast("Preview group only — not connected to the backend.", "error");

  const openEdit = (group: ModifierGroupListRow) => {
    if (isUiOnlyListId(group.id)) {
      toastPreview();
      return;
    }
    setEditTarget(toEditTarget(group));
    setEditOpen(true);
  };

  const openGroupDetails = (group: ModifierGroupListRow) => {
    setDetailsGroup(group);
    setDetailsOpen(true);
  };

  const handlePreview = async (group: ModifierGroupListRow) => {
    if (previewBusy) return;
    if (isUiOnlyListId(group.id)) {
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

  const runDirectAction = (group: ModifierGroupListRow, actionId: string) => {
    if (actionId === "group-details") {
      openGroupDetails(group);
      return;
    }
    if (actionId === "preview") {
      void handlePreview(group);
      return;
    }
    if (actionId === "attach") {
      if (isUiOnlyListId(group.id)) {
        toastPreview();
        return;
      }
      setAttachGroup(group);
      return;
    }
    if (actionId === "duplicate") {
      if (isUiOnlyListId(group.id)) {
        toastPreview();
        return;
      }
      setDuplicateTarget(group);
    }
  };

  const handleAction = (group: ModifierGroupListRow, actionId: string) => {
    setOpenActionsId(null);
    if (DIRECT_OPEN_ACTIONS.has(actionId)) {
      runDirectAction(group, actionId);
      return;
    }
    if (isUiOnlyListId(group.id)) {
      toastPreview();
      return;
    }
    setPendingAction({ group, actionId });
  };

  const closeConfirm = () => {
    if (confirmBusy) return;
    setPendingAction(null);
  };

  const runConfirmedAction = async () => {
    if (!pendingAction) return;
    const { group, actionId } = pendingAction;
    setConfirmBusy(true);

    if (actionId === "detach") {
      const res = await deleteModifierGroup(token, restaurantId, group.id);
      setConfirmBusy(false);
      if (!res.ok) {
        pushToast(res.message ?? res.error ?? "Could not detach group.", "error");
        return;
      }
      pushToast("Modifier group detached.", "success");
      api.refresh();
      setPendingAction(null);
      return;
    }

    setConfirmBusy(false);
    setPendingAction(null);
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
    api.refresh();
    setAttachGroup(null);
  };

  const hasSelection = selectedIds.size > 0;
  const canManage = realGroups.length > 0;
  const confirmCopy = pendingAction ? confirmCopyForAction(pendingAction) : null;

  return (
    <>
      <div className="admin-menu-surface-board">
        <div className="admin-menu-surface-board-head">
          <div className="min-w-0">
            <h3 className="admin-menu-surface-board-title">Modifier groups</h3>
            <p className="admin-menu-surface-board-desc">
              Examples: Choose Size, Choose Bread — attach options guests pick with an item.
            </p>
          </div>
          <div className="admin-menu-surface-board-actions">
            {canManage ? (
              <MenuToolbarButton onClick={() => setManageOpen(true)}>
                {hasSelection ? "Manage selected" : "Manage"}
              </MenuToolbarButton>
            ) : null}
            {can("modifier_group", "create") ? (
              <MenuToolbarButton primary onClick={() => setCreateOpen(true)}>
                Create
              </MenuToolbarButton>
            ) : null}
          </div>
        </div>

        {groups.length > 0 ? (
          <MenuListSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search modifier groups by name or item…"
            aria-label="Search modifier groups"
            filterGroups={MODIFIER_GROUP_LIST_QUERY.filterGroups}
            sortOptions={MODIFIER_GROUP_LIST_QUERY.sortOptions}
            defaultSort={MODIFIER_GROUP_LIST_QUERY.defaultSort}
            activeFilters={activeFilters}
            activeSort={activeSort}
            totalCount={groups.length}
            resultCount={filtered.length}
            onFiltersChange={setActiveFilters}
            onSortChange={setActiveSort}
            filterTitle="Filter modifier groups"
            sortTitle="Sort modifier groups"
          />
        ) : null}

        {groups.length === 0 ? (
          <AdminEmptyState>No modifier groups yet — add Choose Size or Choose Bread to an item.</AdminEmptyState>
        ) : filtered.length === 0 ? (
          <p className="admin-config-text-muted py-2 text-sm">No modifier groups match your search or filters.</p>
        ) : (
          <>
            <label className="admin-menu-surface-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="admin-menu-surface-checkbox"
                checked={allPageSelected}
                aria-label="Select all modifier groups on this page"
                onChange={(e) => toggleSelectAllPage(e.target.checked)}
              />
              <span className="admin-menu-surface-select-all-label">Select all on page</span>
            </label>

            <ul className={`admin-menu-surface-list ${pager.pageClassName}`} key={pager.pageKey}>
              {pager.pagedItems.map((group, index) => {
                const hasAttachTargets = modalItems.some((item) => item.id !== group.itemId);
                const actions = groupRowActions(group, can, hasAttachTargets);
                const isSelected = selectedIds.has(group.id);
                const uiOnly = isUiOnlyListId(group.id);
                const stats = [
                  group.itemName,
                  `min ${group.minSelect}`,
                  `max ${group.maxSelect}`,
                  `${group.optionCount} options`
                ].join(" · ");
                return (
                  <li
                    key={group.id}
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
                          aria-label={uiOnly ? `${group.name} (preview only)` : `Select ${group.name}`}
                          onChange={(e) => toggleSelection(group.id, e.target.checked)}
                        />
                      </label>

                      <span className={`admin-menu-surface-status ${modifierGroupStatusClass(group)}`}>
                        {modifierGroupStatusLabel(group)}
                      </span>

                      <div className="admin-menu-surface-main">
                        <span className="admin-menu-surface-name">{group.name}</span>
                        <span className="admin-menu-surface-sep" aria-hidden>
                          ·
                        </span>
                        <span className="admin-menu-surface-desc">On {group.itemName}</span>
                        <span className="admin-menu-surface-sep" aria-hidden>
                          ·
                        </span>
                        <span className="admin-menu-surface-meta">{stats}</span>
                      </div>

                      <div className="admin-menu-surface-actions">
                        {actions.length > 0 ? (
                          <MenuEntityActionsMenu
                            entityName={group.name}
                            hideHeader
                            open={openActionsId === group.id}
                            actions={actions}
                            onToggle={() => setOpenActionsId((id) => (id === group.id ? null : group.id))}
                            onAction={(actionId) => handleAction(group, actionId)}
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
                label="Modifier groups pagination"
              />
            ) : null}
          </>
        )}
      </div>

      <ModifierGroupManageDrawer
        open={manageOpen}
        groups={groups}
        selectedIds={selectedIds}
        items={modalItems}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        onClose={() => setManageOpen(false)}
        onRefresh={() => api.refresh()}
        onClearSelection={() => setSelectedIds(new Set())}
        onEditGroup={openEdit}
        onPreview={(group) => void handlePreview(group)}
      />

      <ModifierGroupProfileDrawer
        group={detailsGroup}
        open={detailsOpen}
        venueName={venueName}
        onClose={() => {
          setDetailsOpen(false);
          setDetailsGroup(null);
        }}
      />

      <CreateModifierGroupModal
        open={createOpen}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        items={modalItems}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          pushToast("Modifier group created.", "success");
          api.refresh();
        }}
        onNavigateTab={onNavigateTab}
      />

      <EditModifierGroupModal
        open={editOpen}
        target={editTarget}
        canEdit={can("modifier_group", "edit")}
        token={token}
        restaurantId={restaurantId}
        onClose={() => {
          setEditOpen(false);
          setEditTarget(null);
        }}
        onSaved={() => {
          pushToast("Modifier group updated.", "success");
          api.refresh();
        }}
      />

      <MenuPageModalShell
        open={Boolean(attachGroup)}
        onClose={attachBusy ? () => undefined : () => setAttachGroup(null)}
        title="Attach to items"
        description={
          attachGroup
            ? `Copy “${attachGroup.name}” onto other items.`
            : "Choose items to attach this group to."
        }
        titleId="mod-group-row-attach-title"
      >
        {attachCandidates.length === 0 ? (
          <p className="admin-config-text-muted text-sm">No other items available to attach to.</p>
        ) : (
          <ul className="admin-menu-manage-scope-list max-h-64 overflow-y-auto" aria-label="Items">
            {attachCandidates.map((item) => (
              <li key={item.id}>
                <label className="admin-menu-surface-select-all">
                  <input
                    type="checkbox"
                    className="admin-menu-surface-checkbox"
                    checked={attachItemIds.has(item.id)}
                    disabled={attachBusy}
                    onChange={(e) => toggleAttachItem(item.id, e.target.checked)}
                  />
                  <span className="admin-menu-surface-select-all-label">
                    {item.name}
                    <span className="admin-config-text-muted"> · {item.categoryName}</span>
                  </span>
                </label>
              </li>
            ))}
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

      <DuplicateEntityModal
        open={Boolean(duplicateTarget)}
        kind="modifier_group"
        sourceId={duplicateTarget?.id ?? ""}
        sourceName={duplicateTarget?.name ?? "Modifier group"}
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
