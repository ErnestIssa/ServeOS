import { useEffect, useMemo, useRef, useState } from "react";
import {
  updateCategory,
  type MenuCapabilitiesPayload,
  type MenuSurfaceRow,
  type MenuTree
} from "../../../api";
import { AdminEmptyState } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import type { MenuSectionTab } from "../configRouting";
import type { useAdminMenu } from "../useAdminMenu";
import { ScheduleMenuModal } from "./AdminMenuActionModals";
import {
  categoryPublishClass,
  categoryPublishLabel,
  toCategoryListRow,
  type CategoryListRow
} from "./categoryListHelpers";
import { CategoryManageDrawer } from "./CategoryManageDrawer";
import { CategoryProfileDrawer } from "./CategoryProfileDrawer";
import { CreateCategoryModal } from "./CreateCategoryModal";
import { EditCategoryModal } from "./EditCategoryModal";
import { MenuActionConfirmModal } from "./MenuActionConfirmModal";
import { MenuEntityActionsMenu } from "./MenuEntityActionsMenu";
import { isUiOnlyListId, matchesListSearch, UI_MOCK_CATEGORIES } from "./menuListUiMocks";
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
  onNavigateTab: (tab: MenuSectionTab) => void;
};

type PendingRowAction = {
  category: CategoryListRow;
  actionId: string;
};

function categoryRowActions(category: CategoryListRow, can: Props["can"]) {
  const actions: Array<{ id: string; label: string; danger?: boolean }> = [];
  if (can("category", "view") || can("category", "edit")) {
    actions.push({ id: "details", label: "Category details" });
  }
  if (can("category", "edit")) {
    actions.push({
      id: category.isActive ? "hide" : "show",
      label: category.isActive ? "Hide category" : "Show category"
    });
  }
  if (can("menu", "edit") && category.menuStatus === "DRAFT") {
    actions.push({ id: "schedule", label: "Schedule publish" });
  }
  if (can("menu", "edit") && category.menuStatus === "PUBLISHED") {
    actions.push({ id: "schedule-unpublish", label: "Schedule unpublish" });
  }
  return actions;
}

function confirmCopyForAction(action: PendingRowAction) {
  const name = action.category.name;
  switch (action.actionId) {
    case "details":
      return {
        title: "Open category details?",
        description: `View details for “${name}”.`,
        confirmLabel: "Open details",
        danger: false,
        titleId: "category-confirm-details"
      };
    case "hide":
      return {
        title: "Hide category?",
        description: `“${name}” will be hidden from guests until you show it again.`,
        confirmLabel: "Hide category",
        danger: true,
        titleId: "category-confirm-hide"
      };
    case "show":
      return {
        title: "Show category?",
        description: `“${name}” will become visible to guests when its menu is live.`,
        confirmLabel: "Show category",
        danger: false,
        titleId: "category-confirm-show"
      };
    case "schedule":
      return {
        title: "Schedule publish?",
        description: `Schedule when the parent menu for “${name}” should go live.`,
        confirmLabel: "Continue",
        danger: false,
        titleId: "category-confirm-schedule"
      };
    case "schedule-unpublish":
      return {
        title: "Schedule unpublish?",
        description: `Schedule when the parent menu for “${name}” should leave guest view.`,
        confirmLabel: "Continue",
        danger: false,
        titleId: "category-confirm-schedule-unpublish"
      };
    default:
      return {
        title: "Confirm action?",
        description: `Continue with this action for “${name}”?`,
        confirmLabel: "Confirm",
        danger: false,
        titleId: "category-confirm-action"
      };
  }
}

