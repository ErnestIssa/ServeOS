import { AmbientWebShell } from "@serveos/core-ambient";
import { useEffect, useMemo, useState } from "react";
import { LoadingScreen } from "@serveos/core-loading/LoadingScreen";
import { MobileFloatingDock } from "./MobileFloatingDock";
import {
  createCategory,
  createMenuItem,
  createModifierGroup,
  createModifierOption,
  createRestaurant,
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
} from "./api";

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function App() {
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

  return (
    <AmbientWebShell variant="admin" className="font-ui">
      <LoadingScreen appReady={appReady} />

      <main className="relative mx-auto max-w-5xl scroll-smooth px-6 pb-28 pt-6 text-slate-900 lg:max-w-6xl lg:pb-10 lg:pt-10 xl:max-w-7xl xl:px-10">
        <div id="top" className="flex scroll-mt-28 flex-wrap items-center justify-between gap-3 lg:scroll-mt-0">
          <div className="text-xl font-extrabold tracking-tight text-slate-900">ServeOS</div>
          <div className="rounded-full border border-slate-200/80 bg-white/60 px-3 py-1 text-xs text-slate-600 backdrop-blur-md">
            Admin
          </div>
        </div>

        <div id="auth" className="mt-10 grid scroll-mt-28 gap-4 md:grid-cols-2 lg:scroll-mt-0">
          <section className="rounded-2xl border border-white/55 bg-white/65 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="text-sm font-semibold text-slate-900">Auth (demo)</div>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1 text-xs text-slate-600">
                Email
                <input
                  className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-600">
                Password
                <input
                  className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                />
              </label>
              <div className="flex gap-2">
                <button
                  className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white shadow-glow-blue hover:bg-[#2563EB]"
                  onClick={async () => {
                    setStatus("Signing up…");
                    const res = await signup({ email, password, role: "OWNER" });
                    if (!res.ok || !res.token) return setStatus(mapApiErrorToMessage(res.error) ?? "signup_failed");
                    setToken(res.token);
                    setStatus("Signed up");
                    await refreshRestaurants(res.token);
                  }}
                >
                  Sign up
                </button>
                <button
                  className="rounded-xl border border-slate-200/90 bg-white/85 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
                  onClick={async () => {
                    setStatus("Logging in…");
                    const res = await login({ email, password });
                    if (!res.ok || !res.token) return setStatus(mapApiErrorToMessage(res.error) ?? "login_failed");
                    setToken(res.token);
                    setStatus("Logged in");
                    await refreshRestaurants(res.token);
                  }}
                >
                  Log in
                </button>
              </div>
              {token ? <div className="text-xs text-slate-600 break-all">Token: {token.slice(0, 18)}…</div> : null}
              {status ? <div className="text-xs text-slate-600">Status: {status}</div> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-white/55 bg-white/65 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="text-sm font-semibold text-slate-900">Restaurant onboarding (demo)</div>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1 text-xs text-slate-600">
                Restaurant name
                <input
                  className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <button
                  className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white shadow-glow-blue hover:bg-[#2563EB]"
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
                </button>
                <button
                  className="rounded-xl border border-slate-200/90 bg-white/85 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
                  disabled={!token}
                  onClick={async () => {
                    if (!token) return;
                    setStatus("Refreshing…");
                    await refreshRestaurants(token);
                    setStatus("Refreshed");
                  }}
                >
                  Refresh
                </button>
              </div>
              <div className="text-xs text-slate-600">Your restaurants:</div>
              <div className="grid gap-2">
                {restaurants.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-slate-200/85 bg-white/82 px-3 py-2 text-sm text-slate-900"
                  >
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-slate-600 font-mono break-all">ID: {r.id}</div>
                    <div className="text-xs text-slate-600">Role: {r.role}</div>
                  </div>
                ))}
                {restaurants.length === 0 ? <div className="text-xs text-slate-500">None yet.</div> : null}
              </div>
            </div>
          </section>
        </div>

        <section
          id="menu-admin"
          className="mt-8 scroll-mt-28 rounded-2xl border border-white/55 bg-white/65 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:scroll-mt-0"
        >
          <div className="text-sm font-semibold text-slate-900">Menu management</div>
          <p className="mt-1 text-xs text-slate-600">
            Select a venue, add categories and items, then modifier groups/options. Copy the restaurant ID into the customer app to preview the public menu.
          </p>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
            <label className="grid flex-1 gap-1 text-xs text-slate-600">
              Active restaurant
              <select
                className="rounded-xl border border-slate-200/85 bg-white/82 px-3 py-2 text-sm text-slate-900 outline-none"
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
              </select>
            </label>
            <button
              type="button"
              className="rounded-xl border border-slate-200/85 bg-white/82 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-40"
              disabled={!token || !selectedRestaurantId}
              onClick={() => token && selectedRestaurantId && void refreshMenu(token, selectedRestaurantId)}
            >
              Reload menu
            </button>
          </div>

          <div className="mt-6 grid gap-4 border-t border-slate-200/80 pt-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200/85 bg-white/82 p-4">
              <div className="text-xs font-semibold text-slate-600">New category</div>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200/85 bg-white/90 px-3 py-2 text-sm outline-none"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button
                type="button"
                className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-40"
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
              </button>
            </div>

            <div className="rounded-xl border border-slate-200/85 bg-white/82 p-4">
              <div className="text-xs font-semibold text-slate-600">New item</div>
              <select
                className="mt-2 w-full rounded-lg border border-slate-200/85 bg-white/90 px-3 py-2 text-sm outline-none"
                value={itemCategoryId}
                onChange={(e) => setItemCategoryId(e.target.value)}
              >
                <option value="">Category…</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200/85 bg-white/90 px-3 py-2 text-sm outline-none"
                placeholder="Name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
              <input
                className="mt-2 w-full rounded-lg border border-slate-200/85 bg-white/90 px-3 py-2 text-sm outline-none"
                placeholder="Description (optional)"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
              />
              <input
                className="mt-2 w-full rounded-lg border border-slate-200/85 bg-white/90 px-3 py-2 text-sm outline-none"
                placeholder="Price USD"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
              />
              <button
                type="button"
                className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-40"
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
              </button>
            </div>

            <div className="rounded-xl border border-slate-200/85 bg-white/82 p-4">
              <div className="text-xs font-semibold text-slate-600">Modifier group (per item)</div>
              <select
                className="mt-2 w-full rounded-lg border border-slate-200/85 bg-white/90 px-3 py-2 text-sm outline-none"
                value={modItemId}
                onChange={(e) => setModItemId(e.target.value)}
              >
                <option value="">Item…</option>
                {flatItems.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200/85 bg-white/90 px-3 py-2 text-sm outline-none"
                placeholder="Group name (e.g. Size)"
                value={modGroupName}
                onChange={(e) => setModGroupName(e.target.value)}
              />
              <button
                type="button"
                className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-40"
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
              </button>
            </div>

            <div className="rounded-xl border border-slate-200/85 bg-white/82 p-4">
              <div className="text-xs font-semibold text-slate-600">Modifier option</div>
              <select
                className="mt-2 w-full rounded-lg border border-slate-200/85 bg-white/90 px-3 py-2 text-sm outline-none"
                value={modGroupId}
                onChange={(e) => setModGroupId(e.target.value)}
              >
                <option value="">Group…</option>
                {flatGroups.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200/85 bg-white/90 px-3 py-2 text-sm outline-none"
                placeholder="Option name"
                value={modOptionName}
                onChange={(e) => setModOptionName(e.target.value)}
              />
              <input
                className="mt-2 w-full rounded-lg border border-slate-200/85 bg-white/90 px-3 py-2 text-sm outline-none"
                placeholder="Extra price USD"
                value={modOptionDelta}
                onChange={(e) => setModOptionDelta(e.target.value)}
              />
              <button
                type="button"
                className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-40"
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
              </button>
            </div>
          </div>

          {menu?.categories?.length ? (
            <div className="mt-8 rounded-xl border border-slate-200/85 bg-white/82 p-4">
              <div className="text-xs font-semibold text-slate-600">Live menu (admin view)</div>
              <div className="mt-3 max-h-80 space-y-4 overflow-y-auto text-sm">
                {menu.categories.map((cat) => (
                  <div key={cat.id}>
                    <div className="font-bold text-slate-900">
                      {cat.name}{" "}
                      {!cat.isActive ? <span className="text-xs font-normal text-slate-500">(hidden)</span> : null}
                    </div>
                    <ul className="mt-2 space-y-2 pl-2">
                      {cat.items.map((item) => (
                        <li key={item.id} className="border-l-2 border-slate-200/80 pl-3">
                          <span className="font-semibold">{item.name}</span>{" "}
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
            <div className="mt-6 text-xs text-slate-500">No menu data yet — add a category first.</div>
          )}
        </section>

        <section
          id="orders"
          className="mt-8 scroll-mt-28 rounded-2xl border border-white/55 bg-white/65 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:scroll-mt-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Orders</div>
              <p className="mt-1 text-xs text-slate-600">
                Live orders for the selected restaurant (updates automatically; change status for the kitchen flow).
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-200/85 bg-white/82 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-white disabled:opacity-40"
              disabled={!token || !selectedRestaurantId}
              onClick={() => token && selectedRestaurantId && void refreshOrders(token, selectedRestaurantId)}
            >
              Refresh orders
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 text-xs text-slate-600">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Lines</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-200/50 align-top">
                    <td className="py-2 pr-3 text-xs text-slate-600">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{o.id.slice(0, 12)}…</td>
                    <td className="py-2 pr-3">{formatMoney(o.totalCents)}</td>
                    <td className="py-2 pr-3">
                      <select
                        className="rounded-lg border border-slate-200/85 bg-white/82 px-2 py-1 text-xs text-slate-900"
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
                      </select>
                    </td>
                    <td className="py-2 text-xs text-slate-600">
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
            {orders.length === 0 ? <div className="mt-3 text-xs text-slate-500">No orders yet — place one from the customer app.</div> : null}
          </div>
        </section>
      </main>

      <MobileFloatingDock />
    </AmbientWebShell>
  );
}
