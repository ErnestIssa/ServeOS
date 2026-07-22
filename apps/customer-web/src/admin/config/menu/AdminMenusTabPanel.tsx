import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuSurfaceRow } from "../../../api";
import { archiveRestaurantMenu, getMenuManageContext } from "../../../api";
import type { MenuCapabilitiesPayload } from "../../../api";
import { AdminSkeletonTable } from "../../AdminSkeleton";
import { useAdminToast } from "../../AdminToast";
import type { useAdminMenus } from "../useAdminMenus";
import { CreateMenuModal } from "./CreateMenuModal";
import {
  DuplicateMenuConfirmModal,
  ScheduleMenuModal,
  ContentTemplatesPanel
} from "./AdminMenuActionModals";
import { MenuActionConfirmModal } from "./MenuActionConfirmModal";
import { MenuEntityActionsMenu } from "./MenuEntityActionsMenu";
import { MenuProfileDrawer } from "./MenuProfileDrawer";
import { MenuManageDrawer } from "./MenuManageDrawer";
import { MenuPublishReviewModal, MenuVersionHistoryDrawer } from "./MenuReleaseModals";
import { MenuListSearchField, MenuToolbarButton } from "./MenuPageUi";
import { MenuSurfacePagination } from "./MenuSurfacePagination";
import {
  applyMenuListFilters,
  applyMenuListSort,
  MENU_LIST_QUERY
} from "./menuListQuery";
import {
  isUiOnlyListId,
  UI_MOCK_ARCHIVED_MENUS,
  UI_MOCK_LIVE_MENUS,
  UI_MOCK_MENUS_EXTRA
} from "./menuListUiMocks";
import { MENU_LIST_PAGE_SIZE, useMenuListPagination } from "./useMenuListPagination";

type MenusApi = ReturnType<typeof useAdminMenus>;
type MenuPanelVariant = "active" | "live" | "archived";

type Props = {
  menusApi: MenusApi;
  variant?: MenuPanelVariant;
  token: string;
  restaurantId: string;
  venueName: string;
  initialLoading: boolean;
  can: (entity: keyof MenuCapabilitiesPayload["entities"], action: string) => boolean;
};

function menuDescription(menu: MenuSurfaceRow, venueName: string) {
  if (menu.description?.trim()) return menu.description.trim();
  switch (menu.surfaceKey) {
    case "main":
      return `Default guest menu for ${venueName || "this venue"}`;
    case "lunch":
      return "Weekday lunch service — schedule when multi-menu is enabled";
    case "dinner":
      return "Evening dining — share categories or build a dedicated set";
    case "drinks":
      return "Beverages, cocktails, and bar service";
    case "seasonal":
      return "Rotating seasonal items and limited-time offers";
    default:
      return `Draft menu surface for ${venueName || "this venue"}`;
  }
}

function statusLabel(menu: MenuSurfaceRow) {
  if (menu.releaseLabel) return menu.releaseLabel;
  if (menu.releaseState === "scheduled") return "Scheduled";
  if (menu.releaseState === "retired" || menu.status === "RETIRED") return "Retired";
  if (menu.status === "ARCHIVED") return "Archived";
  if (menu.status === "PUBLISHED" && menu.hasUnpublishedChanges) return "Live · draft changes";
  if (menu.status === "PUBLISHED") return "Live";
  return "Draft";
}

function statusClass(menu: MenuSurfaceRow) {
  const state = menu.releaseState;
  if (state === "archived" || menu.status === "ARCHIVED") return "admin-menu-surface-status--archived";
  if (state === "retired" || menu.status === "RETIRED") return "admin-menu-surface-status--retired";
  if (state === "scheduled") return "admin-menu-surface-status--scheduled";
  if (menu.status === "PUBLISHED" && menu.hasUnpublishedChanges) return "admin-menu-surface-status--draft";
  if (menu.status === "PUBLISHED") return "admin-menu-surface-status--live";
  return "admin-menu-surface-status--draft";
}

