import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuSurfaceRow } from "../../../api";
import { publishRestaurantMenu } from "../../../api";
import type { MenuCapabilitiesPayload } from "../../../api";
import { AdminSkeletonTable } from "../../AdminSkeleton";
import { useAdminToast } from "../../AdminToast";
import type { useAdminMenus } from "../useAdminMenus";
import { CreateMenuModal } from "./CreateMenuModal";
import {
  DuplicateMenuConfirmModal,
  ScheduleMenuModal
} from "./AdminMenuActionModals";
import { MenuEntityActionsMenu } from "./MenuEntityActionsMenu";
import { MenuProfileDrawer } from "./MenuProfileDrawer";
import { MenuManageDrawer } from "./MenuManageDrawer";
import { MenuToolbarButton } from "./MenuPageUi";

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

function statusLabel(status: MenuSurfaceRow["status"]) {
  if (status === "PUBLISHED") return "Live";
  if (status === "ARCHIVED") return "Archived";
  return "Draft";
}

function statusClass(status: MenuSurfaceRow["status"]) {
  if (status === "PUBLISHED") return "admin-menu-surface-status--live";
  if (status === "ARCHIVED") return "admin-menu-surface-status--archived";
  return "admin-menu-surface-status--draft";
}

function sectionCopy(variant: MenuPanelVariant) {
  if (variant === "live") {
    return {
      title: "Live menus",
      description: "Published menus guests can order from right now.",
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
    description: "Everything guests can order from — main, lunch, dinner, drinks, and seasonal surfaces.",
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
    statusLabel(menu.status),
    menuDescription(menu, venueName),
    menu.scopeLabel,
    String(menu.categoryCount),
    String(menu.itemCount)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Fallback when list payload omits rowActions — mirrors backend buildMenuRowActions. */
function fallbackRowActions(
  menu: MenuSurfaceRow,
  variant: MenuPanelVariant,
  can: Props["can"]
) {
  const actions: Array<{ id: string; label: string; danger?: boolean }> = [];

  if (can("menu", "view")) {
    actions.push({ id: "details", label: "Menu details" });
  }
  if (variant !== "archived" && menu.status === "DRAFT" && can("menu", "publish")) {
    actions.push({ id: "publish", label: "Publish menu" });
  }
  if (can("menu", "create")) {
    actions.push({ id: "duplicate", label: "Duplicate menu" });
  }
  if (variant !== "archived" && menu.status !== "ARCHIVED" && can("menu", "edit")) {
    actions.push({ id: "schedule", label: "Schedule publish" });
  }

  return actions;
}

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
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [openMenuActionsId, setOpenMenuActionsId] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<MenuSurfaceRow | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMenu, setDrawerMenu] = useState<MenuSurfaceRow | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const menus = menusApi.menus;

  const filteredMenus = useMemo(
    () => menus.filter((m) => matchesMenuSearch(m, searchQuery, venueName)),
    [menus, searchQuery, venueName]
  );

  const allFilteredSelected =
    filteredMenus.length > 0 && filteredMenus.every((m) => selectedMenuIds.has(m.id));
  const someFilteredSelected = filteredMenus.some((m) => selectedMenuIds.has(m.id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  const toggleMenuSelection = (menuId: string, nextChecked?: boolean) => {
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
      for (const menu of filteredMenus) {
        if (checked) next.add(menu.id);
        else next.delete(menu.id);
      }
      return next;
    });
  };

  const handlePublish = async (menu: MenuSurfaceRow) => {
    const res = await publishRestaurantMenu(token, restaurantId, menu.id);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Could not publish menu", "error");
      return;
    }
    pushToast(`“${menu.name}” is live for guests.`, "success");
    void menusApi.refresh();
  };

  const handleMenuAction = (menu: MenuSurfaceRow, actionId: string) => {
    setOpenMenuActionsId(null);
    setActionMenu(menu);

    if (actionId === "details") {
      setDrawerMenu(menu);
      setDrawerOpen(true);
      return;
    }
    if (actionId === "publish") {
      void handlePublish(menu);
      return;
    }
    if (actionId === "duplicate") {
      setDuplicateOpen(true);
      return;
    }
    if (actionId === "schedule") {
      setScheduleOpen(true);
      return;
    }
  };

  const modalMenu = actionMenu;
  const hasSelection = selectedMenuIds.size > 0;
  const canManage = variant === "active" && menus.length > 0;

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
          <div className="admin-menu-surface-search-wrap">
            <input
              type="search"
              className="admin-menu-surface-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label="Search menus"
            />
          </div>
        ) : null}

        {menus.length === 0 ? (
          <p className="admin-config-text-muted py-2 text-sm">{copy.empty}</p>
        ) : filteredMenus.length === 0 ? (
          <p className="admin-config-text-muted py-2 text-sm">No menus match your search.</p>
        ) : (
          <>
            <label className="admin-menu-surface-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="admin-menu-surface-checkbox"
                checked={allFilteredSelected}
                aria-label="Select all visible menus"
                onChange={(e) => toggleSelectAllFiltered(e.target.checked)}
              />
              <span className="admin-menu-surface-select-all-label">Select all</span>
            </label>

            <ul className="admin-menu-surface-list" key={searchQuery.trim().toLowerCase()}>
              {filteredMenus.map((m, index) => {
                const actions =
                  m.rowActions && m.rowActions.length > 0
                    ? m.rowActions
                    : fallbackRowActions(m, variant, can);
                const isSelected = selectedMenuIds.has(m.id);
                const stats = [
                  `${m.categoryCount} categories`,
                  `${m.itemCount} items`,
                  m.activeVersionNumber ? `v${m.activeVersionNumber}` : null
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li
                    key={m.id}
                    className="admin-menu-surface-list-item"
                    style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
                  >
                    <div className={`admin-menu-surface-card${isSelected ? " is-selected" : ""}`}>
                      <label className="admin-menu-surface-checkbox-wrap">
                        <input
                          type="checkbox"
                          className="admin-menu-surface-checkbox"
                          checked={isSelected}
                          aria-label={`Select ${m.name}`}
                          onChange={(e) => toggleMenuSelection(m.id, e.target.checked)}
                        />
                      </label>

                      <span className={`admin-menu-surface-status ${statusClass(m.status)}`}>
                        {statusLabel(m.status)}
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
          </>
        )}
      </div>

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
        menus={menus}
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
        onClose={() => setDuplicateOpen(false)}
        onDuplicated={(menu) => {
          menusApi.upsertMenu(menu);
          pushToast(`“${menu.name}” draft created from duplicate.`, "success");
          void menusApi.refresh();
        }}
      />

      <ScheduleMenuModal
        open={scheduleOpen}
        menu={modalMenu}
        token={token}
        restaurantId={restaurantId}
        onClose={() => setScheduleOpen(false)}
        onScheduled={() => {
          pushToast("Menu schedule saved.", "success");
          void menusApi.refresh();
        }}
      />

    </>
  );
}
