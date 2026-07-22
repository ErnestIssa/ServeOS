import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import {
  createOrderingSession,
  updateMenuItem,
  type MenuCapabilitiesPayload,
  type MenuSurfaceRow,
  type MenuTree
} from "../../../api";
import { buildNavHref, syncAdminNavHash } from "../../adminWorkspaceRouting";
import { AdminEmptyState } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import type { MenuSectionTab } from "../configRouting";
import type { useAdminMenu } from "../useAdminMenu";
import {
  toCategoryListRow,
  type CategoryListRow
} from "./categoryListHelpers";
import { CategoryProfileDrawer } from "./CategoryProfileDrawer";
import { CreateItemModal, type EditItemTarget } from "./CreateItemModal";
import { CreateModifierGroupModal } from "./CreateModifierGroupModal";
import { DuplicateEntityModal } from "./DuplicateEntityModal";
import {
  enrichItemRow,
  itemStatusClass,
  itemStatusLabel,
  type ItemListRow
} from "./itemListHelpers";
import { ItemManageDrawer } from "./ItemManageDrawer";
import { MenuActionConfirmModal } from "./MenuActionConfirmModal";
import { MenuEntityActionsMenu } from "./MenuEntityActionsMenu";
import { MenuItemProfileDrawer } from "./MenuItemProfileDrawer";
import { isUiOnlyListId, matchesListSearch, UI_MOCK_CATEGORIES, UI_MOCK_ITEMS } from "./menuListUiMocks";
import {
  applyItemListFilters,
  applyItemListSort,
  ITEM_LIST_QUERY
} from "./menuListQuery";
import { MenuListSearchField, MenuToolbarButton } from "./MenuPageUi";
import { MenuSurfacePagination } from "./MenuSurfacePagination";
import { useMenuListPagination } from "./useMenuListPagination";

type Props = {
  api: ReturnType<typeof useAdminMenu>;
  token: string;
  restaurantId: string;
  venueName: string;
  menus: MenuSurfaceRow[];
  can: (entity: keyof MenuCapabilitiesPayload["entities"], action: string) => boolean;
  capabilities?: MenuCapabilitiesPayload | null;
  onNavigateTab: (tab: MenuSectionTab) => void;
};

type PendingRowAction = {
  item: ItemListRow;
  actionId: string;
};

function itemRowActions(item: ItemListRow, can: Props["can"]) {
  const actions: Array<{ id: string; label: string; danger?: boolean }> = [];
  if (can("item", "view") || can("item", "edit")) {
    actions.push({ id: "item-details", label: "Item details" });
  }
  if (can("category", "view") || can("category", "edit")) {
    actions.push({ id: "category-details", label: "Category details" });
  }
  if (can("item", "create")) {
    actions.push({ id: "duplicate", label: "Duplicate" });
    actions.push({ id: "duplicate-to", label: "Duplicate to…" });
  }
  if (can("item", "edit")) {
    actions.push({
      id: item.isActive ? "hide" : "show",
      label: item.isActive ? "Hide item" : "Show item"
    });
  }
  if (can("item", "edit")) {
    actions.push({ id: "details", label: "Add description & ingredients" });
  }
  if (can("media", "view")) {
    actions.push({ id: "media", label: "Open Images tab" });
  }
  return actions;
}

function confirmCopyForAction(action: PendingRowAction) {
  const name = action.item.name;
  switch (action.actionId) {
    case "hide":
      return {
        title: "Hide item?",
        description: `“${name}” will be hidden from guests until you show it again.`,
        confirmLabel: "Hide item",
        danger: true,
        titleId: "item-confirm-hide"
      };
    case "show":
      return {
        title: "Show item?",
        description: `“${name}” will become visible to guests when its menu is live.`,
        confirmLabel: "Show item",
        danger: false,
        titleId: "item-confirm-show"
      };
    default:
      return {
        title: "Confirm action?",
        description: `Continue with this action for “${name}”?`,
        confirmLabel: "Confirm",
        danger: false,
        titleId: "item-confirm-action"
      };
  }
}

/** Opens a screen/modal immediately — no confirm step. */
const DIRECT_OPEN_ACTIONS = new Set([
  "item-details",
  "category-details",
  "details",
  "media",
  "duplicate",
  "duplicate-to"
]);

function toEditTarget(item: ItemListRow): EditItemTarget {
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    priceCents: item.priceCents,
    description: item.description,
    ingredients: item.ingredients,
    specialNotes: item.specialNotes
  };
}

