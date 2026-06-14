import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingScreen } from "@serveos/core-loading";
import {
  AdminBtnPrimary,
  AdminBtnPrimaryLg,
  AdminBtnSecondary,
  AdminBtnSecondaryLg,
  AdminControlRoomPanel,
  AdminEmptyState,
  AdminHeader,
  AdminInput,
  AdminLabel,
  AdminPanel,
  AdminSectionHeader,
  AdminSelect,
  AdminStatusLine,
  AdminVenueCard,
  adminMain,
  adminWorkspaceMain,
  subPanelCls
} from "./AdminUi";
import { AdminThemeFab, AdminWorkspaceShell, useAdminTheme } from "./AdminNav";
import { MobileFloatingDock } from "../MobileFloatingDock";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import {
  createCategory,
  createMenuItem,
  createModifierGroup,
  createModifierOption,
  createRestaurant,
  fetchMe,
  getMenuAdmin,
  listRestaurantOrders,
  listRestaurants,
  login,
  logout,
  mapApiErrorToMessage,
  orderEventsWebSocketUrl,
  patchOrderStatus,
  setActiveRestaurant,
  signup,
  type AuthUser,
  type MenuTree,
  type OrderRow
} from "../api";
import { clearAdminToken, consumeTokenFromUrl, persistAdminToken, readStoredAdminToken } from "../authStorage";
import { confirmEmailChange } from "./profile/accountApi";
import {
  dismissOwnerTrialNotice,
  fetchOwnerTrialNotice,
  fetchWorkspaceDeploymentStatus,
  type DeploymentQuote,
  type TrialNoticePayload
} from "./deploymentApi";
import { DEFAULT_ADMIN_HASH, readAdminHash, readOwnerContactName } from "./adminNavContent";
import { AdminPageTransition } from "./AdminPageTransition";
import { AdminVenueControlCentrePage } from "./AdminVenueControlCentre";
import { AdminTopPageView } from "./AdminTopPages";
import { AdminWorkspaceView } from "./AdminWorkspaces";
import { ADMIN_VENUE_CONTROL_HASH, adminFullPageKey } from "./adminTopHashes";
import { ADMIN_NAV_SYNC_EVENT, parseAdminRoute } from "./adminWorkspaceRouting";
import { LogoutConfirmModal } from "./LogoutConfirmModal";
import { OwnerTrialNoticeModal } from "./OwnerTrialNoticeModal";
import { WorkspaceLaunchModal } from "./WorkspaceLaunchModal";

function formatMoney(cents: number) {
  return formatMoneyCents(cents);
}

type Props = {
  onAfterLogout: () => void;
};

