import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import {
  exportMenuCsv,
  getAvailabilityOverview,
  importMenuCsv,
  manageAvailability,
  type AvailabilityCardPayload,
  type MenuCapabilitiesPayload,
  type MenuSurfaceRow
} from "../../../api";
import { AdminBtnPrimary, AdminEmptyState } from "../../AdminUi";
import { AdminSkeletonTable } from "../../AdminSkeleton";
import { useAdminToast } from "../../AdminToast";
import type { MenuSectionTab } from "../configRouting";
import type { useAdminMenu } from "../useAdminMenu";
import { AdminCategoriesTabPanel } from "./AdminCategoriesTabPanel";
import { AdminItemsTabPanel } from "./AdminItemsTabPanel";
import { AdminModifierGroupsTabPanel } from "./AdminModifierGroupsTabPanel";
import { AdminModifierOptionsTabPanel } from "./AdminModifierOptionsTabPanel";
import { AvailabilityManageDrawer } from "./AvailabilityManageDrawer";
import { AvailabilityProfileDrawer } from "./AvailabilityProfileDrawer";
import { CreateAvailabilityModal } from "./CreateAvailabilityModal";
import { EditAvailabilityModal, type EditAvailabilityTarget } from "./EditAvailabilityModal";
import { DeleteAvailabilityModal } from "./DeleteAvailabilityModal";
import {
  availabilityCardStyle,
  formatAvailabilityChannels,
  formatAvailabilityDays,
  formatAvailabilityLocations,
  listAvailabilityCards,
  STATUS_LABELS
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
  UI_MOCK_AVAILABILITY
} from "./menuListUiMocks";
import {
  applyAvailabilityListFilters,
  applyAvailabilityListSort,
  AVAILABILITY_LIST_QUERY
} from "./menuListQuery";
import { useMenuListPagination } from "./useMenuListPagination";
import { MenuPageModalShell, ProfileModalFooter } from "./menuPageModalShell";

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
  const [createAvailabilityOpen, setCreateAvailabilityOpen] = useState(false);
  const [manageAvailabilityOpen, setManageAvailabilityOpen] = useState(false);
  const [openAvailabilityMenuKey, setOpenAvailabilityMenuKey] = useState<string | null>(null);
  const [editAvailabilityTarget, setEditAvailabilityTarget] = useState<EditAvailabilityTarget | null>(null);
  const [editAvailabilityOpen, setEditAvailabilityOpen] = useState(false);
  const [deleteAvailabilityKey, setDeleteAvailabilityKey] = useState<string | null>(null);
  const [deleteAvailabilityMenuId, setDeleteAvailabilityMenuId] = useState<string | null>(null);
  const [deleteAvailabilityLabel, setDeleteAvailabilityLabel] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [availabilityFilters, setAvailabilityFilters] = useState<string[]>([]);
  const [availabilitySort, setAvailabilitySort] = useState(AVAILABILITY_LIST_QUERY.defaultSort);
  const [availabilityOverviewCards, setAvailabilityOverviewCards] = useState<AvailabilityCardPayload[]>([]);
  const [availabilityLocations, setAvailabilityLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAvailabilityKeys, setSelectedAvailabilityKeys] = useState<Set<string>>(new Set());
  const [previewAvailabilityCard, setPreviewAvailabilityCard] = useState<AvailabilityCardPayload | null>(null);
  const [detailsAvailabilityCard, setDetailsAvailabilityCard] = useState<AvailabilityCardPayload | null>(null);
  const [availabilityTimezone, setAvailabilityTimezone] = useState<string | null>(null);
  const [availabilityBusyKey, setAvailabilityBusyKey] = useState<string | null>(null);

  useEffect(() => {
    setListSearch("");
    setAvailabilityFilters([]);
    setAvailabilitySort(AVAILABILITY_LIST_QUERY.defaultSort);
    setSelectedAvailabilityKeys(new Set());
  }, [tab]);

  const refreshAvailabilityOverview = useCallback(async () => {
    const res = await getAvailabilityOverview(token, restaurantId);
    if (res.ok && res.cards) {
      setAvailabilityOverviewCards(res.cards);
      setAvailabilityLocations(res.locations ?? []);
      setAvailabilityTimezone(res.restaurant?.timezone ?? null);
    } else {
      const fallback = listAvailabilityCards(menus).map((card) => ({
        ...card,
        menuStatus: (menus.find((m) => m.id === card.menuId)?.status ?? "DRAFT") as AvailabilityCardPayload["menuStatus"],
        evaluation: {
          orderable: card.window.enabled,
          status: card.window.enabled ? ("AVAILABLE" as const) : ("UNAVAILABLE" as const),
          reasons: [
            {
              ok: card.window.enabled,
              code: "local",
              label: card.window.enabled ? "Enabled" : "Disabled"
            }
          ],
          matchedWindowKey: card.window.enabled ? card.key : null
        }
      }));
      setAvailabilityOverviewCards(fallback);
    }
  }, [token, restaurantId, menus]);

  useEffect(() => {
    if (tab !== "availability") return;
    void refreshAvailabilityOverview();
  }, [tab, refreshAvailabilityOverview]);

  const availabilityCards = useMemo(() => {
    const mockCards: AvailabilityCardPayload[] = UI_MOCK_AVAILABILITY.map((card) => ({
      ...card,
      menuStatus: "PUBLISHED",
      evaluation: {
        orderable: true,
        status: "AVAILABLE",
        reasons: [
          { ok: true, code: "preview", label: "Preview mock" },
          { ok: true, code: "day", label: formatAvailabilityDays(card.window.days) },
          { ok: true, code: "hours", label: `${card.window.start}–${card.window.end}` }
        ],
        matchedWindowKey: card.key
      }
    }));
    return [...availabilityOverviewCards, ...mockCards];
  }, [availabilityOverviewCards]);

  const categories = api.menu?.categories ?? [];

  const filteredAvailability = useMemo(() => {
    const searched = availabilityCards.filter((card) =>
      matchesListSearch(
        listSearch,
        card.window.label,
        card.menuName,
        card.window.start,
        card.window.end,
        card.evaluation.status,
        card.window.enabled ? "enabled" : "disabled"
      )
    );
    return applyAvailabilityListSort(
      applyAvailabilityListFilters(searched, availabilityFilters),
      availabilitySort
    );
  }, [availabilityCards, listSearch, availabilityFilters, availabilitySort]);

  const availabilityPager = useMenuListPagination(filteredAvailability, {
    resetKey: `${listSearch}:${availabilityFilters.join(",")}:${availabilitySort}`
  });

  const toastPreviewOnly = () => {
    pushToast("Preview row only — not connected to the backend.", "error");
  };

  const cardKeyOf = (card: AvailabilityCardPayload) => `${card.menuId}:${card.key}`;

  const availabilityMenuActionsFor = (card: AvailabilityCardPayload) => {
    const actions: Array<{ id: string; label: string; danger?: boolean }> = [
      { id: "details", label: "Schedule details" }
    ];
    if (!can("menu", "edit")) return actions;

    actions.push(
      { id: "edit", label: "Edit availability" },
      { id: "preview", label: "Preview availability" }
    );

    // Only offer the action that changes state — backend evaluation is SSOT.
    if (card.evaluation.orderable) {
      actions.push({ id: "make_unavailable", label: "Make unavailable now" });
    } else {
      actions.push({ id: "make_available", label: "Make available now" });
    }

    return actions;
  };

  const runCardManage = async (card: AvailabilityCardPayload, action: Parameters<typeof manageAvailability>[2]["action"]) => {
    const k = cardKeyOf(card);
    setAvailabilityBusyKey(k);
    const res = await manageAvailability(token, restaurantId, {
      action,
      refs: [{ menuId: card.menuId, key: card.key }]
    });
    setAvailabilityBusyKey(null);
    if (!res.ok) {
      pushToast(res.message ?? "Could not update availability.", "error");
      return;
    }
    pushToast("Availability updated.", "success");
    onMenusRefresh();
    await refreshAvailabilityOverview();
  };

  const handleAvailabilityMenuAction = (card: AvailabilityCardPayload, actionId: string) => {
    setOpenAvailabilityMenuKey(null);
    if (actionId === "details") {
      setDetailsAvailabilityCard(card);
      return;
    }
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
    if (actionId === "preview") {
      setPreviewAvailabilityCard(card);
      return;
    }
    if (
      actionId === "make_available" ||
      actionId === "make_unavailable"
    ) {
      void runCardManage(card, actionId);
    }
  };

  const toggleAvailabilitySelect = (card: AvailabilityCardPayload, checked: boolean) => {
    const k = cardKeyOf(card);
    setSelectedAvailabilityKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(k);
      else next.delete(k);
      return next;
    });
  };

  const realCategories = api.menu?.categories ?? [];

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
      <AdminModifierGroupsTabPanel
        api={api}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        can={can}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  if (tab === "modifier-options") {
    return (
      <AdminModifierOptionsTabPanel
        api={api}
        token={token}
        restaurantId={restaurantId}
        venueName={venueName}
        can={can}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  if (tab === "availability") {
    const realCardCount = availabilityOverviewCards.length;
    return (
      <>
        <div className="admin-menu-tab-stack">
          <MenuSection
            title="Availability"
            description="Rule-based windows evaluated by the backend SSOT — schedule, stock, channels, locations, and visibility with clear reasons."
            action={
              <div className="admin-menu-action-row">
                {realCardCount > 0 ? (
                  <MenuToolbarButton
                    onClick={() => setManageAvailabilityOpen(true)}
                  >
                    {selectedAvailabilityKeys.size > 0
                      ? `Manage selected (${selectedAvailabilityKeys.size})`
                      : "Manage"}
                  </MenuToolbarButton>
                ) : null}
                <MenuToolbarButton primary disabled={!can("menu", "edit")} onClick={() => setCreateAvailabilityOpen(true)}>
                  Create
                </MenuToolbarButton>
              </div>
            }
          >
            {availabilityCards.length === 0 ? (
              <AdminEmptyState>No availability windows yet — create one to schedule when menus appear.</AdminEmptyState>
            ) : (
              <div className="admin-menu-availability-stack">
                <MenuListSearchField
                  value={listSearch}
                  onChange={setListSearch}
                  placeholder="Search by label, status, menu, or hours…"
                  aria-label="Search availability"
                  filterGroups={AVAILABILITY_LIST_QUERY.filterGroups}
                  sortOptions={AVAILABILITY_LIST_QUERY.sortOptions}
                  defaultSort={AVAILABILITY_LIST_QUERY.defaultSort}
                  activeFilters={availabilityFilters}
                  activeSort={availabilitySort}
                  totalCount={availabilityCards.length}
                  resultCount={filteredAvailability.length}
                  onFiltersChange={setAvailabilityFilters}
                  onSortChange={setAvailabilitySort}
                  filterTitle="Filter availability"
                  sortTitle="Sort availability"
                />
                {filteredAvailability.length === 0 ? (
                  <p className="admin-config-text-muted text-sm">No availability windows match your search or filters.</p>
                ) : (
                  <>
                    <div
                      className={`admin-menu-availability-grid admin-menu-availability-grid--rich ${availabilityPager.pageClassName}`}
                      key={availabilityPager.pageKey}
                    >
                      {availabilityPager.pagedItems.map((card, index) => {
                        const cardKey = cardKeyOf(card);
                        const style = availabilityCardStyle(card.window.color);
                        const selected = selectedAvailabilityKeys.has(cardKey);
                        const isMock = isUiOnlyListId(card.key) || isUiOnlyListId(card.menuId);
                        const status = card.evaluation.status;
                        const reasons = card.evaluation.reasons.filter((r) => r.ok).slice(0, 5);
                        const blocked = card.evaluation.reasons.find((r) => !r.ok);
                        const menuActions = availabilityMenuActionsFor(card);
                        return (
                          <div
                            key={cardKey}
                            className={`admin-menu-availability-card admin-menu-availability-card--rich${selected ? " is-selected" : ""}${availabilityBusyKey === cardKey ? " is-busy" : ""}`}
                            style={{ ...style, animationDelay: `${Math.min(index, 12) * 36}ms` }}
                          >
                            <div className="admin-menu-availability-card__header">
                              <label className="admin-menu-availability-card__select">
                                <input
                                  type="checkbox"
                                  className="admin-menu-surface-checkbox"
                                  checked={selected}
                                  disabled={isMock}
                                  aria-label={`Select ${card.window.label}`}
                                  onChange={(e) => toggleAvailabilitySelect(card, e.target.checked)}
                                />
                              </label>
                              <div className="admin-menu-availability-card__meta min-w-0 flex-1">
                                <p className="font-display text-base font-bold admin-config-text truncate">{card.window.label}</p>
                                <p className="admin-config-text-muted text-[0.65rem] truncate">{card.menuName}</p>
                              </div>
                              {menuActions.length > 0 ? (
                                <MenuEntityActionsMenu
                                  entityName={card.window.label}
                                  subtitle="Availability actions"
                                  open={openAvailabilityMenuKey === cardKey}
                                  actions={menuActions}
                                  onToggle={() => setOpenAvailabilityMenuKey((id) => (id === cardKey ? null : cardKey))}
                                  onAction={(actionId) => handleAvailabilityMenuAction(card, actionId)}
                                />
                              ) : null}
                            </div>

                            <div className="admin-avail-status-row">
                              <MenuChip
                                tone={
                                  card.evaluation.orderable
                                    ? "success"
                                    : status === "OUT_OF_STOCK"
                                      ? "violet"
                                      : "muted"
                                }
                              >
                                {STATUS_LABELS[status]}
                              </MenuChip>
                            </div>

                            <div className="admin-avail-because">
                              <p className="admin-avail-because__title">
                                {card.evaluation.orderable ? "Available because" : "Unavailable because"}
                              </p>
                              <ul className="admin-avail-reason-list admin-avail-reason-list--compact">
                                {card.evaluation.orderable
                                  ? reasons.map((r) => (
                                      <li key={`${r.code}-${r.label}`} className="is-ok">
                                        <span aria-hidden>✓</span> {r.label}
                                      </li>
                                    ))
                                  : blocked ? (
                                      <li className="is-blocked">
                                        <span aria-hidden>✗</span> {blocked.label}
                                      </li>
                                    ) : (
                                      <li className="is-blocked">
                                        <span aria-hidden>✗</span> Not orderable
                                      </li>
                                    )}
                              </ul>
                            </div>

                            <div className="admin-avail-meta-lines">
                              <span>{formatAvailabilityDays(card.window.days)}</span>
                              <span>
                                {card.window.start}–{card.window.end}
                              </span>
                              <span>{formatAvailabilityLocations(card.window)}</span>
                              <span>{formatAvailabilityChannels(card.window.channels)}</span>
                              <span>{card.window.outOfStock ? "Out of stock" : "Stock OK"}</span>
                            </div>

                            <div className="admin-menu-availability-card__footer admin-avail-card-actions">
                              <button
                                type="button"
                                className="admin-avail-card-link"
                                disabled={isMock}
                                onClick={() =>
                                  handleAvailabilityMenuAction(card, "edit")
                                }
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="admin-avail-card-link"
                                onClick={() => handleAvailabilityMenuAction(card, "preview")}
                              >
                                Preview
                              </button>
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
              </div>
            )}
          </MenuSection>
        </div>

        <AvailabilityManageDrawer
          open={manageAvailabilityOpen}
          cards={availabilityOverviewCards}
          selectedKeys={selectedAvailabilityKeys}
          menus={menus}
          locations={availabilityLocations}
          token={token}
          restaurantId={restaurantId}
          venueName={venueName}
          onClose={() => setManageAvailabilityOpen(false)}
          onRefresh={() => {
            onMenusRefresh();
            void refreshAvailabilityOverview();
          }}
          onClearSelection={() => setSelectedAvailabilityKeys(new Set())}
          onEditWindow={(card) => {
            setEditAvailabilityTarget({
              key: card.key,
              menuId: card.menuId,
              menuName: card.menuName,
              window: card.window
            });
            setEditAvailabilityOpen(true);
          }}
          onPreviewWindow={(card) => setPreviewAvailabilityCard(card)}
        />

        <AvailabilityProfileDrawer
          card={detailsAvailabilityCard}
          open={Boolean(detailsAvailabilityCard)}
          timezone={availabilityTimezone}
          venueName={venueName}
          onClose={() => setDetailsAvailabilityCard(null)}
        />

        {previewAvailabilityCard ? (
          <MenuPageModalShell
            open
            onClose={() => setPreviewAvailabilityCard(null)}
            title={`Preview · ${previewAvailabilityCard.window.label}`}
            titleId="avail-preview-modal"
            stackLevel="overlay"
            maxWidthClass="max-w-md"
          >
            <p className="admin-avail-because__title mb-2">
              Orderable: {previewAvailabilityCard.evaluation.orderable ? "YES" : "NO"}
            </p>
            <p className="admin-config-text-muted text-xs mb-3">
              Status: {STATUS_LABELS[previewAvailabilityCard.evaluation.status]} · {previewAvailabilityCard.menuName}
            </p>
            <ul className="admin-avail-reason-list">
              {previewAvailabilityCard.evaluation.reasons.map((r) => (
                <li key={`${r.code}-${r.label}`} className={r.ok ? "is-ok" : "is-blocked"}>
                  <span aria-hidden>{r.ok ? "✓" : "✗"}</span> {r.label}
                </li>
              ))}
            </ul>
            <ProfileModalFooter
              cancelLabel="Close"
              onCancel={() => setPreviewAvailabilityCard(null)}
              confirmLabel="Edit"
              onConfirm={() => {
                const card = previewAvailabilityCard;
                setPreviewAvailabilityCard(null);
                handleAvailabilityMenuAction(card, "edit");
              }}
            />
          </MenuPageModalShell>
        ) : null}

        <CreateAvailabilityModal
          open={createAvailabilityOpen}
          onClose={() => setCreateAvailabilityOpen(false)}
          token={token}
          restaurantId={restaurantId}
          venueName={venueName}
          menus={menus}
          locations={availabilityLocations}
          onCreated={() => {
            pushToast("Availability window created.", "success");
            onMenusRefresh();
            void refreshAvailabilityOverview();
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
          locations={availabilityLocations}
          onClose={() => {
            setEditAvailabilityOpen(false);
            setEditAvailabilityTarget(null);
          }}
          onSaved={() => {
            pushToast("Availability window updated.", "success");
            onMenusRefresh();
            void refreshAvailabilityOverview();
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
            void refreshAvailabilityOverview();
          }}
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