function resolveCategoryRow(
  categoryId: string,
  treeCategories: MenuTree["categories"],
  menus: MenuSurfaceRow[]
): CategoryListRow | null {
  const fromTree = treeCategories.find((c) => c.id === categoryId);
  if (fromTree) return toCategoryListRow(fromTree, menus);
  const fromMock = UI_MOCK_CATEGORIES.find((c) => c.id === categoryId);
  if (fromMock) {
    return toCategoryListRow(fromMock as MenuTree["categories"][number], menus);
  }
  return null;
}

export function AdminItemsTabPanel({
  api,
  token,
  restaurantId,
  venueName,
  menus,
  can,
  capabilities = null,
  onNavigateTab
}: Props) {
  const { pushToast } = useAdminToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditItemTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(ITEM_LIST_QUERY.defaultSort);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [categoryDetailsOpen, setCategoryDetailsOpen] = useState(false);
  const [detailsCategory, setDetailsCategory] = useState<CategoryListRow | null>(null);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [itemDrawerItem, setItemDrawerItem] = useState<ItemListRow | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingRowAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [createModifierGroupOpen, setCreateModifierGroupOpen] = useState(false);
  const [modifierInitialItemId, setModifierInitialItemId] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<ItemListRow | null>(null);
  const [duplicateToMode, setDuplicateToMode] = useState(false);

  const treeCategories = api.menu?.categories ?? [];

  const items = useMemo(() => {
    const real = api.flatItems.map((i) => enrichItemRow(i, menus));
    const mocks = UI_MOCK_ITEMS.map((i) => enrichItemRow(i, menus));
    return [...real, ...mocks];
  }, [api.flatItems, menus]);

  const realItems = useMemo(() => items.filter((i) => !isUiOnlyListId(i.id)), [items]);

  const itemCategories = useMemo(
    () =>
      treeCategories.map((c) => ({
        id: c.id,
        name: c.name,
        menuId: c.menuId ?? null
      })),
    [treeCategories]
  );

  const modalItems = useMemo(
    () => realItems.map((i) => ({ id: i.id, name: i.name, categoryName: i.categoryName })),
    [realItems]
  );

  const filtered = useMemo(() => {
    const searched = items.filter((i) =>
      matchesListSearch(
        searchQuery,
        i.name,
        i.description,
        i.categoryName,
        i.menuName,
        itemStatusLabel(i),
        formatMoneyCents(i.priceCents),
        i.modifierCount
      )
    );
    return applyItemListSort(applyItemListFilters(searched, activeFilters), activeSort);
  }, [items, searchQuery, activeFilters, activeSort]);

  const pager = useMenuListPagination(filtered, {
    resetKey: `${searchQuery.trim().toLowerCase()}:${activeFilters.join(",")}:${activeSort}`
  });

  const selectablePaged = useMemo(
    () => pager.pagedItems.filter((i) => !isUiOnlyListId(i.id)),
    [pager.pagedItems]
  );

  const allPageSelected =
    selectablePaged.length > 0 && selectablePaged.every((i) => selectedIds.has(i.id));
  const somePageSelected = selectablePaged.some((i) => selectedIds.has(i.id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = somePageSelected && !allPageSelected;
  }, [somePageSelected, allPageSelected]);

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
      for (const i of selectablePaged) {
        if (checked) next.add(i.id);
        else next.delete(i.id);
      }
      return next;
    });
  };

  const toastPreview = () => pushToast("Preview item only — not connected to the backend.", "error");

  const setVisibility = async (item: ItemListRow, isActive: boolean) => {
    if (isUiOnlyListId(item.id)) {
      toastPreview();
      return false;
    }
    const res = await updateMenuItem(token, restaurantId, item.id, { isActive });
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Could not update item", "error");
      return false;
    }
    pushToast(isActive ? `“${item.name}” is visible.` : `“${item.name}” is hidden.`, "success");
    api.refresh();
    return true;
  };

  const openEditDetails = (item: ItemListRow) => {
    setEditTarget(toEditTarget(item));
    setEditOpen(true);
  };

  const runDirectAction = (item: ItemListRow, actionId: string) => {
    if (actionId === "item-details") {
      setItemDrawerItem(item);
      setItemDrawerOpen(true);
      return;
    }

    if (actionId === "category-details") {
      const category = resolveCategoryRow(item.categoryId, treeCategories, menus);
      if (!category) {
        pushToast("Couldn’t find this item’s category.", "error");
        return;
      }
      setDetailsCategory(category);
      setCategoryDetailsOpen(true);
      return;
    }

    if (actionId === "details") {
      if (isUiOnlyListId(item.id)) {
        toastPreview();
        return;
      }
      openEditDetails(item);
      return;
    }

    if (actionId === "media") {
      onNavigateTab("images");
      return;
    }

    if (actionId === "duplicate" || actionId === "duplicate-to") {
      if (isUiOnlyListId(item.id)) {
        toastPreview();
        return;
      }
      setDuplicateToMode(actionId === "duplicate-to");
      setDuplicateTarget(item);
    }
  };

  const handleAction = (item: ItemListRow, actionId: string) => {
    setOpenActionsId(null);
    if (DIRECT_OPEN_ACTIONS.has(actionId)) {
      runDirectAction(item, actionId);
      return;
    }
    if (isUiOnlyListId(item.id)) {
      toastPreview();
      return;
    }
    setPendingAction({ item, actionId });
  };

  const closeConfirm = () => {
    if (confirmBusy) return;
    setPendingAction(null);
  };

  const runConfirmedAction = async () => {
    if (!pendingAction) return;
    const { item, actionId } = pendingAction;

    if (actionId === "hide" || actionId === "show") {
      setConfirmBusy(true);
      const ok = await setVisibility(item, actionId === "show");
      setConfirmBusy(false);
      if (ok) setPendingAction(null);
    }
  };

  const handlePreview = async (item: ItemListRow) => {
    if (previewBusy) return;
    if (isUiOnlyListId(item.id)) {
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

  const handleAddModifiers = (item: ItemListRow) => {
    if (isUiOnlyListId(item.id)) {
      toastPreview();
      return;
    }
    setModifierInitialItemId(item.id);
    setCreateModifierGroupOpen(true);
  };

  const handleViewOrderHistory = (item: ItemListRow) => {
    syncAdminNavHash(
      `${buildNavHref("orders", "order-history")}?itemId=${encodeURIComponent(item.id)}`
    );
  };

  const hasSelection = selectedIds.size > 0;
  const canManage = realItems.length > 0;
  const confirmCopy = pendingAction ? confirmCopyForAction(pendingAction) : null;
  const duplicateDestinations = useMemo(
    () =>
      treeCategories
        .filter((c) => {
          if (!c.menuId) return true;
          const menu = menus.find((m) => m.id === c.menuId);
          return !menu || menu.status !== "ARCHIVED";
        })
        .map((c) => ({
          id: c.id,
          label: c.name,
          hint: c.menuId ? menus.find((m) => m.id === c.menuId)?.name : undefined
        })),
    [treeCategories, menus]
  );

  return (
    <>
      <div className="admin-menu-surface-board">
        <div className="admin-menu-surface-board-head">
          <div className="min-w-0">
            <h3 className="admin-menu-surface-board-title">Items</h3>
            <p className="admin-menu-surface-board-desc">
              Dishes and drinks guests order — priced, categorized, and ready for modifiers.
            </p>
          </div>
          <div className="admin-menu-surface-board-actions">
            {canManage ? (
              <MenuToolbarButton onClick={() => setManageOpen(true)}>
                {hasSelection ? "Manage selected" : "Manage"}
              </MenuToolbarButton>
            ) : null}
            {can("item", "create") ? (
              <MenuToolbarButton primary onClick={() => setCreateOpen(true)}>
                Create
              </MenuToolbarButton>
            ) : null}
          </div>
        </div>

        {items.length > 0 ? (
          <MenuListSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search items by name, category, or status…"
            aria-label="Search items"
            filterGroups={ITEM_LIST_QUERY.filterGroups}
            sortOptions={ITEM_LIST_QUERY.sortOptions}
            defaultSort={ITEM_LIST_QUERY.defaultSort}
            activeFilters={activeFilters}
            activeSort={activeSort}
            totalCount={items.length}
            resultCount={filtered.length}
            onFiltersChange={setActiveFilters}
            onSortChange={setActiveSort}
            filterTitle="Filter items"
            sortTitle="Sort items"
          />
        ) : null}

        {items.length === 0 ? (
          <AdminEmptyState>No items yet — add products to populate your menu.</AdminEmptyState>
        ) : filtered.length === 0 ? (
          <p className="admin-config-text-muted py-2 text-sm">No items match your search or filters.</p>
        ) : (
          <>
            <label className="admin-menu-surface-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="admin-menu-surface-checkbox"
                checked={allPageSelected}
                aria-label="Select all items on this page"
                onChange={(e) => toggleSelectAllPage(e.target.checked)}
              />
              <span className="admin-menu-surface-select-all-label">Select all on page</span>
            </label>

            <ul className={`admin-menu-surface-list ${pager.pageClassName}`} key={pager.pageKey}>
              {pager.pagedItems.map((item, index) => {
                const actions = itemRowActions(item, can);
                const isSelected = selectedIds.has(item.id);
                const uiOnly = isUiOnlyListId(item.id);
                const stats = [
                  formatMoneyCents(item.priceCents),
                  item.categoryName,
                  `${item.modifierCount} modifiers`
                ].join(" · ");
                return (
                  <li
                    key={item.id}
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
                          aria-label={uiOnly ? `${item.name} (preview only)` : `Select ${item.name}`}
                          onChange={(e) => toggleSelection(item.id, e.target.checked)}
                        />
                      </label>

                      <span className={`admin-menu-surface-status ${itemStatusClass(item)}`}>
                        {itemStatusLabel(item)}
                      </span>

                      <div className="admin-menu-surface-main">
                        <span className="admin-menu-surface-name">{item.name}</span>
                        <span className="admin-menu-surface-sep" aria-hidden>
                          ·
                        </span>
                        <span className="admin-menu-surface-desc">
                          {item.description?.trim() || `Item in ${item.categoryName}`}
                        </span>
                        <span className="admin-menu-surface-sep" aria-hidden>
                          ·
                        </span>
                        <span className="admin-menu-surface-meta">{stats}</span>
                      </div>

                      <div className="admin-menu-surface-actions">
                        <MenuEntityActionsMenu
                          entityName={item.name}
                          hideHeader
                          open={openActionsId === item.id}
                          actions={actions}
                          onToggle={() => setOpenActionsId((id) => (id === item.id ? null : item.id))}
                          onAction={(actionId) => handleAction(item, actionId)}
                        />
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
                label="Items pagination"
              />
            ) : null}
          </>
        )}
      </div>

      <CategoryProfileDrawer
        category={detailsCategory}
        open={categoryDetailsOpen}
        venueName={venueName}
        onClose={() => {
          setCategoryDetailsOpen(false);
          setDetailsCategory(null);
        }}
      />

      <MenuItemProfileDrawer
        item={itemDrawerItem}
        open={itemDrawerOpen}
        venueName={venueName}
        onClose={() => {
          setItemDrawerOpen(false);
          setItemDrawerItem(null);
        }}
        onNavigateTab={onNavigateTab}
      />

      <ItemManageDrawer
        open={manageOpen}
        items={items}
        selectedIds={selectedIds}
        menus={menus}
        categories={itemCategories}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        onClose={() => setManageOpen(false)}
        onRefresh={() => api.refresh()}
        onClearSelection={() => setSelectedIds(new Set())}
        onEditItem={(item) => openEditDetails(item)}
        onAddModifiers={handleAddModifiers}
        onPreview={(item) => void handlePreview(item)}
        onViewOrderHistory={handleViewOrderHistory}
      />

      <CreateItemModal
        open={createOpen}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        categories={itemCategories}
        menus={menus}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          pushToast("Item created.", "success");
          api.refresh();
        }}
        onNavigateTab={onNavigateTab}
      />

      <CreateItemModal
        mode="edit-details"
        open={editOpen}
        editTarget={editTarget}
        canEdit={can("item", "edit")}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        categories={itemCategories}
        menus={menus}
        onClose={() => {
          setEditOpen(false);
          setEditTarget(null);
        }}
        onCreated={() => undefined}
        onSaved={() => {
          pushToast("Item details saved.", "success");
          api.refresh();
        }}
        onNavigateTab={onNavigateTab}
      />

      <CreateModifierGroupModal
        open={createModifierGroupOpen}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        items={modalItems}
        initialItemId={modifierInitialItemId}
        onClose={() => {
          setCreateModifierGroupOpen(false);
          setModifierInitialItemId(null);
        }}
        onCreated={() => {
          pushToast("Modifier group created.", "success");
          api.refresh();
        }}
        onNavigateTab={onNavigateTab}
      />

      <DuplicateEntityModal
        open={Boolean(duplicateTarget)}
        kind="item"
        sourceId={duplicateTarget?.id ?? ""}
        sourceName={duplicateTarget?.name ?? "Item"}
        token={token}
        restaurantId={restaurantId}
        destinations={duplicateDestinations}
        defaultDestinationId={duplicateTarget?.categoryId ?? null}
        allowChangeDestination={duplicateToMode}
        onClose={() => {
          setDuplicateTarget(null);
          setDuplicateToMode(false);
        }}
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