function formatPublishedAgo(iso: string | null | undefined) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "Released just now";
  if (mins < 60) return `Released ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Released ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `Released ${days} day${days === 1 ? "" : "s"} ago`;
}

function formatScheduleWhen(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function sectionCopy(variant: MenuPanelVariant) {
  if (variant === "live") {
    return {
      title: "Live menus",
      description: "Published menu versions guests order from. Draft edits stay private until you publish changes.",
      empty: "No live menus yet — publish a draft menu to make it visible to guests.",
      searchPlaceholder: "Search live menus…"
    };
  }
  if (variant === "archived") {
    return {
      title: "Archived menus",
      description: "Menus removed from guest view. Duplicate one to bring it back as a draft.",
      empty: "No archived menus.",
      searchPlaceholder: "Search archived menus…"
    };
  }
  return {
    title: "Menus",
    description: "Draft workspace for each menu surface. Only Publish changes releases a new guest version.",
    empty: "No menus yet. Create your first draft menu.",
    searchPlaceholder: "Search menus by name, surface, or status…"
  };
}

function matchesMenuSearch(menu: MenuSurfaceRow, query: string, venueName: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    menu.name,
    menu.description,
    menu.surfaceKey,
    menu.status,
    statusLabel(menu),
    menuDescription(menu, venueName),
    menu.scopeLabel,
    String(menu.categoryCount),
    String(menu.itemCount),
    menu.activeVersionNumber ? `version ${menu.activeVersionNumber}` : "",
    menu.hasUnpublishedChanges ? "draft changes" : ""
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Prefer backend rowActions (SSOT). Fallback mirrors buildMenuRowActions. */
function resolveRowActions(
  menu: MenuSurfaceRow,
  variant: MenuPanelVariant,
  can: Props["can"]
) {
  if (menu.rowActions?.length) return menu.rowActions;

  const actions: Array<{ id: string; label: string; danger?: boolean }> = [];
  if (can("menu", "view")) {
    actions.push({ id: "preview", label: "Preview" });
    actions.push({ id: "details", label: "Menu details" });
  }
  if (variant !== "archived" && can("menu", "publish") && menu.status !== "RETIRED" && (menu.status === "DRAFT" || menu.hasUnpublishedChanges)) {
    actions.push({ id: "publish-changes", label: "Publish changes" });
  }
  if (variant !== "archived" && can("menu", "edit") && menu.status !== "ARCHIVED" && menu.status !== "RETIRED") {
    actions.push({ id: "schedule-release", label: "Schedule release" });
  }
  if (variant !== "archived" && can("menu", "edit") && menu.status === "PUBLISHED") {
    actions.push({ id: "schedule-retirement", label: "Schedule retirement" });
  }
  if (can("menu", "view") && (menu.activeVersionNumber != null || menu.status === "PUBLISHED" || menu.status === "RETIRED")) {
    actions.push({ id: "version-history", label: "Version history" });
  }
  if (variant !== "archived" && can("menu", "publish") && menu.activeVersionNumber != null && menu.status !== "RETIRED") {
    actions.push({ id: "rollback", label: "Rollback" });
  }
  if (can("menu", "create")) {
    actions.push({ id: "duplicate", label: "Duplicate" });
  }
  if (variant !== "archived" && menu.status !== "ARCHIVED" && can("menu", "archive")) {
    actions.push({ id: "archive", label: "Archive", danger: true });
  }
  return actions;
}

function isUiOnlyMenu(menu: MenuSurfaceRow | { id: string }) {
  return isUiOnlyListId(menu.id);
}

/** Local preview rows for the Menus tab list — not persisted / not sent to the API. */
function buildUiOnlyPreviewMenus(): MenuSurfaceRow[] {
  const now = new Date().toISOString();
  const seeds: Array<{
    name: string;
    description: string;
    surfaceKey: string;
    status: MenuSurfaceRow["status"];
    scopeTone: MenuSurfaceRow["scopeTone"];
    scopeLabel: string;
    categoryCount: number;
    itemCount: number;
  }> = [
    {
      name: "Brunch board",
      description: "Weekend brunch plates and bottomless coffee.",
      surfaceKey: "brunch",
      status: "DRAFT",
      scopeTone: "draft",
      scopeLabel: "Draft",
      categoryCount: 4,
      itemCount: 18
    },
    {
      name: "Rooftop cocktails",
      description: "Signature mixes and low-ABV spritzes.",
      surfaceKey: "drinks",
      status: "PUBLISHED",
      scopeTone: "live",
      scopeLabel: "Live",
      categoryCount: 3,
      itemCount: 22
    },
    {
      name: "Kids menu",
      description: "Smaller portions with allergen-friendly picks.",
      surfaceKey: "kids",
      status: "DRAFT",
      scopeTone: "draft",
      scopeLabel: "Draft",
      categoryCount: 2,
      itemCount: 9
    },
    {
      name: "Late night bites",
      description: "After-hours kitchen until midnight.",
      surfaceKey: "late_night",
      status: "PUBLISHED",
      scopeTone: "live",
      scopeLabel: "Live",
      categoryCount: 5,
      itemCount: 14
    },
    {
      name: "Vegan tasting",
      description: "Plant-forward tasting flight.",
      surfaceKey: "seasonal",
      status: "DRAFT",
      scopeTone: "draft",
      scopeLabel: "Draft",
      categoryCount: 3,
      itemCount: 0
    },
    {
      name: "Chef’s counter",
      description: "Omakase-style counter seating only.",
      surfaceKey: "dinner",
      status: "PUBLISHED",
      scopeTone: "problem",
      scopeLabel: "Needs attention",
      categoryCount: 1,
      itemCount: 0
    },
    {
      name: "Breakfast express",
      description: "Grab-and-go morning favorites.",
      surfaceKey: "lunch",
      status: "DRAFT",
      scopeTone: "draft",
      scopeLabel: "Draft",
      categoryCount: 3,
      itemCount: 11
    },
    {
      name: "Wine list",
      description: "By-the-glass and bottle selection.",
      surfaceKey: "drinks",
      status: "PUBLISHED",
      scopeTone: "live",
      scopeLabel: "Live",
      categoryCount: 6,
      itemCount: 40
    },
    {
      name: "Holiday specials",
      description: "Limited-time festive dishes.",
      surfaceKey: "seasonal",
      status: "DRAFT",
      scopeTone: "draft",
      scopeLabel: "Draft",
      categoryCount: 2,
      itemCount: 7
    },
    {
      name: "Patio grill",
      description: "Outdoor grill plates and sides.",
      surfaceKey: "main",
      status: "PUBLISHED",
      scopeTone: "live",
      scopeLabel: "Live",
      categoryCount: 4,
      itemCount: 16
    },
    {
      name: "Coffee & pastry",
      description: "Espresso bar and baked goods.",
      surfaceKey: "custom",
      status: "DRAFT",
      scopeTone: "draft",
      scopeLabel: "Draft",
      categoryCount: 2,
      itemCount: 12
    },
    {
      name: "Shared plates",
      description: "Family-style sharing menu.",
      surfaceKey: "dinner",
      status: "PUBLISHED",
      scopeTone: "live",
      scopeLabel: "Live",
      categoryCount: 5,
      itemCount: 19
    },
    {
      name: "Gluten-free guide",
      description: "Cross-contact safe GF options.",
      surfaceKey: "main",
      status: "DRAFT",
      scopeTone: "draft",
      scopeLabel: "Draft",
      categoryCount: 3,
      itemCount: 8
    },
    {
      name: "Catering package",
      description: "Office lunch and event trays.",
      surfaceKey: "custom",
      status: "PUBLISHED",
      scopeTone: "live",
      scopeLabel: "Live",
      categoryCount: 4,
      itemCount: 15
    }
  ];

  return seeds.map((seed, index) => ({
    id: `ui-mock-menu-${index + 1}`,
    name: seed.name,
    description: seed.description,
    surfaceKey: seed.surfaceKey,
    status: seed.status,
    sortOrder: 1000 + index,
    categoryCount: seed.categoryCount,
    itemCount: seed.itemCount,
    coverMediaKey: null,
    activeVersionNumber: seed.status === "PUBLISHED" ? 1 : null,
    publishedAt: seed.status === "PUBLISHED" ? now : null,
    availabilityWindows: null,
    scopeTone: seed.scopeTone,
    scopeLabel: seed.scopeLabel,
    createdAt: now,
    updatedAt: now
  }));
}

const UI_ONLY_PREVIEW_MENUS = [...buildUiOnlyPreviewMenus(), ...UI_MOCK_MENUS_EXTRA];

export function AdminMenusTabPanel({
  menusApi,
  variant = "active",
  token,
  restaurantId,
  venueName,
  initialLoading,
  can
}: Props) {
  const { pushToast } = useAdminToast();
  const copy = sectionCopy(variant);

  const [createOpen, setCreateOpen] = useState(false);
  const [editMenu, setEditMenu] = useState<MenuSurfaceRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(MENU_LIST_QUERY.defaultSort);
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [openMenuActionsId, setOpenMenuActionsId] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<MenuSurfaceRow | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"release" | "retirement">("release");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMenu, setDrawerMenu] = useState<MenuSurfaceRow | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [pendingRowAction, setPendingRowAction] = useState<{
    menu: MenuSurfaceRow;
    actionId: string;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [locationDestinations, setLocationDestinations] = useState<
    Array<{ id: string; label: string; hint?: string }>
  >([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getMenuManageContext(token, restaurantId, { variant: "active" });
      if (cancelled || !res.ok || !res.context) return;
      setLocationDestinations(
        (res.context.moveDestinations ?? []).map((d) => ({
          id: d.id,
          label: d.name,
          hint: "Other location"
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [token, restaurantId]);

  const menus = useMemo(() => {
    if (variant === "live") return [...menusApi.menus, ...UI_MOCK_LIVE_MENUS];
    if (variant === "archived") return [...menusApi.menus, ...UI_MOCK_ARCHIVED_MENUS];
    return [...menusApi.menus, ...UI_ONLY_PREVIEW_MENUS];
  }, [menusApi.menus, variant]);

  const realMenus = useMemo(() => menus.filter((m) => !isUiOnlyMenu(m)), [menus]);

  const filteredMenus = useMemo(() => {
    const searched = menus.filter((m) => matchesMenuSearch(m, searchQuery, venueName));
    const filtered = applyMenuListFilters(searched, activeFilters);
    return applyMenuListSort(filtered, activeSort);
  }, [menus, searchQuery, venueName, activeFilters, activeSort]);

  const pager = useMenuListPagination(filteredMenus, {
    pageSize: MENU_LIST_PAGE_SIZE,
    resetKey: `${variant}:${searchQuery.trim().toLowerCase()}:${activeFilters.join(",")}:${activeSort}:${menusApi.backendTotal}:${menus.length}`
  });

  const pagedMenus = pager.pagedItems;
  const selectablePagedMenus = useMemo(
    () => pagedMenus.filter((m) => !isUiOnlyMenu(m)),
    [pagedMenus]
  );

  const allFilteredSelected =
    selectablePagedMenus.length > 0 &&
    selectablePagedMenus.every((m) => selectedMenuIds.has(m.id));
  const someFilteredSelected = selectablePagedMenus.some((m) => selectedMenuIds.has(m.id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  const toggleMenuSelection = (menuId: string, nextChecked?: boolean) => {
    if (isUiOnlyListId(menuId)) return;
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      const shouldCheck = nextChecked ?? !next.has(menuId);
      if (shouldCheck) next.add(menuId);
      else next.delete(menuId);
      return next;
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      for (const menu of selectablePagedMenus) {
        if (checked) next.add(menu.id);
        else next.delete(menu.id);
      }
      return next;
    });
  };

  const handleMenuAction = (menu: MenuSurfaceRow, actionId: string) => {
    setOpenMenuActionsId(null);
    setActionMenu(menu);

    if (actionId !== "details" && actionId !== "preview" && isUiOnlyMenu(menu)) {
      pushToast("Preview menu only — not connected to the backend.", "error");
      return;
    }

    if (actionId === "details" || actionId === "preview") {
      setDrawerMenu(menu);
      setDrawerOpen(true);
      return;
    }

    if (actionId === "schedule-release" || actionId === "schedule") {
      setScheduleMode("release");
      setScheduleOpen(true);
      return;
    }

    if (actionId === "schedule-retirement" || actionId === "schedule-unpublish") {
      setScheduleMode("retirement");
      setScheduleOpen(true);
      return;
    }

    if (actionId === "publish-changes" || actionId === "publish" || actionId === "update-publish") {
      setPublishReviewOpen(true);
      return;
    }

    if (actionId === "version-history" || actionId === "rollback") {
      setVersionHistoryOpen(true);
      return;
    }

    if (actionId === "duplicate") {
      setDuplicateOpen(true);
      return;
    }

    if (actionId === "archive") {
      setPendingRowAction({ menu, actionId });
      return;
    }

    setPendingRowAction({ menu, actionId });
  };

  const closeRowConfirm = () => {
    if (confirmBusy) return;
    setPendingRowAction(null);
  };

  const runConfirmedMenuAction = async () => {
    if (!pendingRowAction) return;
    const { menu, actionId } = pendingRowAction;

    if (isUiOnlyMenu(menu)) {
      pushToast("Preview menu only — not connected to the backend.", "error");
      setPendingRowAction(null);
      return;
    }

    if (actionId === "archive") {
      setConfirmBusy(true);
      const res = await archiveRestaurantMenu(token, restaurantId, menu.id, menu.name);
      setConfirmBusy(false);
      if (!res.ok) {
        pushToast(res.message ?? res.error ?? "Could not archive menu", "error");
        return;
      }
      pushToast(`“${menu.name}” archived.`, "success");
      setPendingRowAction(null);
      void menusApi.refresh();
    }
  };

  const menuConfirmCopy = (() => {
    if (!pendingRowAction) return null;
    const name = pendingRowAction.menu.name;
    switch (pendingRowAction.actionId) {
      case "archive":
        return {
          title: "Archive menu?",
          description: `“${name}” will leave guest view. Prefer archive instead of unpublish.`,
          confirmLabel: "Archive",
          danger: true
        };
      default:
        return {
          title: "Confirm action?",
          description: `Continue with this action for “${name}”?`,
          confirmLabel: "Confirm",
          danger: false
        };
    }
  })();

  const modalMenu = actionMenu && !isUiOnlyMenu(actionMenu) ? actionMenu : null;
  const hasSelection = selectedMenuIds.size > 0;
  const canManage = variant === "active" && realMenus.length > 0;

  if (initialLoading || menusApi.meta.initialLoading) {
    return <AdminSkeletonTable rows={4} columns={4} />;
  }

  return (
    <>
      <div className="admin-menu-surface-board">
        <div className="admin-menu-surface-board-head">
          <div className="min-w-0">
            <h3 className="admin-menu-surface-board-title">{copy.title}</h3>
            <p className="admin-menu-surface-board-desc">{copy.description}</p>
          </div>
          {variant === "active" ? (
            <div className="admin-menu-surface-board-actions">
              {canManage ? (
                <MenuToolbarButton onClick={() => setManageOpen(true)}>
                  {hasSelection ? "Manage selected" : "Manage"}
                </MenuToolbarButton>
              ) : null}
              {can("menu", "view") || can("menu", "create") ? (
                <MenuToolbarButton onClick={() => setTemplatesOpen(true)}>Templates</MenuToolbarButton>
              ) : null}
              {can("menu", "create") ? (
                <MenuToolbarButton
                  primary
                  onClick={() => {
                    setEditMenu(null);
                    setCreateOpen(true);
                  }}
                >
                  Create
                </MenuToolbarButton>
              ) : null}
            </div>
          ) : null}
        </div>

        {menus.length > 0 ? (
          <MenuListSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={copy.searchPlaceholder}
            aria-label="Search menus"
            filterGroups={MENU_LIST_QUERY.filterGroups}
            sortOptions={MENU_LIST_QUERY.sortOptions}
            defaultSort={MENU_LIST_QUERY.defaultSort}
            activeFilters={activeFilters}
            activeSort={activeSort}
            totalCount={menus.length}
            resultCount={filteredMenus.length}
            onFiltersChange={setActiveFilters}
            onSortChange={setActiveSort}
            filterTitle="Filter menus"
            sortTitle="Sort menus"
          />
        ) : null}

        {menus.length === 0 ? (
          <p className="admin-config-text-muted py-2 text-sm">{copy.empty}</p>
        ) : filteredMenus.length === 0 ? (
          <p className="admin-config-text-muted py-2 text-sm">No menus match your search or filters.</p>
        ) : (
          <>
            <label className="admin-menu-surface-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="admin-menu-surface-checkbox"
                checked={allFilteredSelected}
                aria-label="Select all menus on this page"
                onChange={(e) => toggleSelectAllFiltered(e.target.checked)}
              />
              <span className="admin-menu-surface-select-all-label">Select all on page</span>
            </label>

            <ul
              className={`admin-menu-surface-list ${pager.pageClassName}`}
              key={pager.pageKey}
            >
              {pagedMenus.map((m, index) => {
                const actions = resolveRowActions(m, variant, can);
                const isSelected = selectedMenuIds.has(m.id);
                const uiOnly = isUiOnlyMenu(m);
                const publishedAgo = formatPublishedAgo(m.publishedAt);
                const releaseWhen = formatScheduleWhen(m.scheduledPublishAt);
                const retireWhen = formatScheduleWhen(m.scheduledRetireAt);
                const draftBits =
                  m.draftChangeCount && m.draftChangeCount > 0
                    ? `${m.draftChangeCount} draft change${m.draftChangeCount === 1 ? "" : "s"}`
                    : m.hasUnpublishedChanges
                      ? "Draft changes pending"
                      : null;
                const stats = [
                  m.activeVersionNumber ? `Version ${m.activeVersionNumber}` : null,
                  publishedAgo,
                  m.releaseState === "scheduled" && releaseWhen ? `Releases ${releaseWhen}` : null,
                  m.status === "PUBLISHED" && retireWhen ? `Retires ${retireWhen}` : null,
                  draftBits,
                  `${m.categoryCount} categories`,
                  `${m.itemCount} items`
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li
                    key={m.id}
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
                          aria-label={uiOnly ? `${m.name} (preview only)` : `Select ${m.name}`}
                          onChange={(e) => toggleMenuSelection(m.id, e.target.checked)}
                        />
                      </label>

                      <span className={`admin-menu-surface-status ${statusClass(m)}`}>
                        {statusLabel(m)}
                      </span>

                      <div className="admin-menu-surface-main">
                        <span className="admin-menu-surface-name">{m.name}</span>
                        <span className="admin-menu-surface-sep" aria-hidden>
                          ·
                        </span>
                        <span className="admin-menu-surface-desc">{menuDescription(m, venueName)}</span>
                        <span className="admin-menu-surface-sep" aria-hidden>
                          ·
                        </span>
                        <span className="admin-menu-surface-meta">{stats}</span>
                      </div>

                      <div className="admin-menu-surface-actions">
                        <MenuEntityActionsMenu
                          entityName={m.name}
                          hideHeader
                          open={openMenuActionsId === m.id}
                          actions={actions}
                          onToggle={() => setOpenMenuActionsId((id) => (id === m.id ? null : m.id))}
                          onAction={(actionId) => handleMenuAction(m, actionId)}
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
                label="Menus pagination"
              />
            ) : null}
          </>
        )}
      </div>

      <MenuActionConfirmModal
        open={Boolean(pendingRowAction && menuConfirmCopy)}
        title={menuConfirmCopy?.title ?? ""}
        description={menuConfirmCopy?.description ?? ""}
        confirmLabel={menuConfirmCopy?.confirmLabel}
        danger={menuConfirmCopy?.danger}
        busy={confirmBusy}
        onClose={closeRowConfirm}
        onConfirm={() => void runConfirmedMenuAction()}
      />

      <MenuProfileDrawer
        menu={drawerMenu}
        open={drawerOpen}
        venueName={venueName}
        variant={variant}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerMenu(null);
        }}
      />

      <MenuManageDrawer
        open={manageOpen}
        menus={realMenus}
        selectedMenuIds={selectedMenuIds}
        variant={variant}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        onClose={() => setManageOpen(false)}
        onRefresh={() => void menusApi.refresh()}
        onClearSelection={() => setSelectedMenuIds(new Set())}
        onEditMenu={(menu) => {
          setEditMenu(menu);
          setCreateOpen(true);
        }}
        onOpenPublishReview={(menu) => {
          setActionMenu(menu);
          setPublishReviewOpen(true);
        }}
        onOpenVersionHistory={(menu) => {
          setActionMenu(menu);
          setVersionHistoryOpen(true);
        }}
      />

      <CreateMenuModal
        open={createOpen}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        editMenu={editMenu}
        onClose={() => {
          setCreateOpen(false);
          setEditMenu(null);
        }}
        onCreated={(menu) => {
          menusApi.upsertMenu(menu);
          pushToast(`“${menu.name}” draft created.`, "success");
          void menusApi.refresh();
        }}
        onSaved={(menu) => {
          menusApi.upsertMenu(menu);
          pushToast(`“${menu.name}” updated.`, "success");
          void menusApi.refresh();
        }}
      />

      <DuplicateMenuConfirmModal
        open={duplicateOpen}
        menu={modalMenu}
        token={token}
        restaurantId={restaurantId}
        locationDestinations={locationDestinations}
        onClose={() => setDuplicateOpen(false)}
        onDuplicated={(menu) => {
          if ("status" in menu) menusApi.upsertMenu(menu as MenuSurfaceRow);
          pushToast(`“${menu.name}” draft created from duplicate.`, "success");
          void menusApi.refresh();
        }}
      />

      <ContentTemplatesPanel
        open={templatesOpen}
        token={token}
        restaurantId={restaurantId}
        menus={realMenus}
        locationDestinations={locationDestinations}
        canCreate={can("menu", "create")}
        onClose={() => setTemplatesOpen(false)}
        onApplied={() => {
          pushToast("Template apply started — draft menu will appear when the job completes.", "success");
          void menusApi.refresh();
        }}
      />

      <ScheduleMenuModal
        open={scheduleOpen}
        menu={modalMenu}
        token={token}
        restaurantId={restaurantId}
        mode={scheduleMode}
        onClose={() => setScheduleOpen(false)}
        onScheduled={() => {
          pushToast(
            scheduleMode === "retirement"
              ? "Retirement scheduled. The menu will leave guest view automatically when due."
              : "Release scheduled. It will go live automatically when due.",
            "success"
          );
          void menusApi.refresh();
        }}
      />

      <MenuPublishReviewModal
        open={publishReviewOpen}
        menu={modalMenu}
        token={token}
        restaurantId={restaurantId}
        onClose={() => setPublishReviewOpen(false)}
        onPublished={({ versionNumber, menuName }) => {
          pushToast(`“${menuName}” published as version ${versionNumber}.`, "success");
          void menusApi.refresh();
        }}
      />

      <MenuVersionHistoryDrawer
        open={versionHistoryOpen}
        menu={modalMenu}
        token={token}
        restaurantId={restaurantId}
        canRollback={can("menu", "publish")}
        onClose={() => setVersionHistoryOpen(false)}
        onRolledBack={(versionNumber) => {
          pushToast(`Rolled back — now live as version ${versionNumber}.`, "success");
          void menusApi.refresh();
        }}
      />

    </>
  );
}