export function AdminDashboardPage({ onAfterLogout }: Props) {
  const [appReady, setAppReady] = useState(false);
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("password123");
  const [token, setToken] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<
    Array<{ id: string; name: string; role: string; status?: string; companyId?: string | null }>
  >([]);
  const [restaurantName, setRestaurantName] = useState("My Restaurant");
  const [status, setStatus] = useState<string>("");

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [menu, setMenu] = useState<MenuTree | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("Mains");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemName, setItemName] = useState("Burger");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState("12.00");
  const [modItemId, setModItemId] = useState("");
  const [modGroupName, setModGroupName] = useState("Size");
  const [modGroupId, setModGroupId] = useState("");
  const [modOptionName, setModOptionName] = useState("Large");
  const [modOptionDelta, setModOptionDelta] = useState("1.50");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownerUser, setOwnerUser] = useState<AuthUser | null>(null);
  const [hasWorkspaceDeployment, setHasWorkspaceDeployment] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [trialNotice, setTrialNotice] = useState<TrialNoticePayload | null>(null);
  const [trialNoticeOpen, setTrialNoticeOpen] = useState(false);
  const [trialNoticeDismissing, setTrialNoticeDismissing] = useState(false);
  const [venueSwitching, setVenueSwitching] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [adminHash, setAdminHash] = useState(readAdminHash);
  const { theme, toggleTheme } = useAdminTheme();

  useEffect(() => {
    const onHash = () => {
      setAdminHash(readAdminHash());
      window.scrollTo({ top: 0, behavior: "auto" });
    };
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<{ hash: string }>).detail;
      if (detail?.hash) setAdminHash(detail.hash);
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener(ADMIN_NAV_SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener(ADMIN_NAV_SYNC_EVENT, onSync);
    };
  }, []);

  const loadTrialNotice = useCallback(async (t: string) => {
    const res = await fetchOwnerTrialNotice(t);
    if (!res.ok) return;
    if (res.notice) {
      setTrialNotice(res.notice);
      setTrialNoticeOpen(true);
    } else {
      setTrialNotice(null);
      setTrialNoticeOpen(false);
    }
  }, []);

  async function hydrateUser(t: string) {
    const res = await fetchMe(t);
    if (!res.ok || !res.user?.id) return;
    setUserId(res.user.id);
    setOwnerUser(res.user);
    const status = await fetchWorkspaceDeploymentStatus(t);
    setHasWorkspaceDeployment(Boolean(status.ok && status.hasDeployment));
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) setAppReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshRestaurants(t: string) {
    const res = await listRestaurants(t);
    if (!res.ok) {
      setStatus(res.error ?? "failed_to_list_restaurants");
      return;
    }
    setRestaurants(res.restaurants ?? []);
  }

  useEffect(() => {
    const urlToken = consumeTokenFromUrl();
    const stored = urlToken ?? readStoredAdminToken();
    if (!stored) return;
    setToken(stored);
    setStatus("Signed in");
    void refreshRestaurants(stored);
    void hydrateUser(stored);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const emailChangeToken = params.get("emailChangeToken")?.trim();
    if (!emailChangeToken) return;

    void (async () => {
      const res = await confirmEmailChange(token, emailChangeToken);
      params.delete("emailChangeToken");
      const query = params.toString();
      const clean = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", clean);

      if (res.ok && res.token) {
        persistAdminToken(res.token);
        setToken(res.token);
        if (res.email) {
          setOwnerUser((prev) => (prev ? { ...prev, email: res.email } : prev));
        }
        setStatus("Email updated. You are signed in with your new address.");
        window.location.hash = "#top-profile";
      } else {
        setStatus(mapApiErrorToMessage(res));
      }
    })();
  }, [token]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.adminTheme = theme;
    if (token) {
      root.classList.add("admin-session");
    } else {
      root.classList.remove("admin-session");
    }
    return () => {
      delete root.dataset.adminTheme;
      root.classList.remove("admin-session");
    };
  }, [theme, token]);

  useEffect(() => {
    if (!token || !userId || hasWorkspaceDeployment) {
      setLaunchModalOpen(false);
      return;
    }
    const timer = window.setTimeout(() => setLaunchModalOpen(true), 5000);
    return () => clearTimeout(timer);
  }, [token, userId, hasWorkspaceDeployment]);

  useEffect(() => {
    if (!token || !hasWorkspaceDeployment || launchModalOpen) return;
    const timer = window.setTimeout(() => {
      void loadTrialNotice(token);
    }, 600);
    return () => clearTimeout(timer);
  }, [token, hasWorkspaceDeployment, launchModalOpen, loadTrialNotice]);

  async function handleDismissTrialNotice() {
    if (!token || !trialNotice) return;
    setTrialNoticeDismissing(true);
    const res = await dismissOwnerTrialNotice(token, trialNotice.id);
    setTrialNoticeDismissing(false);
    if (!res.ok) return;
    if (res.nextNotice) {
      setTrialNotice(res.nextNotice);
      setTrialNoticeOpen(true);
    } else {
      setTrialNotice(null);
      setTrialNoticeOpen(false);
    }
  }

  function handleDeploymentConfirmed(quote: DeploymentQuote) {
    setHasWorkspaceDeployment(true);
    setLaunchModalOpen(false);
    setStatus(
      `${quote.planName} deployment confirmed â€” ${quote.trialDays}-day trial started (${Math.round(quote.totalMonthlyOre / 100).toLocaleString("sv-SE")} kr/month after trial).`
    );
    if (token) {
      window.setTimeout(() => void loadTrialNotice(token), 400);
    }
  }

  async function refreshMenu(t: string, restaurantId: string) {
    const res = await getMenuAdmin(t, restaurantId);
    if (!res.ok || !res.categories) {
      setStatus(res.error ?? "menu_load_failed");
      setMenu(null);
      return;
    }
    setMenu({
      restaurant: res.restaurant!,
      categories: res.categories
    });
  }

  async function refreshOrders(t: string, restaurantId: string) {
    const res = await listRestaurantOrders(t, restaurantId);
    if (!res.ok) {
      setOrders([]);
      return;
    }
    setOrders(res.orders ?? []);
  }

  const categoryOptions = useMemo(() => menu?.categories ?? [], [menu]);
  const flatItems = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    for (const c of categoryOptions) {
      for (const it of c.items) {
        out.push({ id: it.id, label: `${c.name} â†’ ${it.name}` });
      }
    }
    return out;
  }, [categoryOptions]);

  const flatGroups = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    for (const c of categoryOptions) {
      for (const it of c.items) {
        for (const g of it.modifierGroups) {
          out.push({ id: g.id, label: `${it.name} â†’ ${g.name}` });
        }
      }
    }
    return out;
  }, [categoryOptions]);

  useEffect(() => {
    if (!token || !selectedRestaurantId) return;
    void refreshMenu(token, selectedRestaurantId);
    void refreshOrders(token, selectedRestaurantId);
  }, [token, selectedRestaurantId]);

  useEffect(() => {
    if (!restaurants.length) return;
    if (selectedRestaurantId) return;
    const preferred = ownerUser?.preferredRestaurantId?.trim();
    const match = preferred ? restaurants.find((r) => r.id === preferred) : null;
    setSelectedRestaurantId(match?.id ?? restaurants[0]!.id);
  }, [restaurants, selectedRestaurantId, ownerUser?.preferredRestaurantId]);

  async function handleSelectRestaurant(id: string) {
    if (!token || !id || id === selectedRestaurantId || venueSwitching) return;
    setVenueSwitching(true);
    const res = await setActiveRestaurant(token, id);
    if (!res.ok) {
      setVenueSwitching(false);
      setStatus(mapApiErrorToMessage(res));
      return;
    }
    window.location.hash = DEFAULT_ADMIN_HASH;
    window.location.reload();
  }

  useEffect(() => {
    if (!token || !selectedRestaurantId) return;
    const url = orderEventsWebSocketUrl({ restaurantId: selectedRestaurantId, token });
    const ws = new WebSocket(url);
    ws.onmessage = () => {
      void listRestaurantOrders(token, selectedRestaurantId).then((res) => {
        if (res.ok) setOrders(res.orders ?? []);
      });
    };
    return () => ws.close();
  }, [token, selectedRestaurantId]);

  function clearLocalSession() {
    setToken(null);
    setUserId(null);
    setOwnerUser(null);
    setHasWorkspaceDeployment(false);
    setLaunchModalOpen(false);
    setTrialNotice(null);
    setTrialNoticeOpen(false);
    clearAdminToken();
    setRestaurants([]);
    setSelectedRestaurantId("");
    setMenu(null);
    setOrders([]);
    setStatus("Signed out");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function requestSignOut() {
    setLogoutError(null);
    setLogoutModalOpen(true);
  }

  async function confirmSignOut() {
    if (!token || logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError(null);
    const res = await logout(token);
    if (!res.ok) {
      setLogoutBusy(false);
      setLogoutError(mapApiErrorToMessage(res));
      return;
    }
    clearLocalSession();
    setLogoutBusy(false);
    setLogoutModalOpen(false);
    onAfterLogout();
  }

  const ownerDisplayName = readOwnerContactName(ownerUser?.signupProfile);
  const adminRoute = parseAdminRoute(adminHash);
  const showFullPage = adminRoute.kind === "full-page";
  const selectedVenueName = restaurants.find((r) => r.id === selectedRestaurantId)?.name ?? "";

  const catalogAndOrders = (
    <>
      <AdminPanel id="menu-admin" className={token ? "" : "mt-8"}>
        <AdminSectionHeader
          eyebrowText={token ? "Configuration" : "Catalog"}
          title={token ? "Menu builder" : "Menu management"}
          description={
            token
              ? "Select a venue, add categories and items, then modifier groups and options."
              : "Select a venue, add categories and items, then modifier groups and options. Use the restaurant ID in the customer app to preview the public menu."
          }
        />

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <AdminLabel className="flex-1">
            Active restaurant
            <AdminSelect
              disabled={!token || restaurants.length === 0}
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
            >
              <option value="">â€”</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </AdminSelect>
          </AdminLabel>
          <AdminBtnSecondary
            disabled={!token || !selectedRestaurantId}
            onClick={() => token && selectedRestaurantId && void refreshMenu(token, selectedRestaurantId)}
          >
            Reload menu
          </AdminBtnSecondary>
        </div>

        <div className="mt-8 grid gap-5 border-t border-slate-200/70 pt-8 md:grid-cols-2">
          <div className={subPanelCls}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">New category</p>
            <AdminInput className="mt-3" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            <div className="mt-3">
              <AdminBtnPrimary
                disabled={!token || !selectedRestaurantId}
                onClick={async () => {
                  if (!token || !selectedRestaurantId) return;
                  const res = await createCategory(token, selectedRestaurantId, { name: newCategoryName });
                  if (!res.ok) return setStatus(res.error ?? "category_failed");
                  setStatus("Category added");
                  await refreshMenu(token, selectedRestaurantId);
                }}
              >
                Add category
              </AdminBtnPrimary>
            </div>
          </div>

          <div className={subPanelCls}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">New item</p>
            <AdminSelect className="mt-3" value={itemCategoryId} onChange={(e) => setItemCategoryId(e.target.value)}>
              <option value="">Categoryâ€¦</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </AdminSelect>
            <AdminInput className="mt-3" placeholder="Name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
            <AdminInput
              className="mt-3"
              placeholder="Description (optional)"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
            />
            <AdminInput
              className="mt-3"
              placeholder="Price (SEK)"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
            />
            <div className="mt-3">
              <AdminBtnPrimary
                disabled={!token || !selectedRestaurantId || !itemCategoryId}
                onClick={async () => {
                  if (!token || !selectedRestaurantId || !itemCategoryId) return;
                  const dollars = Number.parseFloat(itemPrice);
                  if (Number.isNaN(dollars)) return setStatus("Invalid price");
                  const priceCents = Math.round(dollars * 100);
                  const res = await createMenuItem(token, selectedRestaurantId, {
                    categoryId: itemCategoryId,
                    name: itemName,
                    description: itemDescription || undefined,
                    priceCents
                  });
                  if (!res.ok) return setStatus(res.error ?? "item_failed");
                  setStatus("Item added");
                  await refreshMenu(token, selectedRestaurantId);
                }}
              >
                Add item
              </AdminBtnPrimary>
            </div>
          </div>

          <div className={subPanelCls}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Modifier group</p>
            <AdminSelect className="mt-3" value={modItemId} onChange={(e) => setModItemId(e.target.value)}>
              <option value="">Itemâ€¦</option>
              {flatItems.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </AdminSelect>
            <AdminInput
              className="mt-3"
              placeholder="Group name (e.g. Size)"
              value={modGroupName}
              onChange={(e) => setModGroupName(e.target.value)}
            />
            <div className="mt-3">
              <AdminBtnPrimary
                disabled={!token || !selectedRestaurantId || !modItemId}
                onClick={async () => {
                  if (!token || !selectedRestaurantId || !modItemId) return;
                  const res = await createModifierGroup(token, selectedRestaurantId, modItemId, {
                    name: modGroupName,
                    minSelect: 1,
                    maxSelect: 1
                  });
                  if (!res.ok) return setStatus(res.error ?? "group_failed");
                  setStatus("Modifier group added");
                  await refreshMenu(token, selectedRestaurantId);
                }}
              >
                Add group
              </AdminBtnPrimary>
            </div>
          </div>

          <div className={subPanelCls}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Modifier option</p>
            <AdminSelect className="mt-3" value={modGroupId} onChange={(e) => setModGroupId(e.target.value)}>
              <option value="">Groupâ€¦</option>
              {flatGroups.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </AdminSelect>
            <AdminInput
              className="mt-3"
              placeholder="Option name"
              value={modOptionName}
              onChange={(e) => setModOptionName(e.target.value)}
            />
            <AdminInput
              className="mt-3"
              placeholder="Extra price (SEK)"
              value={modOptionDelta}
              onChange={(e) => setModOptionDelta(e.target.value)}
            />
            <div className="mt-3">
              <AdminBtnPrimary
                disabled={!token || !selectedRestaurantId || !modGroupId}
                onClick={async () => {
                  if (!token || !selectedRestaurantId || !modGroupId) return;
                  const d = Number.parseFloat(modOptionDelta);
                  if (Number.isNaN(d)) return setStatus("Invalid option price");
                  const res = await createModifierOption(token, selectedRestaurantId, modGroupId, {
                    name: modOptionName,
                    priceDeltaCents: Math.round(d * 100)
                  });
                  if (!res.ok) return setStatus(res.error ?? "option_failed");
                  setStatus("Option added");
                  await refreshMenu(token, selectedRestaurantId);
                }}
              >
                Add option
              </AdminBtnPrimary>
            </div>
          </div>
        </div>

        {menu?.categories?.length ? (
          <div className={`${subPanelCls} mt-8`}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Live menu preview</p>
            <div className="mt-4 max-h-80 space-y-5 overflow-y-auto text-sm">
              {menu.categories.map((cat) => (
                <div key={cat.id}>
                  <div className="font-display text-base font-bold text-slate-900">
                    {cat.name}{" "}
                    {!cat.isActive ? <span className="text-xs font-normal text-slate-500">(hidden)</span> : null}
                  </div>
                  <ul className="mt-2 space-y-3 pl-1">
                    {cat.items.map((item) => (
                      <li key={item.id} className="border-l-2 border-violet-200/80 pl-3">
                        <span className="font-semibold text-slate-900">{item.name}</span>{" "}
                        <span className="text-slate-600">{formatMoney(item.priceCents)}</span>
                        {!item.isActive ? <span className="text-xs text-slate-500"> (inactive)</span> : null}
                        {item.modifierGroups.length ? (
                          <ul className="mt-1 space-y-1 text-xs text-slate-600">
                            {item.modifierGroups.map((g) => (
                              <li key={g.id}>
                                {g.name}: {g.options.map((o) => o.name).join(", ") || "â€”"}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <AdminEmptyState>No menu data yet â€” add a category first.</AdminEmptyState>
          </div>
        )}
      </AdminPanel>

      <AdminPanel id="orders" className={token ? "" : "mt-8"}>
        <AdminSectionHeader
          eyebrowText={token ? "Orders system" : "Operations"}
          title={token ? "Live orders" : "Orders"}
          description={
            token
              ? "Unified order lifecycle â€” kitchen view and chat will live inside order detail next."
              : "Live orders for the selected restaurant. Updates automatically â€” change status for the kitchen flow."
          }
          action={
            <AdminBtnSecondary
              disabled={!token || !selectedRestaurantId}
              onClick={() => token && selectedRestaurantId && void refreshOrders(token, selectedRestaurantId)}
            >
              Refresh orders
            </AdminBtnSecondary>
          }
        />

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/85">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Lines</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-slate-200/50 align-top transition hover:bg-violet-50/30">
                  <td className="px-4 py-3 text-xs text-slate-600">{new Date(o.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{o.id.slice(0, 12)}â€¦</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(o.totalCents)}</td>
                  <td className="px-4 py-3">
                    <AdminSelect
                      className="!py-1.5 text-xs"
                      value={o.status}
                      onChange={async (e) => {
                        if (!token) return;
                        const next = e.target.value;
                        const res = await patchOrderStatus(token, o.id, next);
                        if (!res.ok) return setStatus(res.error ?? "status_failed");
                        await refreshOrders(token, selectedRestaurantId);
                      }}
                    >
                      {(["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"] as const).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </AdminSelect>
                  </td>
                  <td className="px-4 py-3 text-xs leading-relaxed text-slate-600">
                    {o.lines.map((l, i) => (
                      <div key={`${o.id}-line-${i}`}>
                        {l.quantity}Ã— {l.name} ({formatMoney(l.lineTotalCents)})
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 ? (
            <div className="px-4 py-6">
              <AdminEmptyState>No orders yet â€” place one from the customer app.</AdminEmptyState>
            </div>
          ) : null}
        </div>

        {status ? (
          <div className="mt-4">
            <AdminStatusLine>Status: {status}</AdminStatusLine>
          </div>
        ) : null}
      </AdminPanel>
    </>
  );

  return (
    <div
      className={`admin-shell font-ui ${token ? "admin-shell--signed-in" : ""} ${launchModalOpen || trialNoticeOpen ? "h-[100dvh] overflow-hidden" : ""}`}
      data-theme={theme}
    >
      <LoadingScreen appReady={appReady} />
      {token ? (
        <WorkspaceLaunchModal open={launchModalOpen} token={token} onConfirmed={handleDeploymentConfirmed} />
      ) : null}
      {token && trialNotice ? (
        <OwnerTrialNoticeModal
          open={trialNoticeOpen}
          notice={trialNotice}
          dismissing={trialNoticeDismissing}
          onDismiss={() => void handleDismissTrialNotice()}
        />
      ) : null}
      <LogoutConfirmModal
        open={logoutModalOpen}
        busy={logoutBusy}
        error={logoutError}
        ownerEmail={ownerUser?.email}
        onStay={() => {
          if (logoutBusy) return;
          setLogoutModalOpen(false);
          setLogoutError(null);
        }}
        onConfirm={() => void confirmSignOut()}
      />

      <div className={launchModalOpen ? "pointer-events-none select-none blur-[2px] transition-[filter] duration-300" : ""}>
      {!token ? <AdminHeader signedIn={false} onSignOut={requestSignOut} onHome={onAfterLogout} /> : null}

      {token ? (
        <AdminWorkspaceShell
          restaurants={restaurants}
          selectedRestaurantId={selectedRestaurantId}
          onSelectRestaurant={(id) => void handleSelectRestaurant(id)}
          ownerSignupProfile={ownerUser?.signupProfile}
          ownerEmail={ownerUser?.email}
          onLogoPress={requestSignOut}
          onSignOut={requestSignOut}
          venueSwitching={venueSwitching}
        >
          <main id="top" className={adminWorkspaceMain}>
            <AdminPageTransition
              pageKey={showFullPage ? adminFullPageKey(adminHash) : `ws-${adminRoute.workspaceId}`}
            >
              {showFullPage ? (
                adminHash === ADMIN_VENUE_CONTROL_HASH ? (
                  <AdminVenueControlCentrePage venueName={selectedVenueName} venueId={selectedRestaurantId} />
                ) : (
                  <AdminTopPageView
                    hash={adminHash}
                    token={token}
                    displayName={ownerDisplayName}
                    email={ownerUser?.email}
                    onSignOut={requestSignOut}
                    onEmailChanged={(nextEmail) =>
                      setOwnerUser((prev) => (prev ? { ...prev, email: nextEmail } : prev))
                    }
                  />
                )
              ) : (
                <AdminWorkspaceView workspaceId={adminRoute.workspaceId} presetId={adminRoute.presetId} />
              )}
            </AdminPageTransition>
          </main>
        </AdminWorkspaceShell>
      ) : (
        <main id="top" className={adminMain}>
          <div id="auth" className="mt-8 grid scroll-mt-28 gap-6 lg:grid-cols-2 lg:scroll-mt-24">
            <AdminPanel>
              <AdminSectionHeader
                eyebrowText="Access"
                title="Sign in"
                description="Use your owner account to open your ServeOS workspace."
              />
              <div className="mt-6 grid gap-4">
                <AdminLabel>
                  Email
                  <AdminInput value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </AdminLabel>
                <AdminLabel>
                  Password
                  <AdminInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                  />
                </AdminLabel>
                <div className="flex flex-wrap gap-3 pt-1">
                  <AdminBtnPrimaryLg
                    onClick={async () => {
                      setStatus("Signing up…");
                      const res = await signup({ email, password, role: "OWNER" });
                      if (!res.ok || !res.token) return setStatus(mapApiErrorToMessage(res));
                      persistAdminToken(res.token);
                      setToken(res.token);
                      setStatus("Signed up");
                      if (res.user?.id) {
                        setUserId(res.user.id);
                        setOwnerUser(res.user);
                        const depStatus = await fetchWorkspaceDeploymentStatus(res.token);
                        setHasWorkspaceDeployment(Boolean(depStatus.ok && depStatus.hasDeployment));
                      } else {
                        await hydrateUser(res.token);
                      }
                      await refreshRestaurants(res.token);
                    }}
                  >
                    Sign up
                  </AdminBtnPrimaryLg>
                  <AdminBtnSecondaryLg
                    onClick={async () => {
                      setStatus("Logging in…");
                      const res = await login({ email, password });
                      if (!res.ok || !res.token) return setStatus(mapApiErrorToMessage(res));
                      persistAdminToken(res.token);
                      setToken(res.token);
                      setStatus("Logged in");
                      if (res.user?.id) {
                        setUserId(res.user.id);
                        setOwnerUser(res.user);
                        const depStatus = await fetchWorkspaceDeploymentStatus(res.token);
                        setHasWorkspaceDeployment(Boolean(depStatus.ok && depStatus.hasDeployment));
                      } else {
                        await hydrateUser(res.token);
                      }
                      await refreshRestaurants(res.token);
                    }}
                  >
                    Log in
                  </AdminBtnSecondaryLg>
                </div>
                <AdminStatusLine>{status ? <>Status: {status}</> : null}</AdminStatusLine>
              </div>
            </AdminPanel>

            <AdminPanel>
              <AdminSectionHeader
                eyebrowText="Venues"
                title="Restaurant onboarding"
                description="Create your first venue after signing in, or refresh your venue list."
              />
              <div className="mt-6 grid gap-4">
                <AdminLabel>
                  Restaurant name
                  <AdminInput value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
                </AdminLabel>
                <div className="flex flex-wrap gap-3">
                  <AdminBtnPrimary
                    disabled={!token}
                    onClick={async () => {
                      if (!token) return;
                      setStatus("Creating restaurant…");
                      const companyId = restaurants.map((r) => r.companyId).find((id) => typeof id === "string" && id.length > 0);
                      const res = await createRestaurant(token, { name: restaurantName, ...(companyId ? { companyId } : {}) });
                      if (!res.ok) return setStatus(res.error ?? "create_restaurant_failed");
                      setStatus("Restaurant created");
                      await refreshRestaurants(token);
                    }}
                  >
                    Create restaurant
                  </AdminBtnPrimary>
                  <AdminBtnSecondary
                    disabled={!token}
                    onClick={async () => {
                      if (!token) return;
                      setStatus("Refreshing…");
                      await refreshRestaurants(token);
                      setStatus("Refreshed");
                    }}
                  >
                    Refresh
                  </AdminBtnSecondary>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Your restaurants</p>
                  <div className="mt-3 grid gap-3">
                    {restaurants.map((r) => (
                      <AdminVenueCard key={r.id} name={r.name} id={r.id} role={r.role} />
                    ))}
                    {restaurants.length === 0 ? <AdminEmptyState>None yet — sign in and create one.</AdminEmptyState> : null}
                  </div>
                </div>
              </div>
            </AdminPanel>
          </div>

          {catalogAndOrders}
        </main>
      )}


      {!token ? <MobileFloatingDock signedIn={false} /> : null}
      </div>

      {token ? <AdminThemeFab theme={theme} onToggle={toggleTheme} /> : null}
    </div>
  );
}
