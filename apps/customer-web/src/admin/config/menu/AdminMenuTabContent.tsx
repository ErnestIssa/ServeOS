import { useEffect, useMemo, useState } from "react";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import {
  exportMenuCsv,
  importMenuCsv,
  type MenuSurfaceRow
} from "../../../api";
import {
  AdminBtnPrimary,
  AdminEmptyState
} from "../../AdminUi";
import { AdminSkeletonTable } from "../../AdminSkeleton";
import { useAdminToast } from "../../AdminToast";
import type { MenuSectionTab } from "../configRouting";
import type { useAdminMenu } from "../useAdminMenu";
import type { MenuCapabilitiesPayload } from "../../../api";
import { MenuMediaDestinationModal } from "./MenuMediaDestinationModal";
import { AdminCategoriesTabPanel } from "./AdminCategoriesTabPanel";
import { AdminItemsTabPanel } from "./AdminItemsTabPanel";
import { CreateModifierGroupModal } from "./CreateModifierGroupModal";
import { CreateModifierOptionModal } from "./CreateModifierOptionModal";
import { EditModifierGroupModal, type EditModifierGroupTarget } from "./EditModifierGroupModal";
import { EditModifierOptionModal, type EditModifierOptionTarget } from "./EditModifierOptionModal";
import { DeleteModifierGroupModal, DeleteModifierOptionModal } from "./ModifierDeleteModals";
import { CreateAvailabilityModal } from "./CreateAvailabilityModal";
import { EditAvailabilityModal, type EditAvailabilityTarget } from "./EditAvailabilityModal";
import { DeleteAvailabilityModal } from "./DeleteAvailabilityModal";
import {
  availabilityCardStyle,
  formatAvailabilityDays,
  listAvailabilityCards
} from "./availabilityHelpers";
import { MenuEntityActionsMenu } from "./MenuEntityActionsMenu";
import {
  MenuActionRow,
  MenuChip,
  MenuListSearchField,
  MenuPreviewFrame,
  MenuSection,
  MenuToolbarButton
} from "./MenuPageUi";
import { MenuSurfacePagination } from "./MenuSurfacePagination";
import {
  isUiOnlyListId,
  matchesListSearch,
  UI_MOCK_AVAILABILITY,
  UI_MOCK_MODIFIER_GROUPS,
  UI_MOCK_MODIFIER_OPTIONS
} from "./menuListUiMocks";
import { useMenuListPagination } from "./useMenuListPagination";

type MenuApi = ReturnType<typeof useAdminMenu>;

type Props = {
  tab: MenuSectionTab;
  api: MenuApi;
  token: string;
  restaurantId: string;
  venueName: string;
  initialLoading: boolean;
  capabilities: MenuCapabilitiesPayload | null;
  can: (entity: keyof MenuCapabilitiesPayload["entities"], action: string) => boolean;
  menus: MenuSurfaceRow[];
  onNavigateTab: (tab: MenuSectionTab) => void;
  onMenusRefresh: () => void;
};

