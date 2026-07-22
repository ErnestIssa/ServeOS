import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AdminEmptyState,
  AdminPanel,
  AdminRefreshButton,
  AdminSectionHeader,
  subPanelCls
} from "../AdminUi";
import { AdminSkeletonStatGrid, AdminStaleContent } from "../AdminSkeleton";
import { usePageRecoverySync, useSilentRevalidate } from "../sync/adminPageSync";
import { CONFIG_PRESET_DESCRIPTIONS, MENU_TAB_LABELS, MENU_TABS, type MenuSectionTab } from "./configRouting";
import { AdminMenuTabContent } from "./menu/AdminMenuTabContent";
import { AdminMenusTabPanel } from "./menu/AdminMenusTabPanel";
import { MenuQrCodesPanel } from "./menu/MenuQrCodesPanel";
import { useAdminMenu } from "./useAdminMenu";
import { useAdminMenus } from "./useAdminMenus";
import { useMenuCapabilities } from "./useMenuCapabilities";

const TAB_TRANSITION = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

type Props = {
  token: string | null;
  restaurantId: string | null;
  venueName: string;
  initialTab?: MenuSectionTab | null;
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
      <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">{label}</p>
      <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="admin-stat-hint mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

export function AdminConfigMenuPage({ token, restaurantId, venueName, initialTab = null }: Props) {
  const [tab, setTab] = useState<MenuSectionTab>(initialTab ?? "menus");
  const api = useAdminMenu(token, restaurantId);
  const menusApi = useAdminMenus(token, restaurantId, "active");
  const liveMenusApi = useAdminMenus(token, restaurantId, "PUBLISHED", tab === "live");
  const archivedMenusApi = useAdminMenus(token, restaurantId, "ARCHIVED", tab === "archived");
  const menuCaps = useMenuCapabilities(token, restaurantId);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const refreshTree = api.refresh;
  const refreshMenus = menusApi.refresh;
  const refreshCaps = menuCaps.refresh;
  const refreshLive = liveMenusApi.refresh;
  const refreshArchived = archivedMenusApi.refresh;

  const syncAll = useCallback(
    async (soft = false) => {
      const opts = soft ? ({ soft: true } as const) : undefined;
      await Promise.all([
        refreshTree(opts),
        refreshMenus(opts),
        refreshCaps(),
        tab === "live" ? refreshLive(opts) : Promise.resolve(),
        tab === "archived" ? refreshArchived(opts) : Promise.resolve()
      ]);
    },
    [refreshTree, refreshMenus, refreshCaps, refreshLive, refreshArchived, tab]
  );

  const { recover, recovering } = usePageRecoverySync([() => syncAll(false)]);
  useSilentRevalidate(() => syncAll(true), {
    enabled: Boolean(token && restaurantId),
    minIntervalMs: 20_000,
    intervalMs: 60_000
  });

  const menuSurfaceCount = menusApi.menus.filter((m) => m.status !== "ARCHIVED").length;
  const publishedMenuCount = menusApi.menus.filter((m) => m.status === "PUBLISHED").length;

  const headerRefreshing =
    recovering ||
    api.meta.refreshing ||
    menusApi.meta.refreshing ||
    (tab === "live" && liveMenusApi.meta.refreshing) ||
    (tab === "archived" && archivedMenusApi.meta.refreshing);

  if (!token || !restaurantId) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-menu-page">
        <AdminSectionHeader eyebrowText="Configuration" title="Menu" description={CONFIG_PRESET_DESCRIPTIONS.menu} />
        <div className={`${subPanelCls} admin-config-section mt-8 p-6`}>
          <AdminEmptyState>Sign in and select a venue to manage menus.</AdminEmptyState>
        </div>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-menu-page">
      <AdminSectionHeader
        eyebrowText="Configuration"
        title="Menu"
        description={CONFIG_PRESET_DESCRIPTIONS.menu}
        action={
          <AdminRefreshButton
            onRefresh={() => void recover()}
            refreshing={headerRefreshing}
            label="Sync menu data"
          />
        }
      />

      <AdminStaleContent refreshing={headerRefreshing && !recovering ? api.meta.refreshing : headerRefreshing}>
        {api.meta.initialLoading ? (
          <div className="mt-8">
            <AdminSkeletonStatGrid />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Menus" value={String(menuSurfaceCount || api.stats.menus)} hint={`${publishedMenuCount} published`} />
            <StatTile label="Categories" value={String(api.stats.categories)} hint={`${api.stats.activeCategories} active`} />
            <StatTile label="Items" value={String(api.stats.items)} hint={`${api.stats.activeItems} active`} />
            <StatTile label="Modifiers" value={String(api.stats.modifiers)} hint="Options across items" />
          </div>
        )}

        <div className="admin-config-tabs admin-menu-tabs mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Menu sections">
          {MENU_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`admin-page-tab shrink-0 ${tab === t ? "admin-page-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {MENU_TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            className="mt-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={TAB_TRANSITION}
          >
            <div className="admin-menu-tab-panel admin-menu-tab-panel--bare">
              {tab === "menus" ? (
                <AdminMenusTabPanel
                  menusApi={menusApi}
                  variant="active"
                  token={token}
                  restaurantId={restaurantId}
                  venueName={venueName}
                  initialLoading={api.meta.initialLoading}
                  can={menuCaps.can}
                />
              ) : tab === "live" ? (
                <AdminMenusTabPanel
                  menusApi={liveMenusApi}
                  variant="live"
                  token={token}
                  restaurantId={restaurantId}
                  venueName={venueName}
                  initialLoading={liveMenusApi.meta.initialLoading}
                  can={menuCaps.can}
                />
              ) : tab === "archived" ? (
                <AdminMenusTabPanel
                  menusApi={archivedMenusApi}
                  variant="archived"
                  token={token}
                  restaurantId={restaurantId}
                  venueName={venueName}
                  initialLoading={archivedMenusApi.meta.initialLoading}
                  can={menuCaps.can}
                />
              ) : tab === "qr-codes" ? (
                <MenuQrCodesPanel token={token} restaurantId={restaurantId} />
              ) : (
                <AdminMenuTabContent
                  tab={tab}
                  api={api}
                  token={token}
                  restaurantId={restaurantId}
                  venueName={venueName}
                  initialLoading={api.meta.initialLoading}
                  capabilities={menuCaps.capabilities}
                  can={menuCaps.can}
                  menus={menusApi.menus}
                  onNavigateTab={setTab}
                  onMenusRefresh={() => void menusApi.refresh()}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {api.meta.error ? <p className="mt-4 text-sm text-rose-600">{api.meta.error}</p> : null}
      </AdminStaleContent>
    </AdminPanel>
  );
}