export function AdminCategoriesTabPanel({
  api,
  token,
  restaurantId,
  venueName,
  menus,
  can,
  onNavigateTab
}: Props) {
  const { pushToast } = useAdminToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoryListRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsCategory, setDetailsCategory] = useState<CategoryListRow | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"publish" | "unpublish">("publish");
  const [scheduleMenu, setScheduleMenu] = useState<MenuSurfaceRow | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingRowAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const treeCategories = api.menu?.categories ?? [];

  const categories = useMemo(() => {
    const real = treeCategories.map((c) => toCategoryListRow(c, menus));
    const mocks = UI_MOCK_CATEGORIES.map((c) => toCategoryListRow(c as MenuTree["categories"][number], menus));
    return [...real, ...mocks];
  }, [treeCategories, menus]);

  const realCategories = useMemo(() => categories.filter((c) => !isUiOnlyListId(c.id)), [categories]);

  const filtered = useMemo(
    () =>
      categories.filter((c) =>
        matchesListSearch(
          searchQuery,
          c.name,
          c.description,
          c.menuName,
          categoryPublishLabel(c.menuStatus),
          c.isActive ? "visible" : "hidden",
          c.itemCount
        )
      ),
    [categories, searchQuery]
  );

  const pager = useMenuListPagination(filtered, {
    resetKey: searchQuery.trim().toLowerCase()
  });

  const selectablePaged = useMemo(
    () => pager.pagedItems.filter((c) => !isUiOnlyListId(c.id)),
    [pager.pagedItems]
  );

  const allPageSelected =
    selectablePaged.length > 0 && selectablePaged.every((c) => selectedIds.has(c.id));
  const somePageSelected = selectablePaged.some((c) => selectedIds.has(c.id));

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
      for (const c of selectablePaged) {
        if (checked) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  };

  const toastPreview = () => pushToast("Preview category only — not connected to the backend.", "error");

  const setVisibility = async (category: CategoryListRow, isActive: boolean) => {
    if (isUiOnlyListId(category.id)) {
      toastPreview();
      return false;
    }
    const res = await updateCategory(token, restaurantId, category.id, { isActive });
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Could not update category", "error");
      return false;
    }
    pushToast(isActive ? `“${category.name}” is visible.` : `“${category.name}” is hidden.`, "success");
    api.refresh();
    return true;
  };

  const handleAction = (category: CategoryListRow, actionId: string) => {
    setOpenActionsId(null);
    if (actionId !== "details" && isUiOnlyListId(category.id)) {
      toastPreview();
      return;
    }
    setPendingAction({ category, actionId });
  };

  const closeConfirm = () => {
    if (confirmBusy) return;
    setPendingAction(null);
  };

  const runConfirmedAction = async () => {
    if (!pendingAction) return;
    const { category, actionId } = pendingAction;

    if (actionId === "details") {
      setDetailsCategory(category);
      setDetailsOpen(true);
      setPendingAction(null);
      return;
    }

    if (isUiOnlyListId(category.id)) {
      toastPreview();
      setPendingAction(null);
      return;
    }

    if (actionId === "hide" || actionId === "show") {
      setConfirmBusy(true);
      const ok = await setVisibility(category, actionId === "show");
      setConfirmBusy(false);
      if (ok) setPendingAction(null);
      return;
    }

    if (actionId === "schedule" || actionId === "schedule-unpublish") {
      const parent = category.menuId ? menus.find((m) => m.id === category.menuId) ?? null : null;
      if (!parent) {
        pushToast("This category isn’t linked to a menu yet.", "error");
        setPendingAction(null);
        return;
      }
      setScheduleMenu(parent);
      setScheduleMode(actionId === "schedule-unpublish" ? "unpublish" : "publish");
      setPendingAction(null);
      setScheduleOpen(true);
    }
  };

  const hasSelection = selectedIds.size > 0;
  const canManage = realCategories.length > 0;
  const confirmCopy = pendingAction ? confirmCopyForAction(pendingAction) : null;

  return (
    <>
      <div className="admin-menu-surface-board">
        <div className="admin-menu-surface-board-head">
          <div className="min-w-0">
            <h3 className="admin-menu-surface-board-title">Categories</h3>
            <p className="admin-menu-surface-board-desc">
              Group items — Pizza, Burgers, Drinks, Desserts, and more.
            </p>
          </div>
          <div className="admin-menu-surface-board-actions">
            {canManage ? (
              <MenuToolbarButton onClick={() => setManageOpen(true)}>
                {hasSelection ? "Manage selected" : "Manage"}
              </MenuToolbarButton>
            ) : null}
            {can("category", "create") ? (
              <MenuToolbarButton primary onClick={() => setCreateOpen(true)}>
                Create
              </MenuToolbarButton>
            ) : null}
          </div>
        </div>

        {categories.length > 0 ? (
          <MenuListSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search categories by name, menu, or status…"
            aria-label="Search categories"
          />
        ) : null}

        {categories.length === 0 ? (
          <AdminEmptyState>No categories yet — add Burgers, Pizza, Drinks, or Desserts to get started.</AdminEmptyState>
        ) : filtered.length === 0 ? (
          <p className="admin-config-text-muted py-2 text-sm">No categories match your search.</p>
        ) : (
          <>
            <label className="admin-menu-surface-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="admin-menu-surface-checkbox"
                checked={allPageSelected}
                aria-label="Select all categories on this page"
                onChange={(e) => toggleSelectAllPage(e.target.checked)}
              />
              <span className="admin-menu-surface-select-all-label">Select all on page</span>
            </label>

            <ul className={`admin-menu-surface-list ${pager.pageClassName}`} key={pager.pageKey}>
              {pager.pagedItems.map((c, index) => {
                const actions = categoryRowActions(c, can);
                const isSelected = selectedIds.has(c.id);
                const uiOnly = isUiOnlyListId(c.id);
                const stats = [`${c.itemCount} items`, c.menuName, `sort ${c.sortOrder}`].join(" · ");
                return (
                  <li
                    key={c.id}
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
                          aria-label={uiOnly ? `${c.name} (preview only)` : `Select ${c.name}`}
                          onChange={(e) => toggleSelection(c.id, e.target.checked)}
                        />
                      </label>

                      <span className={`admin-menu-surface-status ${categoryPublishClass(c.menuStatus)}`}>
                        {c.isActive ? categoryPublishLabel(c.menuStatus) : "Hidden"}
                      </span>

                      <div className="admin-menu-surface-main">
                        <span className="admin-menu-surface-name">{c.name}</span>
                        <span className="admin-menu-surface-sep" aria-hidden>
                          ·
                        </span>
                        <span className="admin-menu-surface-desc">
                          {c.description?.trim() || `Category on ${c.menuName}`}
                        </span>
                        <span className="admin-menu-surface-sep" aria-hidden>
                          ·
                        </span>
                        <span className="admin-menu-surface-meta">{stats}</span>
                      </div>

                      <div className="admin-menu-surface-actions">
                        <MenuEntityActionsMenu
                          entityName={c.name}
                          hideHeader
                          open={openActionsId === c.id}
                          actions={actions}
                          onToggle={() => setOpenActionsId((id) => (id === c.id ? null : c.id))}
                          onAction={(actionId) => handleAction(c, actionId)}
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
                label="Categories pagination"
              />
            ) : null}
          </>
        )}
      </div>

      <CategoryProfileDrawer
        category={detailsCategory}
        open={detailsOpen}
        venueName={venueName}
        onClose={() => {
          setDetailsOpen(false);
          setDetailsCategory(null);
        }}
      />

      <CategoryManageDrawer
        open={manageOpen}
        categories={categories}
        selectedIds={selectedIds}
        menus={menus}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        onClose={() => setManageOpen(false)}
        onRefresh={() => api.refresh()}
        onClearSelection={() => setSelectedIds(new Set())}
        onEditCategory={(category) => {
          setEditTarget(category);
          setEditOpen(true);
        }}
      />

      <CreateCategoryModal
        open={createOpen}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        menus={menus}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          pushToast("Category created.", "success");
          api.refresh();
        }}
        onNavigateTab={onNavigateTab}
      />

      <EditCategoryModal
        open={editOpen}
        category={editTarget}
        menus={menus}
        token={token}
        restaurantId={restaurantId}
        onClose={() => {
          setEditOpen(false);
          setEditTarget(null);
        }}
        onSaved={() => {
          pushToast("Category updated.", "success");
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

      <ScheduleMenuModal
        open={scheduleOpen}
        menu={scheduleMenu}
        token={token}
        restaurantId={restaurantId}
        mode={scheduleMode}
        onClose={() => {
          setScheduleOpen(false);
          setScheduleMenu(null);
        }}
        onScheduled={() => {
          pushToast(
            scheduleMode === "unpublish" ? "Unpublish schedule saved on menu." : "Publish schedule saved on menu.",
            "success"
          );
        }}
      />
    </>
  );
}
