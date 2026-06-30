import { formatMoneyCents } from "@serveos/core-shared/currency";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addSessionCartItem,
  completeOrderCheckout,
  fetchOrderingSession,
  fetchSessionCart,
  fetchSessionMenu,
  placeOrderFromSession,
  startOrderCheckout,
  type SessionCartPayload
} from "../api";

type Props = {
  sessionId: string;
  onHome: () => void;
};

type MenuCategory = NonNullable<Awaited<ReturnType<typeof fetchSessionMenu>>["categories"]>[number];
type MenuItem = MenuCategory["items"][number];

export function GuestOrderingPage({ sessionId, onHome }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [venueName, setVenueName] = useState("");
  const [paymentMode, setPaymentMode] = useState("PAY_AT_VENUE");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [cart, setCart] = useState<SessionCartPayload | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [modifierSelections, setModifierSelections] = useState<Record<string, string[]>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [checkoutInfo, setCheckoutInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const money = useCallback((cents: number) => formatMoneyCents(cents, { currency: "SEK" }), []);

  const refreshCart = useCallback(async () => {
    const res = await fetchSessionCart(sessionId);
    if (res.ok) {
      setCart({
        lines: res.lines ?? [],
        subtotalCents: res.subtotalCents ?? 0,
        totalQuantity: res.totalQuantity ?? 0,
        orderNote: res.orderNote ?? ""
      });
    }
  }, [sessionId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sessionRes = await fetchOrderingSession(sessionId);
    if (!sessionRes.ok || !sessionRes.session) {
      setLoading(false);
      setError(sessionRes.message ?? "This ordering link is invalid or expired.");
      return;
    }
    setPaymentMode(sessionRes.session.paymentMode);
    const menuRes = await fetchSessionMenu(sessionId);
    setLoading(false);
    if (!menuRes.ok) {
      setError(menuRes.message ?? "Menu is not available yet.");
      return;
    }
    setVenueName(menuRes.restaurant?.name ?? "Venue");
    setCategories(menuRes.categories ?? []);
    await refreshCart();
  }, [sessionId, refreshCart]);

  useEffect(() => {
    void load();
  }, [load]);

  const openItem = (item: MenuItem) => {
    setSelectedItem(item);
    const initial: Record<string, string[]> = {};
    for (const g of item.modifierGroups ?? []) {
      if (g.minSelect > 0 && g.options[0]) initial[g.id] = [g.options[0].id];
      else initial[g.id] = [];
    }
    setModifierSelections(initial);
  };

  const toggleModifier = (groupId: string, optionId: string, maxSelect: number) => {
    setModifierSelections((prev) => {
      const current = prev[groupId] ?? [];
      if (maxSelect <= 1) return { ...prev, [groupId]: current.includes(optionId) ? [] : [optionId] };
      if (current.includes(optionId)) return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      if (current.length >= maxSelect) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const modifierIds = useMemo(
    () => Object.values(modifierSelections).flat(),
    [modifierSelections]
  );

  const addToCart = async () => {
    if (!selectedItem) return;
    for (const g of selectedItem.modifierGroups ?? []) {
      const picked = modifierSelections[g.id]?.length ?? 0;
      if (picked < g.minSelect) {
        setError(`Choose at least ${g.minSelect} option(s) for ${g.name}.`);
        return;
      }
    }
    setBusy(true);
    const res = await addSessionCartItem(sessionId, {
      menuItemId: selectedItem.id,
      quantity: 1,
      modifierOptionIds: modifierIds
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? res.meta?.message ?? "Could not add to cart");
      return;
    }
    setSelectedItem(null);
    setError(null);
    await refreshCart();
  };

  const placeOrder = async () => {
    if (!cart?.lines.length) return;
    setBusy(true);
    const session = await fetchOrderingSession(sessionId);
    if (!session.ok || !session.session) {
      setBusy(false);
      setError("Session expired.");
      return;
    }
    const placed = await placeOrderFromSession({
      restaurantId: session.session.restaurantId,
      sourceSessionId: sessionId,
      fromSessionCart: true
    });
    setBusy(false);
    if (!placed.ok || !placed.order) {
      setError(placed.message ?? placed.error ?? "Could not place order");
      return;
    }
    setPlacedOrderId(placed.order.id);
    if (placed.order.status === "PENDING_PAYMENT" || paymentMode === "PREPAY" || paymentMode === "HYBRID") {
      setCheckoutOpen(true);
      const provider = paymentMode === "PAY_AT_VENUE" ? "cash" : "swish";
      const checkout = await startOrderCheckout(placed.order.id, provider === "cash" ? "cash" : "swish");
      if (checkout.ok && checkout.checkout) {
        setCheckoutInfo(checkout.checkout.instructions ?? checkout.checkout.swishQrData ?? null);
      }
    } else {
      await refreshCart();
    }
  };

  const completePayment = async () => {
    if (!placedOrderId) return;
    setBusy(true);
    const res = await completeOrderCheckout(placedOrderId, paymentMode === "PAY_AT_VENUE" ? "cash" : "swish");
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? res.error ?? "Payment failed");
      return;
    }
    setCheckoutOpen(false);
    setPlacedOrderId(null);
    setCheckoutInfo(null);
    await refreshCart();
  };

  if (loading) {
    return (
      <div className="guest-order-page min-h-screen px-4 py-16 text-center">
        <p className="text-sm text-white/70">Loading menu…</p>
      </div>
    );
  }

  if (error && !categories.length) {
    return (
      <div className="guest-order-page min-h-screen px-4 py-16 text-center">
        <p className="font-display text-2xl font-bold text-white">{error}</p>
        <button type="button" className="mt-6 rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900" onClick={onHome}>
          Back home
        </button>
      </div>
    );
  }

  return (
    <div className="guest-order-page min-h-screen pb-28">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">Order at table</p>
            <h1 className="font-display text-2xl font-bold text-white">{venueName}</h1>
          </div>
          <button type="button" className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80" onClick={onHome}>
            Home
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {error ? <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

        {categories.map((cat) => (
          <section key={cat.id} className="mb-8">
            <h2 className="font-display text-xl font-bold text-white">{cat.name}</h2>
            <ul className="mt-3 space-y-3">
              {cat.items.filter((i) => i.isActive).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="guest-order-item w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left"
                    onClick={() => openItem(item)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        {item.description ? <p className="mt-1 text-sm text-white/65">{item.description}</p> : null}
                      </div>
                      <p className="shrink-0 font-semibold text-violet-200">{money(item.priceCents)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Cart</p>
            <p className="font-semibold text-white">
              {cart?.totalQuantity ?? 0} items · {money(cart?.subtotalCents ?? 0)}
            </p>
          </div>
          <button
            type="button"
            disabled={busy || !cart?.lines.length}
            className="rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => void placeOrder()}
          >
            {busy ? "Placing…" : paymentMode === "PAY_AT_VENUE" ? "Place order" : "Pay & order"}
          </button>
        </div>
      </div>

      {selectedItem ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60 sm:items-center sm:justify-center sm:p-4">
          <div className="max-h-[85vh] w-full overflow-auto rounded-t-3xl bg-slate-900 p-5 sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-bold text-white">{selectedItem.name}</h3>
                <p className="mt-1 text-violet-200">{money(selectedItem.priceCents)}</p>
              </div>
              <button type="button" className="text-white/60" onClick={() => setSelectedItem(null)}>
                Close
              </button>
            </div>
            {selectedItem.description ? <p className="mt-3 text-sm text-white/70">{selectedItem.description}</p> : null}

            {(selectedItem.modifierGroups ?? []).map((g) => (
              <div key={g.id} className="mt-5">
                <p className="text-sm font-semibold text-white">
                  {g.name}
                  {g.minSelect > 0 ? <span className="text-white/50"> · pick {g.minSelect}</span> : null}
                </p>
                <div className="mt-2 space-y-2">
                  {g.options.filter((o) => o.isActive).map((o) => {
                    const picked = modifierSelections[g.id]?.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                          picked ? "border-violet-400 bg-violet-500/15 text-white" : "border-white/10 text-white/80"
                        }`}
                        onClick={() => toggleModifier(g.id, o.id, g.maxSelect)}
                      >
                        <span>{o.name}</span>
                        <span>{o.priceDeltaCents ? `+${money(o.priceDeltaCents)}` : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              type="button"
              disabled={busy}
              className="mt-6 w-full rounded-full bg-violet-500 py-3 font-semibold text-white disabled:opacity-40"
              onClick={() => void addToCart()}
            >
              {busy ? "Adding…" : "Add to cart"}
            </button>
          </div>
        </div>
      ) : null}

      {checkoutOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 p-6">
            <h3 className="font-display text-xl font-bold text-white">Complete payment</h3>
            <p className="mt-2 text-sm text-white/70">
              {checkoutInfo ?? "Confirm payment to send your order to the kitchen."}
            </p>
            <div className="mt-5 flex gap-2">
              <button type="button" className="flex-1 rounded-full border border-white/15 py-2.5 text-sm text-white" onClick={() => setCheckoutOpen(false)}>
                Later
              </button>
              <button type="button" disabled={busy} className="flex-1 rounded-full bg-violet-500 py-2.5 text-sm font-semibold text-white" onClick={() => void completePayment()}>
                {busy ? "Processing…" : "I paid"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
