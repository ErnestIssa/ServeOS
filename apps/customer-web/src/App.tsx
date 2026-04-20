import { AmbientWebShell } from "@serveos/core-ambient";
import { useEffect, useMemo, useState } from "react";
import { LoadingScreen } from "@serveos/core-loading/LoadingScreen";
import { MobileFloatingDock } from "./MobileFloatingDock";
import {
  getPublicMenu,
  getPublicOrderTrack,
  loginCustomer,
  orderEventsWebSocketUrl,
  placeOrder,
  signupCustomer,
  type OrderEventPayload,
  type PublicMenu
} from "./api";

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

type CartLine = {
  key: string;
  menuItemId: string;
  name: string;
  quantity: number;
  modifierOptionIds: string[];
};

export function App() {
  const [appReady, setAppReady] = useState(false);
  const [restaurantId, setRestaurantId] = useState("");
  const [status, setStatus] = useState("");
  const [menu, setMenu] = useState<PublicMenu | null>(null);

  const [custEmail, setCustEmail] = useState("");
  const [custPassword, setCustPassword] = useState("");
  const [customerToken, setCustomerToken] = useState<string | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [expandItemId, setExpandItemId] = useState<string | null>(null);
  const [groupPick, setGroupPick] = useState<Record<string, string>>({});

  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [trackId, setTrackId] = useState("");
  const [trackInfo, setTrackInfo] = useState<Awaited<ReturnType<typeof getPublicOrderTrack>> | null>(null);

  const flatItems = useMemo(() => {
    const m = menu;
    if (!m?.categories) return [];
    const out: NonNullable<PublicMenu["categories"]>[0]["items"][0][] = [];
    for (const c of m.categories) {
      for (const it of c.items) out.push(it);
    }
    return out;
  }, [menu]);

  const expandedItem = useMemo(
    () => (expandItemId ? flatItems.find((i) => i.id === expandItemId) ?? null : null),
    [expandItemId, flatItems]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) setAppReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMenu() {
    if (!restaurantId.trim()) {
      setStatus("Enter a restaurant ID");
      return;
    }
    setStatus("Loading…");
    const res = await getPublicMenu(restaurantId.trim());
    if (!res.ok) {
      setMenu(null);
      setStatus(res.error ?? "failed");
      return;
    }
    setMenu(res);
    setStatus("");
    setCart([]);
    setExpandItemId(null);
  }

  function setPick(groupId: string, optionId: string) {
    setGroupPick((p) => ({ ...p, [groupId]: optionId }));
  }

  function validatePicks(item: NonNullable<typeof expandedItem>): boolean {
    if (!item) return false;
    for (const g of item.modifierGroups) {
      const sel = groupPick[g.id] ?? "";
      const n = sel ? 1 : 0;
      if (n < g.minSelect || n > g.maxSelect) {
        setStatus(`Choose ${g.name}: need between ${g.minSelect} and ${g.maxSelect}`);
        return false;
      }
    }
    return true;
  }

  function addLineFromExpanded() {
    if (!expandedItem) return;
    if (!validatePicks(expandedItem)) return;
    const modifierOptionIds = Object.entries(groupPick)
      .filter(([gid]) => expandedItem.modifierGroups.some((g) => g.id === gid))
      .map(([, v]) => v)
      .filter(Boolean);
    const key = `${expandedItem.id}:${modifierOptionIds.slice().sort().join(",")}`;
    setCart((prev) => {
      const hit = prev.find((l) => l.key === key);
      if (hit) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          menuItemId: expandedItem.id,
          name: expandedItem.name,
          quantity: 1,
          modifierOptionIds
        }
      ];
    });
    setStatus("Added to cart");
  }

  async function checkout() {
    if (!menu?.restaurant?.id) return;
    if (cart.length === 0) {
      setStatus("Cart is empty");
      return;
    }
    setStatus("Placing order…");
    const res = await placeOrder({
      restaurantId: menu.restaurant.id,
      lines: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        modifierOptionIds: c.modifierOptionIds.length ? c.modifierOptionIds : undefined
      })),
      note: note || undefined,
      token: customerToken
    });
    if (!res.ok || !res.order) {
      setStatus(res.error ?? "order_failed");
      return;
    }
    setLastOrderId(res.order.id);
    setStatus(`Order placed: ${res.order.id}`);
    setCart([]);
    setNote("");
  }

  async function track() {
    if (!trackId.trim()) return;
    const res = await getPublicOrderTrack(trackId.trim());
    setTrackInfo(res);
  }

  const trackedOrderId = useMemo(() => trackId.trim() || lastOrderId || "", [trackId, lastOrderId]);

  useEffect(() => {
    if (!trackedOrderId) return;
    const url = orderEventsWebSocketUrl({ orderId: trackedOrderId });
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as OrderEventPayload;
        if (data.type !== "order_updated" || data.orderId !== trackedOrderId) return;
        setTrackInfo((prev) => ({
          ok: true,
          orderId: data.orderId,
          status: data.status,
          totalCents: data.totalCents,
          restaurantName: data.restaurantName ?? (prev?.ok ? prev.restaurantName : undefined)
        }));
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [trackedOrderId]);

  return (
    <AmbientWebShell variant="customer" className="font-ui">
      <LoadingScreen appReady={appReady} />

      <main className="relative mx-auto max-w-3xl scroll-smooth px-6 pb-28 pt-6 text-slate-900 lg:pb-10 lg:pt-10">
        <div id="top" className="flex scroll-mt-28 items-center justify-between lg:scroll-mt-0">
          <div className="text-xl font-extrabold tracking-tight text-slate-900">ServeOS</div>
          <div className="rounded-full border border-slate-200/80 bg-white/60 px-3 py-1 text-xs text-slate-600 backdrop-blur-md">
            Customer
          </div>
        </div>

        <div
          id="account"
          className="mt-8 scroll-mt-28 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:scroll-mt-0"
        >
          <div className="text-sm font-semibold text-slate-900">Account (optional)</div>
          <p className="mt-1 text-xs text-slate-600">
            Sign up or log in as <span className="text-slate-900/90">CUSTOMER</span> so orders attach to your profile. Guest checkout works without this.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="email"
              value={custEmail}
              onChange={(e) => setCustEmail(e.target.value)}
            />
            <input
              className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="password (8+ chars)"
              type="password"
              value={custPassword}
              onChange={(e) => setCustPassword(e.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-glow-blue hover:bg-[#2563EB]"
              onClick={async () => {
                const res = await signupCustomer({ email: custEmail, password: custPassword });
                if (!res.ok || !res.token) return setStatus(res.error ?? "signup_failed");
                setCustomerToken(res.token);
                setStatus("Signed up as customer");
              }}
            >
              Sign up
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200/90 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-white"
              onClick={async () => {
                const res = await loginCustomer({ email: custEmail, password: custPassword });
                if (!res.ok || !res.token) return setStatus(res.error ?? "login_failed");
                setCustomerToken(res.token);
                setStatus("Logged in");
              }}
            >
              Log in
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200/80 px-4 py-2 text-xs text-slate-600 hover:bg-white/60"
              onClick={() => {
                setCustomerToken(null);
                setStatus("Logged out");
              }}
            >
              Log out
            </button>
          </div>
          {customerToken ? <div className="mt-2 text-xs text-slate-600">Session active (customer)</div> : null}
        </div>

        <div
          id="menu"
          className="mt-8 scroll-mt-28 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:scroll-mt-0"
        >
          <div className="text-sm font-semibold text-slate-900">Menu</div>
          <p className="mt-1 text-xs text-slate-600">Paste the restaurant ID from your venue (web admin), then load the menu.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1 text-xs text-slate-600">
              Restaurant ID
              <input
                className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400"
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                placeholder="clx…"
              />
            </label>
            <button
              type="button"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-glow-blue hover:bg-[#2563EB]"
              onClick={() => void loadMenu()}
            >
              Load menu
            </button>
          </div>
          {status ? <div className="mt-2 text-xs text-slate-600">{status}</div> : null}
        </div>

        {menu?.ok && menu.restaurant && menu.categories ? (
          <div className="mt-8 space-y-8">
            <div className="text-lg font-bold text-slate-900">{menu.restaurant.name}</div>
            {menu.categories.map((cat) => (
              <section key={cat.id}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">{cat.name}</h2>
                <ul className="mt-3 space-y-4">
                  {cat.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          {item.description ? <div className="mt-1 text-sm text-slate-600">{item.description}</div> : null}
                        </div>
                        <div className="shrink-0 text-sm font-semibold text-slate-900">{formatMoney(item.priceCents)}</div>
                      </div>
                      <button
                        type="button"
                        className="mt-3 text-xs font-semibold text-accent"
                        onClick={() => {
                          setExpandItemId(item.id === expandItemId ? null : item.id);
                          setGroupPick({});
                        }}
                      >
                        {expandItemId === item.id ? "Close options" : "Customize & add"}
                      </button>
                      {expandItemId === item.id ? (
                        <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3">
                          {item.modifierGroups.map((g) => (
                            <label key={g.id} className="grid gap-1 text-xs text-slate-600">
                              {g.name}{" "}
                              <span className="font-normal text-slate-500">
                                (pick {g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`})
                              </span>
                              <select
                                className="rounded-lg border border-slate-200/90 bg-white/90 px-2 py-2 text-sm text-slate-900"
                                value={groupPick[g.id] ?? ""}
                                onChange={(e) => setPick(g.id, e.target.value)}
                              >
                                {g.minSelect === 0 ? <option value="">—</option> : null}
                                {g.options.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.name}
                                    {o.priceDeltaCents ? ` (+${formatMoney(o.priceDeltaCents)})` : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                          <button
                            type="button"
                            className="mt-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB]"
                            onClick={() => addLineFromExpanded()}
                          >
                            Add to cart
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        <div
          id="cart"
          className="mt-10 scroll-mt-28 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:scroll-mt-0"
        >
          <div className="text-sm font-semibold text-slate-900">Cart</div>
          {cart.length === 0 ? (
            <p className="mt-2 text-xs text-slate-600">No items yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {cart.map((line) => (
                <li key={line.key} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <span>
                    {line.quantity}× {line.name}
                    {line.modifierOptionIds.length ? (
                      <span className="text-xs text-slate-600"> ({line.modifierOptionIds.length} add-on(s))</span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200/90 bg-white/80 px-2 py-1 text-xs text-slate-900"
                      onClick={() =>
                        setCart((c) =>
                          c
                            .map((x) => (x.key === line.key ? { ...x, quantity: x.quantity - 1 } : x))
                            .filter((x) => x.quantity > 0)
                        )
                      }
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200/90 bg-white/80 px-2 py-1 text-xs text-slate-900"
                      onClick={() =>
                        setCart((c) => c.map((x) => (x.key === line.key ? { ...x, quantity: x.quantity + 1 } : x)))
                      }
                    >
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-4 grid gap-1 text-xs text-slate-600">
            Note for kitchen (optional)
            <input
              className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-glow-blue hover:bg-[#2563EB] disabled:opacity-40"
            disabled={!menu?.restaurant || cart.length === 0}
            onClick={() => void checkout()}
          >
            Place order
          </button>
          {lastOrderId ? (
            <p className="mt-3 text-xs text-slate-600">
              Last order id: <span className="font-mono text-slate-900">{lastOrderId}</span>
            </p>
          ) : null}
        </div>

        <div
          id="track"
          className="mt-8 scroll-mt-28 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:scroll-mt-0"
        >
          <div className="text-sm font-semibold text-slate-900">Track order (no login)</div>
          <p className="mt-1 text-xs text-slate-600">Paste order id to see status. Updates in real time while this page is open.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400"
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              placeholder="Order id"
            />
            <button
              type="button"
              className="rounded-xl border border-slate-200/90 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
              onClick={() => void track()}
            >
              Track
            </button>
          </div>
          {trackInfo?.ok ? (
            <div className="mt-3 text-sm text-slate-900">
              <div>{trackInfo.restaurantName}</div>
              <div className="text-slate-600">
                Status: <span className="font-semibold text-slate-900">{trackInfo.status}</span> · Total:{" "}
                {formatMoney(trackInfo.totalCents ?? 0)}
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <MobileFloatingDock />
    </AmbientWebShell>
  );
}
