import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingScreen } from "@serveos/core-loading";
import {
  AdminBtnPrimary,
  AdminBtnPrimaryLg,
  AdminBtnSecondary,
  AdminBtnSecondaryLg,
  AdminEmptyState,
  AdminHeader,
  AdminInput,
  AdminLabel,
  AdminPanel,
  AdminSectionHeader,
  AdminSelect,
  AdminStatusLine,
  AdminVenueCard,
  AdminWelcomeBanner,
  adminMain,
  subPanelCls
} from "./AdminUi";
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
  mapApiErrorToMessage,
  orderEventsWebSocketUrl,
  patchOrderStatus,
  signup,
  type MenuTree,
  type OrderRow
} from "../api";
import { ADMIN_AUTH_TOKEN_KEY, consumeTokenFromUrl, persistAdminToken, readStoredAdminToken } from "../authStorage";
import { marketingRoot } from "../marketing/styles";
import {
  dismissOwnerTrialNotice,
  fetchOwnerTrialNotice,
  fetchWorkspaceDeploymentStatus,
  type DeploymentQuote,
  type TrialNoticePayload
} from "./deploymentApi";
import { OwnerTrialNoticeModal } from "./OwnerTrialNoticeModal";
import { WorkspaceLaunchModal } from "./WorkspaceLaunchModal";

function formatMoney(cents: number) {
  return formatMoneyCents(cents);
}

type Props = {
  onHome: () => void;
};

export function AdminDashboardPage({ onHome }: Props) {
  const [appReady, setAppReady] = useState(false);
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("password123");
  const [token, setToken] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<Array<{ id: string; name: string; role: string; companyId?: string | null }>>([]);
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
  const [hasWorkspaceDeployment, setHasWorkspaceDeployment] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [trialNotice, setTrialNotice] = useState<TrialNoticePayload | null>(null);
  const [trialNoticeOpen, setTrialNoticeOpen] = useState(false);
  const [trialNoticeDismissing, setTrialNoticeDismissing] = useState(false);

  const activeVenueName = restaurants.find((r) => r.id === selectedRestaurantId)?.name;

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
      `${quote.planName} deployment confirmed — ${quote.trialDays}-day trial started (${Math.round(quote.totalMonthlyOre / 100).toLocaleString("sv-SE")} kr/month after trial).`
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
        out.push({ id: it.id, label: `${c.name} → ${it.name}` });
      }
    }
    return out;
  }, [categoryOptions]);

  const flatGroups = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    for (const c of categoryOptions) {
      for (const it of c.items) {
        for (const g of it.modifierGroups) {
          out.push({ id: g.id, label: `${it.name} → ${g.name}` });
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
    if (restaurants.length && !selectedRestaurantId) {
      setSelectedRestaurantId(restaurants[0].id);
    }
  }, [restaurants, selectedRestaurantId]);

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

  function signOut() {
    setToken(null);
    setUserId(null);
    setHasWorkspaceDeployment(false);
    setLaunchModalOpen(false);
    setTrialNotice(null);
    setTrialNoticeOpen(false);
    try {
      sessionStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setRestaurants([]);
    setSelectedRestaurantId("");
    setMenu(null);
    setOrders([]);
    setStatus("Signed out");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  return (
    <div
      className={`${marketingRoot} marketing-site font-ui ${launchModalOpen || trialNoticeOpen ? "h-[100dvh] overflow-hidden" : ""}`}
    >
      <LoadingScreen appReady={appReady} />
      {token ? (
        <WorkspaceLaunchModal open={launchModalOpen} token={token} onConfirmed={handleDeploymentConfirmed} />
      ) : null}

      <div className={launchModalOpen ? "pointer-events-none select-none blur-[2px] transition-[filter] duration-300" : ""}>
      <AdminHeader signedIn={!!token} activeVenue={activeVenueName} onSignOut={signOut} onHome={onHome} />

      <main id="top" className={adminMain}>
        {token ? (
          <div className="mt-6 sm:mt-8">
            <AdminWelcomeBanner />
          </div>
        ) : null}

        {!token ? (
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
                      if (!res.ok || !res.token) return setStatus(mapApiErrorToMessage(res.error) ?? "signup_failed");
                      persistAdminToken(res.token);
                      setToken(res.token);
                      setStatus("Signed up");
                      if (res.user?.id) {
                        setUserId(res.user.id);
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
                      if (!res.ok || !res.token) return setStatus(mapApiErrorToMessage(res.error) ?? "login_failed");
                      persistAdminToken(res.token);
                      setToken(res.token);
                      setStatus("Logged in");
                      if (res.user?.id) {
                        setUserId(res.user.id);
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
        ) : null}

        <AdminPanel id="menu-admin" className="mt-8">
          <AdminSectionHeader
            eyebrowText="Catalog"
            title="Menu management"
            description="Select a venue, add categories and items, then modifier groups and options. Use the restaurant ID in the customer app to preview the public menu."
          />

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
            <AdminLabel className="flex-1">
              Active restaurant
              <AdminSelect
                disabled={!token || restaurants.length === 0}
                value={selectedRestaurantId}
                onChange={(e) => setSelectedRestaurantId(e.target.value)}
              >
                <option value="">—</option>
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
                <option value="">Category…</option>
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
                <option value="">Item…</option>
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
                <option value="">Group…</option>
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
                                  {g.name}: {g.options.map((o) => o.name).join(", ") || "—"}
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
              <AdminEmptyState>No menu data yet — add a category first.</AdminEmptyState>
            </div>
          )}
        </AdminPanel>

        <AdminPanel id="orders" className="mt-8">
          <AdminSectionHeader
            eyebrowText="Operations"
            title="Orders"
            description="Live orders for the selected restaurant. Updates automatically — change status for the kitchen flow."
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
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{o.id.slice(0, 12)}…</td>
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
                          {l.quantity}× {l.name} ({formatMoney(l.lineTotalCents)})
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 ? (
              <div className="px-4 py-6">
                <AdminEmptyState>No orders yet — place one from the customer app.</AdminEmptyState>
              </div>
            ) : null}
          </div>

          {token && status ? (
            <div className="mt-4">
              <AdminStatusLine>Status: {status}</AdminStatusLine>
            </div>
          ) : null}
        </AdminPanel>
      </main>

      <MobileFloatingDock signedIn={!!token} />
      </div>
    </div>
  );
}