export function AdminMenuTabContent({
  tab,
  api,
  token,
  restaurantId,
  venueName,
  initialLoading,
  capabilities,
  can,
  menus,
  onNavigateTab,
  onMenusRefresh
}: Props) {
  const { pushToast } = useAdminToast();
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaModalKind, setMediaModalKind] = useState<"image" | "video">("image");
  const [createModifierGroupOpen, setCreateModifierGroupOpen] = useState(false);
  const [openModifierGroupMenuId, setOpenModifierGroupMenuId] = useState<string | null>(null);
  const [editModifierGroupTarget, setEditModifierGroupTarget] = useState<EditModifierGroupTarget | null>(null);
  const [editModifierGroupOpen, setEditModifierGroupOpen] = useState(false);
  const [deleteModifierGroupId, setDeleteModifierGroupId] = useState<string | null>(null);
  const [deleteModifierGroupName, setDeleteModifierGroupName] = useState<string | null>(null);
  const [openModifierOptionMenuId, setOpenModifierOptionMenuId] = useState<string | null>(null);
  const [editModifierOptionTarget, setEditModifierOptionTarget] = useState<EditModifierOptionTarget | null>(null);
  const [editModifierOptionOpen, setEditModifierOptionOpen] = useState(false);
  const [deleteModifierOptionId, setDeleteModifierOptionId] = useState<string | null>(null);
  const [deleteModifierOptionName, setDeleteModifierOptionName] = useState<string | null>(null);
  const [createModifierOptionOpen, setCreateModifierOptionOpen] = useState(false);
  const [createAvailabilityOpen, setCreateAvailabilityOpen] = useState(false);
  const [openAvailabilityMenuKey, setOpenAvailabilityMenuKey] = useState<string | null>(null);
  const [editAvailabilityTarget, setEditAvailabilityTarget] = useState<EditAvailabilityTarget | null>(null);
  const [editAvailabilityOpen, setEditAvailabilityOpen] = useState(false);
  const [deleteAvailabilityKey, setDeleteAvailabilityKey] = useState<string | null>(null);
  const [deleteAvailabilityMenuId, setDeleteAvailabilityMenuId] = useState<string | null>(null);
  const [deleteAvailabilityLabel, setDeleteAvailabilityLabel] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");

  useEffect(() => {
    setListSearch("");
  }, [tab]);

  const availabilityCards = useMemo(
    () => [...listAvailabilityCards(menus), ...UI_MOCK_AVAILABILITY],
    [menus]
  );

  const categories = api.menu?.categories ?? [];

  const flatModifierGroups = useMemo(
    () => [...api.flatModifierGroups, ...UI_MOCK_MODIFIER_GROUPS],
    [api.flatModifierGroups]
  );
  const flatModifiers = useMemo(
    () => [...api.flatModifiers, ...UI_MOCK_MODIFIER_OPTIONS],
    [api.flatModifiers]
  );

  const filteredModifierGroups = useMemo(
    () =>
      flatModifierGroups.filter((g) =>
        matchesListSearch(listSearch, g.name, g.itemName, g.minSelect, g.maxSelect, g.optionCount)
      ),
    [flatModifierGroups, listSearch]
  );

  const filteredModifierOptions = useMemo(
    () =>
      flatModifiers.filter((m) =>
        matchesListSearch(
          listSearch,
          m.name,
          m.groupName,
          m.itemName,
          m.priceDeltaCents,
          m.isActive ? "yes" : "no"
        )
      ),
    [flatModifiers, listSearch]
  );

  const filteredAvailability = useMemo(
    () =>
      availabilityCards.filter((card) =>
        matchesListSearch(
          listSearch,
          card.window.label,
          card.menuName,
          card.window.start,
          card.window.end,
          card.window.enabled ? "enabled" : "disabled"
        )
      ),
    [availabilityCards, listSearch]
  );

  const modifierGroupsPager = useMenuListPagination(filteredModifierGroups, { resetKey: listSearch });
  const modifierOptionsPager = useMenuListPagination(filteredModifierOptions, { resetKey: listSearch });
  const availabilityPager = useMenuListPagination(filteredAvailability, { resetKey: listSearch });

  const modifierGroups = useMemo(() => {
    const out: Array<{ id: string; label: string; itemId: string }> = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        for (const g of item.modifierGroups) {
          out.push({ id: g.id, label: `${item.name} → ${g.name}`, itemId: item.id });
        }
      }
    }
    return out;
  }, [categories]);

  const toastPreviewOnly = () => {
    pushToast("Preview row only — not connected to the backend.", "error");
  };

  const modifierGroupMenuActions = useMemo(() => {
    const actions: Array<{ id: string; label: string; danger?: boolean }> = [];
    if (can("modifier_group", "edit")) actions.push({ id: "edit", label: "Edit modifier group" });
    if (can("modifier_group", "delete")) actions.push({ id: "delete", label: "Delete", danger: true });
    return actions;
  }, [can]);

  const modifierOptionMenuActions = useMemo(() => {
    const actions: Array<{ id: string; label: string; danger?: boolean }> = [];
    if (can("modifier_option", "edit")) actions.push({ id: "edit", label: "Edit modifier option" });
    if (can("modifier_option", "delete")) actions.push({ id: "delete", label: "Delete", danger: true });
    return actions;
  }, [can]);

  const availabilityMenuActions = useMemo(() => {
    const actions: Array<{ id: string; label: string; danger?: boolean }> = [];
    if (can("menu", "edit")) actions.push({ id: "edit", label: "Edit availability window" });
    if (can("menu", "edit")) actions.push({ id: "delete", label: "Delete", danger: true });
    return actions;
  }, [can]);

  const handleAvailabilityMenuAction = (card: (typeof availabilityCards)[number], actionId: string) => {
    setOpenAvailabilityMenuKey(null);
    if (isUiOnlyListId(card.key) || isUiOnlyListId(card.menuId)) {
      toastPreviewOnly();
      return;
    }
    if (actionId === "edit") {
      setEditAvailabilityTarget({
        key: card.key,
        menuId: card.menuId,
        menuName: card.menuName,
        window: card.window
      });
      setEditAvailabilityOpen(true);
      return;
    }
    if (actionId === "delete") {
      setDeleteAvailabilityKey(card.key);
      setDeleteAvailabilityMenuId(card.menuId);
      setDeleteAvailabilityLabel(card.window.label);
    }
  };

  const handleModifierGroupMenuAction = (group: (typeof flatModifierGroups)[number], actionId: string) => {
    setOpenModifierGroupMenuId(null);
    if (isUiOnlyListId(group.id)) {
      toastPreviewOnly();
      return;
    }
    if (actionId === "edit") {
      setEditModifierGroupTarget({
        id: group.id,
        name: group.name,
        itemId: group.itemId,
        itemName: group.itemName,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect
      });
      setEditModifierGroupOpen(true);
      return;
    }
    if (actionId === "delete") {
      setDeleteModifierGroupId(group.id);
      setDeleteModifierGroupName(group.name);
    }
  };

  const handleModifierOptionMenuAction = (option: (typeof flatModifiers)[number], actionId: string) => {
    setOpenModifierOptionMenuId(null);
    if (isUiOnlyListId(option.id)) {
      toastPreviewOnly();
      return;
    }
    if (actionId === "edit") {
      setEditModifierOptionTarget({
        id: option.id,
        name: option.name,
        groupId: option.groupId,
        groupName: option.groupName,
        itemName: option.itemName,
        priceDeltaCents: option.priceDeltaCents,
        isActive: option.isActive
      });
      setEditModifierOptionOpen(true);
      return;
    }
    if (actionId === "delete") {
      setDeleteModifierOptionId(option.id);
      setDeleteModifierOptionName(option.name);
    }
  };

  const realCategories = api.menu?.categories ?? [];

  const modalCategories = useMemo(
    () =>
      realCategories.map((c) => ({
        id: c.id,
        name: c.name,
        menuId: c.menuId ?? null,
        itemCount: c.items.length
      })),
    [realCategories]
  );

  const modalItems = useMemo(
    () => api.flatItems.map((i) => ({ id: i.id, name: i.name, categoryName: i.categoryName })),
    [api.flatItems]
  );

  const modalModifierGroups = useMemo(
    () => modifierGroups.map((g) => ({ id: g.id, label: g.label })),
    [modifierGroups]
  );

  if (initialLoading) {
    const rows = tab === "items" ? 8 : tab === "categories" ? 6 : 4;
    const cols = tab === "items" ? 6 : 4;
    return <AdminSkeletonTable rows={rows} columns={cols} />;
  }

  if (tab === "categories") {
    return (
      <AdminCategoriesTabPanel
        api={api}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        menus={menus}
        can={can}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  if (tab === "items") {
    return (
      <AdminItemsTabPanel
        api={api}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        menus={menus}
        can={can}
        capabilities={capabilities}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  if (tab === "modifier-groups") {
    return (
      <>
        <div className="admin-menu-tab-stack">
          <MenuSection
            title="Modifier groups"
            description="Examples: Choose Size (Small, Medium, Large), Choose Bread (White, Whole wheat)."
            action={
              <MenuToolbarButton primary disabled={!can("modifier_group", "create")} onClick={() => setCreateModifierGroupOpen(true)}>
                Create
              </MenuToolbarButton>
            }
          >
            {flatModifierGroups.length === 0 ? (
              <AdminEmptyState>No modifier groups yet — add Choose Size or Choose Bread to an item.</AdminEmptyState>
            ) : (
              <>
                <MenuListSearchField
                  value={listSearch}
                  onChange={setListSearch}
                  placeholder="Search modifier groups by name or item…"
                  aria-label="Search modifier groups"
                />
                {filteredModifierGroups.length === 0 ? (
                  <p className="admin-config-text-muted py-2 text-sm">No modifier groups match your search.</p>
                ) : (
                  <>
                    <div className={modifierGroupsPager.pageClassName} key={modifierGroupsPager.pageKey}>
                      <table className="admin-config-data-table w-full text-left text-sm">
                        <thead>
                          <tr>
                            <th>Group</th>
                            <th>Item</th>
                            <th>Min select</th>
                            <th>Max select</th>
                            <th>Options</th>
                            <th className="admin-menu-item-actions-col" aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {modifierGroupsPager.pagedItems.map((g, index) => (
                            <tr key={g.id} style={{ animationDelay: `${Math.min(index, 12) * 36}ms` }}>
                              <td className="font-semibold admin-config-text">{g.name}</td>
                              <td className="admin-config-text-muted">{g.itemName}</td>
                              <td className="admin-config-text-subtle">{g.minSelect}</td>
                              <td className="admin-config-text-subtle">{g.maxSelect}</td>
                              <td className="admin-config-text-subtle">{g.optionCount}</td>
                              <td className="admin-menu-item-actions-col text-right">
                                {modifierGroupMenuActions.length > 0 ? (
                                  <MenuEntityActionsMenu
                                    entityName={g.name}
                                    subtitle="Modifier group actions"
                                    open={openModifierGroupMenuId === g.id}
                                    actions={modifierGroupMenuActions}
                                    onToggle={() => setOpenModifierGroupMenuId((id) => (id === g.id ? null : g.id))}
                                    onAction={(actionId) => handleModifierGroupMenuAction(g, actionId)}
                                  />
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {modifierGroupsPager.showPagination ? (
                      <MenuSurfacePagination
                        page={modifierGroupsPager.page}
                        totalPages={modifierGroupsPager.totalPages}
                        totalItems={modifierGroupsPager.totalItems}
                        pageSize={modifierGroupsPager.pageSize}
                        onPageChange={modifierGroupsPager.goToPage}
                        label="Modifier groups pagination"
                      />
                    ) : null}
                  </>
                )}
              </>
            )}
          </MenuSection>
        </div>

        <CreateModifierGroupModal
          open={createModifierGroupOpen}
          onClose={() => setCreateModifierGroupOpen(false)}
          token={token}
          restaurantId={restaurantId}
          venueName={venueName}
          items={modalItems}
          onCreated={() => {
            pushToast("Modifier group created.", "success");
            api.refresh();
          }}
          onNavigateTab={onNavigateTab}
        />

        <EditModifierGroupModal
          open={editModifierGroupOpen}
          target={editModifierGroupTarget}
          canEdit={can("modifier_group", "edit")}
          token={token}
          restaurantId={restaurantId}
          onClose={() => {
            setEditModifierGroupOpen(false);
            setEditModifierGroupTarget(null);
          }}
          onSaved={() => {
            pushToast("Modifier group updated.", "success");
            api.refresh();
          }}
        />

        <DeleteModifierGroupModal
          open={Boolean(deleteModifierGroupId)}
          groupName={deleteModifierGroupName}
          groupId={deleteModifierGroupId}
          token={token}
          restaurantId={restaurantId}
          onClose={() => {
            setDeleteModifierGroupId(null);
            setDeleteModifierGroupName(null);
          }}
          onDeleted={() => {
            pushToast("Modifier group deleted.", "success");
            api.refresh();
          }}
        />
      </>
    );
  }

  if (tab === "modifier-options") {
    return (
      <>
        <div className="admin-menu-tab-stack">
          <MenuSection
            title="Modifier options"
            description="Each option: name, extra price, default, and availability."
            action={
              <MenuToolbarButton primary disabled={!can("modifier_option", "create")} onClick={() => setCreateModifierOptionOpen(true)}>
                Create
              </MenuToolbarButton>
            }
          >
            {flatModifiers.length === 0 ? (
              <AdminEmptyState>No modifier options yet — add Small, Medium, Large, or similar choices.</AdminEmptyState>
            ) : (
              <>
                <MenuListSearchField
                  value={listSearch}
                  onChange={setListSearch}
                  placeholder="Search modifier options by name, group, or item…"
                  aria-label="Search modifier options"
                />
                {filteredModifierOptions.length === 0 ? (
                  <p className="admin-config-text-muted py-2 text-sm">No modifier options match your search.</p>
                ) : (
                  <>
                    <div className={modifierOptionsPager.pageClassName} key={modifierOptionsPager.pageKey}>
                      <table className="admin-config-data-table w-full text-left text-sm">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Group</th>
                            <th>Item</th>
                            <th>Extra price</th>
                            <th>Default</th>
                            <th>Available</th>
                            <th className="admin-menu-item-actions-col" aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {modifierOptionsPager.pagedItems.map((m, index) => (
                            <tr key={m.id} style={{ animationDelay: `${Math.min(index, 12) * 36}ms` }}>
                              <td className="font-semibold admin-config-text">{m.name}</td>
                              <td className="admin-config-text-muted">{m.groupName}</td>
                              <td className="admin-config-text-subtle">{m.itemName}</td>
                              <td>{m.priceDeltaCents ? `+${formatMoneyCents(m.priceDeltaCents)}` : "—"}</td>
                              <td className="admin-config-text-subtle">—</td>
                              <td>
                                <MenuChip tone={m.isActive ? "success" : "muted"}>{m.isActive ? "Yes" : "No"}</MenuChip>
                              </td>
                              <td className="admin-menu-item-actions-col text-right">
                                {modifierOptionMenuActions.length > 0 ? (
                                  <MenuEntityActionsMenu
                                    entityName={m.name}
                                    subtitle="Modifier option actions"
                                    open={openModifierOptionMenuId === m.id}
                                    actions={modifierOptionMenuActions}
                                    onToggle={() => setOpenModifierOptionMenuId((id) => (id === m.id ? null : m.id))}
                                    onAction={(actionId) => handleModifierOptionMenuAction(m, actionId)}
                                  />
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {modifierOptionsPager.showPagination ? (
                      <MenuSurfacePagination
                        page={modifierOptionsPager.page}
                        totalPages={modifierOptionsPager.totalPages}
                        totalItems={modifierOptionsPager.totalItems}
                        pageSize={modifierOptionsPager.pageSize}
                        onPageChange={modifierOptionsPager.goToPage}
                        label="Modifier options pagination"
                      />
                    ) : null}
                  </>
                )}
              </>
            )}
          </MenuSection>
        </div>

        <CreateModifierOptionModal
          open={createModifierOptionOpen}
          onClose={() => setCreateModifierOptionOpen(false)}
          token={token}
          restaurantId={restaurantId}
          venueName={venueName}
          groups={modalModifierGroups}
          onCreated={() => {
            pushToast("Modifier option created.", "success");
            api.refresh();
          }}
          onNavigateTab={onNavigateTab}
        />

      <EditModifierOptionModal
        open={editModifierOptionOpen}
        target={editModifierOptionTarget}
        canEdit={can("modifier_option", "edit")}
        token={token}
        restaurantId={restaurantId}
        onClose={() => {
          setEditModifierOptionOpen(false);
          setEditModifierOptionTarget(null);
        }}
        onSaved={() => {
          pushToast("Modifier option updated.", "success");
          api.refresh();
        }}
      />

      <DeleteModifierOptionModal
        open={Boolean(deleteModifierOptionId)}
        optionName={deleteModifierOptionName}
        optionId={deleteModifierOptionId}
        token={token}
        restaurantId={restaurantId}
        onClose={() => {
          setDeleteModifierOptionId(null);
          setDeleteModifierOptionName(null);
        }}
        onDeleted={() => {
          pushToast("Modifier option deleted.", "success");
          api.refresh();
        }}
      />
      </>
    );
  }

  if (tab === "availability") {
    return (
      <>
        <div className="admin-menu-tab-stack">
          <MenuSection
            title="Availability"
            description="Create custom windows that control when each menu is visible — with hours, days, and your own card colors."
            action={
              <MenuToolbarButton primary disabled={!can("menu", "edit")} onClick={() => setCreateAvailabilityOpen(true)}>
                Create
              </MenuToolbarButton>
            }
          >
            {availabilityCards.length === 0 ? (
              <AdminEmptyState>No availability windows yet — create one to schedule when menus appear.</AdminEmptyState>
            ) : (
              <>
                <MenuListSearchField
                  value={listSearch}
                  onChange={setListSearch}
                  placeholder="Search availability by label, menu, or hours…"
                  aria-label="Search availability"
                />
                {filteredAvailability.length === 0 ? (
                  <p className="admin-config-text-muted py-2 text-sm">No availability windows match your search.</p>
                ) : (
                  <>
                    <div
                      className={`admin-menu-availability-grid ${availabilityPager.pageClassName}`}
                      key={availabilityPager.pageKey}
                    >
                      {availabilityPager.pagedItems.map((card, index) => {
                        const cardKey = `${card.menuId}:${card.key}`;
                        const style = availabilityCardStyle(card.window.color);
                        return (
                          <div
                            key={cardKey}
                            className="admin-menu-availability-card"
                            style={{ ...style, animationDelay: `${Math.min(index, 12) * 36}ms` }}
                          >
                            <div className="admin-menu-availability-card__header">
                              <div className="min-w-0 flex-1">
                                <p className="font-display text-base font-bold admin-config-text truncate">{card.window.label}</p>
                                <p className="admin-config-text-subtle mt-1 text-xs">
                                  {card.window.start} – {card.window.end}
                                </p>
                              </div>
                              {availabilityMenuActions.length > 0 ? (
                                <MenuEntityActionsMenu
                                  entityName={card.window.label}
                                  subtitle="Availability window actions"
                                  open={openAvailabilityMenuKey === cardKey}
                                  actions={availabilityMenuActions}
                                  onToggle={() => setOpenAvailabilityMenuKey((id) => (id === cardKey ? null : cardKey))}
                                  onAction={(actionId) => handleAvailabilityMenuAction(card, actionId)}
                                />
                              ) : null}
                            </div>
                            <p className="admin-config-text-subtle text-xs">{formatAvailabilityDays(card.window.days)}</p>
                            <p className="admin-config-text-muted text-xs">Menu: {card.menuName}</p>
                            <div className="admin-menu-availability-card__footer">
                              <MenuChip tone={card.window.enabled ? "success" : "muted"}>
                                {card.window.enabled ? "Enabled" : "Disabled"}
                              </MenuChip>
                              <span
                                className="admin-menu-availability-card__color-dot"
                                style={{ backgroundColor: card.window.color }}
                                aria-label={`Card color ${card.window.color}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {availabilityPager.showPagination ? (
                      <MenuSurfacePagination
                        page={availabilityPager.page}
                        totalPages={availabilityPager.totalPages}
                        totalItems={availabilityPager.totalItems}
                        pageSize={availabilityPager.pageSize}
                        onPageChange={availabilityPager.goToPage}
                        label="Availability pagination"
                      />
                    ) : null}
                  </>
                )}
              </>
            )}
          </MenuSection>
        </div>

        <CreateAvailabilityModal
          open={createAvailabilityOpen}
          onClose={() => setCreateAvailabilityOpen(false)}
          token={token}
          restaurantId={restaurantId}
          venueName={venueName}
          menus={menus}
          onCreated={() => {
            pushToast("Availability window created.", "success");
            onMenusRefresh();
          }}
          onNavigateTab={onNavigateTab}
        />

        <EditAvailabilityModal
          open={editAvailabilityOpen}
          target={editAvailabilityTarget}
          canEdit={can("menu", "edit")}
          token={token}
          restaurantId={restaurantId}
          menus={menus}
          onClose={() => {
            setEditAvailabilityOpen(false);
            setEditAvailabilityTarget(null);
          }}
          onSaved={() => {
            pushToast("Availability window updated.", "success");
            onMenusRefresh();
          }}
        />

        <DeleteAvailabilityModal
          open={Boolean(deleteAvailabilityKey)}
          windowLabel={deleteAvailabilityLabel}
          windowKey={deleteAvailabilityKey}
          menuId={deleteAvailabilityMenuId}
          menus={menus}
          token={token}
          restaurantId={restaurantId}
          onClose={() => {
            setDeleteAvailabilityKey(null);
            setDeleteAvailabilityMenuId(null);
            setDeleteAvailabilityLabel(null);
          }}
          onDeleted={() => {
            pushToast("Availability window deleted.", "success");
            onMenusRefresh();
          }}
        />
      </>
    );
  }

  if (tab === "images") {
    return (
      <>
        <div className="admin-menu-tab-stack">
          <MenuSection
            title="Menu images & videos"
            description="Three levels: menu cover (whole menu card), categories (group dishes), and items (individual product photos). Pick where each upload belongs so guests see the right image in the right place."
          >
            {!can("media", "view") ? (
              <p className="admin-config-text-subtle text-sm">Your role cannot view menu media.</p>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 text-sm leading-relaxed admin-config-text-subtle dark:border-slate-700/50 dark:bg-slate-900/30">
                  <p>
                    <strong className="admin-config-text">Menu cover</strong> — one hero image on the menu listing.
                  </p>
                  <p className="mt-2">
                    <strong className="admin-config-text">Item photos & videos</strong> — attached to a specific dish; shown when guests browse that product.
                  </p>
                </div>
                <div className="admin-menu-media-toolbar mt-4">
                  <MenuToolbarButton
                    primary
                    disabled={!can("media", "upload")}
                    onClick={() => {
                      setMediaModalKind("image");
                      setMediaModalOpen(true);
                    }}
                  >
                    Add image
                  </MenuToolbarButton>
                  <MenuToolbarButton
                    disabled={!can("media", "upload")}
                    onClick={() => {
                      setMediaModalKind("video");
                      setMediaModalOpen(true);
                    }}
                  >
                    Add video
                  </MenuToolbarButton>
                </div>
                {menus.filter((m) => m.status !== "ARCHIVED").length === 0 ? (
                  <div className="admin-menu-image-placeholder mt-4">
                    <p className="admin-config-text-subtle text-sm">Create a menu surface first, then add cover photos and item media.</p>
                    <AdminBtnPrimary className="mt-3" onClick={() => onNavigateTab("menus")}>
                      Go to Menus
                    </AdminBtnPrimary>
                  </div>
                ) : api.flatItems.length === 0 && realCategories.length === 0 ? (
                  <div className="admin-menu-image-placeholder mt-4">
                    <p className="admin-config-text-subtle text-sm">Add categories and items before uploading product photos.</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <AdminBtnPrimary onClick={() => onNavigateTab("categories")}>Go to Categories</AdminBtnPrimary>
                      <AdminBtnPrimary onClick={() => onNavigateTab("items")}>Go to Items</AdminBtnPrimary>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </MenuSection>
        </div>
        <MenuMediaDestinationModal
          open={mediaModalOpen}
          onClose={() => setMediaModalOpen(false)}
          kind={mediaModalKind}
          token={token}
          restaurantId={restaurantId}
          menus={menus}
          categories={modalCategories}
          items={modalItems}
          canUpload={can("media", "upload")}
          canRemove={can("media", "remove")}
          limits={capabilities?.limits ?? null}
          onNavigateTab={onNavigateTab}
          onRefresh={() => api.refresh()}
        />
      </>
    );
  }

  if (tab === "preview") {
    const previewCategories = realCategories.slice(0, 3);
    return (
      <MenuSection title="Menu preview" description="See how guests will experience the menu before publishing.">
        <div className="admin-menu-preview-grid">
          <MenuPreviewFrame label="Desktop preview" aspect="desktop">
            <div className="p-4 text-left text-sm">
              <p className="font-display text-lg font-bold">{venueName}</p>
              {previewCategories.map((c) => (
                <div key={c.id} className="mt-4">
                  <p className="font-semibold">{c.name}</p>
                  <ul className="mt-2 space-y-1 text-white/70">
                    {c.items.slice(0, 4).map((i) => (
                      <li key={i.id} className="flex justify-between gap-2">
                        <span>{i.name}</span>
                        <span>{formatMoneyCents(i.priceCents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </MenuPreviewFrame>
          <MenuPreviewFrame label="Mobile preview" aspect="mobile">
            <div className="p-3 text-left text-xs">
              {previewCategories[0] ? (
                <>
                  <p className="font-bold">{previewCategories[0].name}</p>
                  {previewCategories[0].items.slice(0, 3).map((i) => (
                    <p key={i.id} className="mt-2 text-white/70">
                      {i.name} · {formatMoneyCents(i.priceCents)}
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-white/60">Add categories to preview.</p>
              )}
            </div>
          </MenuPreviewFrame>
          <MenuPreviewFrame label="QR preview" aspect="qr">
            <p className="p-4 text-center text-xs text-white/70">Use QR codes on the Menus tab to generate a scannable guest link.</p>
          </MenuPreviewFrame>
        </div>
      </MenuSection>
    );
  }

  if (tab === "import-export") {
    const downloadCsv = async (filename: string) => {
      setImportBusy(true);
      const res = await exportMenuCsv(token, restaurantId);
      setImportBusy(false);
      if (!res.ok || !res.csv) {
        pushToast("Export failed", "error");
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      pushToast("Menu exported.", "success");
    };

    const importFromFile = async (file: File) => {
      setImportBusy(true);
      const csv = await file.text();
      const res = await importMenuCsv(token, restaurantId, csv);
      setImportBusy(false);
      if (!res.ok) {
        pushToast(res.message ?? res.error ?? "Import failed", "error");
        return;
      }
      pushToast(`Imported ${res.imported?.rows ?? 0} rows.`, "success");
      api.refresh();
    };

    return (
      <div className="admin-menu-tab-stack">
        <MenuSection title="Menu import / export" description="Move catalog data in and out — CSV and Excel-compatible export.">
          <MenuActionRow>
            <MenuToolbarButton disabled={importBusy} onClick={() => void downloadCsv(`menu-${restaurantId}.csv`)}>
              Export CSV
            </MenuToolbarButton>
            <MenuToolbarButton disabled={importBusy}>
              <label className="cursor-pointer">
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importFromFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </MenuToolbarButton>
            <MenuToolbarButton disabled={importBusy} onClick={() => void downloadCsv(`menu-${restaurantId}.xlsx.csv`)}>
              Export Excel
            </MenuToolbarButton>
            <MenuToolbarButton disabled={importBusy}>
              <label className="cursor-pointer">
                Import Excel
                <input
                  type="file"
                  accept=".csv,.xlsx,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importFromFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </MenuToolbarButton>
          </MenuActionRow>
        </MenuSection>
        <MenuSection title="POS migration" description="Import a CSV export from your legacy POS to bootstrap categories and items.">
          <p className="admin-config-text-subtle text-sm">Use Import CSV with a file that includes category, item, price_cents, and modifier columns.</p>
        </MenuSection>
      </div>
    );
  }

  return null;
}
