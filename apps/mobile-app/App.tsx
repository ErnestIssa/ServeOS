import { StatusBar } from "expo-status-bar";
import { ServeOSBrandScreenNative } from "@serveos/core-loading-native";
import React from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollMeshBackground } from "./src/ambient/ScrollMeshBackground";
import { contentBottomInset, FloatingGlassTabBar, type TabId } from "./src/shell/FloatingGlassTabBar";
import { FloatingTopBar, FLOATING_TOP_BAR_HEIGHT } from "./src/shell/FloatingTopBar";
import { R } from "./src/theme";

function apiHttpToWsBase(u: string) {
  const t = u.trim();
  if (t.startsWith("https://")) return `wss://${t.slice(8)}`;
  if (t.startsWith("http://")) return `ws://${t.slice(7)}`;
  return `ws://${t}`;
}

export default function App() {
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3000";
  const insets = useSafeAreaInsets();

  const [showSplash, setShowSplash] = React.useState(true);
  const [appReady, setAppReady] = React.useState(false);
  const [tab, setTab] = React.useState<TabId>("home");

  const [loginOpen, setLoginOpen] = React.useState(false);
  const [signupOpen, setSignupOpen] = React.useState(false);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [signupRole, setSignupRole] = React.useState<"OWNER" | "CUSTOMER" | "STAFF">("CUSTOMER");

  const [token, setToken] = React.useState<string | null>(null);
  const [userRole, setUserRole] = React.useState<string | null>(null);

  const [restaurants, setRestaurants] = React.useState<Array<{ id: string; name: string; role: string }>>([]);
  const [restaurantName, setRestaurantName] = React.useState("My Restaurant");
  const [status, setStatus] = React.useState("");

  const [menuRid, setMenuRid] = React.useState("");
  const [menuPreview, setMenuPreview] = React.useState<any>(null);
  const [cart, setCart] = React.useState<Array<{ menuItemId: string; quantity: number; modifierOptionIds: string[] }>>([]);
  const [orderNote, setOrderNote] = React.useState("");

  const [trackId, setTrackId] = React.useState("");
  const [trackResult, setTrackResult] = React.useState<any>(null);
  const [myOrders, setMyOrders] = React.useState<any[]>([]);

  const scrollY = React.useRef(new Animated.Value(0)).current;
  const onScroll = React.useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false
      }),
    [scrollY]
  );

  React.useEffect(() => {
    scrollY.setValue(0);
  }, [tab, scrollY]);

  const onSplashDismiss = React.useCallback(() => setShowSplash(false), []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) setAppReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (Platform.OS === "android") {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor("transparent");
    }
  }, []);

  async function call(path: string, init?: RequestInit) {
    try {
      const res = await fetch(`${API_URL}${path}`, init);
      const text = await res.text();
      try {
        return JSON.parse(text) as any;
      } catch {
        return { ok: false, error: text ? "bad_response" : "empty_response" };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "request_failed";
      return {
        ok: false,
        error:
          /network|failed to fetch|load failed/i.test(msg) || msg === "Aborted"
            ? "network_error_check_expo_public_api_url"
            : msg
      };
    }
  }

  async function refreshRestaurants(t: string) {
    const res = await call("/restaurants/restaurants", { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) return setStatus(res.error ?? "failed_to_list_restaurants");
    setRestaurants(res.restaurants ?? []);
  }

  async function loadPublicMenu() {
    if (!menuRid.trim()) return setStatus("Enter restaurant ID");
    setStatus("Loading…");
    const res = await call(`/restaurants/public/menu/${encodeURIComponent(menuRid.trim())}`);
    if (!res.ok) {
      setMenuPreview(null);
      return setStatus(res.error ?? "menu_failed");
    }
    setMenuPreview(res);
    setCart([]);
    setStatus("");
  }

  function addFirstMenuItemToCart() {
    const first = menuPreview?.categories?.[0]?.items?.[0];
    if (!first) return setStatus("Load a menu first");
    setCart((c) => [...c, { menuItemId: first.id, quantity: 1, modifierOptionIds: [] }]);
    setStatus("Added to cart");
  }

  async function submitOrder() {
    const rid = menuRid.trim();
    if (!rid || cart.length === 0) return setStatus("Need restaurant + cart");
    setStatus("Placing…");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await call("/orders/place", {
      method: "POST",
      headers,
      body: JSON.stringify({
        restaurantId: rid,
        lines: cart.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          modifierOptionIds: l.modifierOptionIds.length ? l.modifierOptionIds : undefined
        })),
        note: orderNote || undefined
      })
    });
    if (!res.ok) return setStatus(res.error ?? "order_failed");
    setStatus(`Order placed`);
    setCart([]);
    setTab("orders");
    setTrackId(res.order?.id ?? "");
  }

  async function fetchTrack() {
    if (!trackId.trim()) return;
    const res = await call(`/orders/public/${encodeURIComponent(trackId.trim())}`);
    setTrackResult(res);
  }

  async function fetchMyOrders() {
    if (!token || userRole !== "CUSTOMER") return;
    const res = await call("/orders/mine", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setMyOrders(res.orders ?? []);
  }

  React.useEffect(() => {
    if (tab === "orders" && token && userRole === "CUSTOMER") void fetchMyOrders();
  }, [tab, token, userRole]);

  React.useEffect(() => {
    const id = trackId.trim();
    if (!id) return;
    const url = `${apiHttpToWsBase(API_URL)}/orders/events?${new URLSearchParams({ orderId: id }).toString()}`;
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as {
          type?: string;
          orderId?: string;
          status?: string;
          totalCents?: number;
          restaurantName?: string;
        };
        if (data.type === "order_updated" && data.orderId === id) {
          setTrackResult((prev: any) => ({
            ok: true,
            orderId: data.orderId,
            status: data.status,
            totalCents: data.totalCents,
            restaurantName: data.restaurantName ?? prev?.restaurantName
          }));
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [trackId, API_URL]);

  React.useEffect(() => {
    if (!token || userRole !== "CUSTOMER") return;
    const url = `${apiHttpToWsBase(API_URL)}/orders/events?${new URLSearchParams({ mine: "1", token }).toString()}`;
    const ws = new WebSocket(url);
    ws.onmessage = () => void fetchMyOrders();
    return () => ws.close();
  }, [token, userRole, API_URL]);

  function money(cents: number) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }

  async function handleLogin() {
    setStatus("…");
    const res = await call("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok || !res.token) {
      setStatus(res.error ?? "login_failed");
      return;
    }
    setToken(res.token);
    setUserRole(res.user?.role ?? null);
    setLoginOpen(false);
    setStatus("");
    await refreshRestaurants(res.token);
  }

  async function handleSignup() {
    setStatus("…");
    const res = await call("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role: signupRole })
    });
    if (!res.ok || !res.token) {
      setStatus(res.error ?? "signup_failed");
      return;
    }
    setToken(res.token);
    setUserRole(res.user?.role ?? null);
    setSignupOpen(false);
    setStatus("");
    await refreshRestaurants(res.token);
  }

  if (showSplash) {
    return (
      <>
        <SafeAreaView style={styles.splashOnly} edges={["top", "left", "right"]}>
          <ServeOSBrandScreenNative appReady={appReady} onDismiss={onSplashDismiss} />
        </SafeAreaView>
        <StatusBar style="light" />
      </>
    );
  }

  const scrollBottom = contentBottomInset(insets.bottom);
  const scrollTopPad = R.space.sm + insets.top + FLOATING_TOP_BAR_HEIGHT + 18;

  const pageTitle =
    tab === "home"
      ? "Home"
      : tab === "orders"
        ? "Orders"
        : tab === "bookings"
          ? "Bookings"
          : tab === "messages"
            ? "Messages"
            : "Account";

  const leftLabel =
    (menuPreview?.ok && menuPreview.restaurant?.name ? String(menuPreview.restaurant.name) : null) ??
    (restaurants[0]?.name ? String(restaurants[0]?.name) : null) ??
    "ServeOS";

  return (
    <View style={styles.shell}>
      {Platform.OS === "ios" ? <StatusBar style="dark" /> : null}
      {Platform.OS === "android" ? <RNStatusBar translucent backgroundColor="transparent" barStyle="dark-content" /> : null}

      <View style={styles.main}>
        <ScrollMeshBackground tab={tab} scrollY={scrollY} />
        <FloatingTopBar
          topInset={insets.top}
          scrollY={scrollY}
          leftLabel={leftLabel}
          centerTitle={pageTitle}
          notificationCount={0}
          onLeftPress={() => setTab("account")}
          onSearch={() => setStatus("search")}
          onNotifications={() => setStatus("notifications")}
          onMenu={() => setStatus("menu")}
        />
        {tab === "home" && (
          <Animated.ScrollView
            style={styles.scrollLayer}
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={[styles.scrollPad, { paddingTop: scrollTopPad, paddingBottom: scrollBottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.heroGreeting}>{greeting()}</Text>
            <Text style={styles.heroTitle}>ServeOS</Text>
            <Text style={styles.heroSub}>Restaurant operating system — fast, minimal, in control.</Text>

            <View style={[styles.cardShell, styles.heroCard]}>
              <View style={styles.heroAccent} />
              <Text style={styles.cardLabel}>Overview</Text>
              <Text style={styles.heroMetric}>{restaurants.length}</Text>
              <Text style={styles.cardCaption}>venues linked to you</Text>
              <View style={styles.heroActions}>
                <Pressable
                  style={({ pressed }) => [styles.pillPrimary, pressed && styles.pressed]}
                  onPress={() => setTab("orders")}
                >
                  <Text style={styles.pillPrimaryText}>Order food</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.pillGhost, pressed && styles.pressed]} onPress={() => setLoginOpen(true)}>
                  <Text style={styles.pillGhostText}>{token ? "Account" : "Sign in"}</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Quick actions</Text>
            <View style={styles.tileRow}>
              <Pressable style={({ pressed }) => [styles.cardShell, styles.tile, pressed && styles.pressed]} onPress={() => setSignupOpen(true)}>
                <Text style={styles.tileEmoji}>✦</Text>
                <Text style={styles.tileTitle}>Create account</Text>
                <Text style={styles.tileSub}>Owner, staff, or customer</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.cardShell, styles.tile, pressed && styles.pressed]} onPress={() => setTab("orders")}>
                <Text style={styles.tileEmoji}>◎</Text>
                <Text style={styles.tileTitle}>Track order</Text>
                <Text style={styles.tileSub}>Status without login</Text>
              </Pressable>
            </View>

            {status ? <Text style={styles.banner}>{status}</Text> : null}
          </Animated.ScrollView>
        )}

        {tab === "bookings" && (
          <Animated.ScrollView
            style={styles.scrollLayer}
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={[styles.scrollPad, { paddingTop: scrollTopPad, paddingBottom: scrollBottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.pageTitle}>Bookings</Text>
            <Text style={styles.pageSub}>Reserve tables and manage upcoming visits — one calm place for hospitality.</Text>
            <View style={[styles.cardShell, styles.surfaceCard]}>
              <View style={styles.premiumBadgeRow}>
                <Text style={styles.premiumBadge}>Coming soon</Text>
              </View>
              <Text style={styles.cardHeadline}>Table & event bookings</Text>
              <Text style={styles.cardBodyMuted}>
                You’ll soon be able to hold tables, special events, and guest preferences here — aligned with your venue
                rules.
              </Text>
            </View>
            <View style={[styles.cardShell, styles.surfaceCard, styles.mtSm]}>
              <Text style={styles.inputLabel}>Venue</Text>
              <Text style={styles.cardBodyMuted}>
                Connect a restaurant from Account, then return here to see availability when booking opens.
              </Text>
            </View>
          </Animated.ScrollView>
        )}

        {tab === "orders" && (
          <Animated.ScrollView
            style={styles.scrollLayer}
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={[styles.scrollPad, { paddingTop: scrollTopPad, paddingBottom: scrollBottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.pageTitle}>Orders</Text>
            <Text style={styles.pageSub}>Browse menus, place orders, and track status — same flow as customer web.</Text>

            <View style={[styles.cardShell, styles.fieldCard]}>
              <Text style={styles.inputLabel}>Restaurant ID</Text>
              <TextInput
                value={menuRid}
                onChangeText={setMenuRid}
                placeholder="Paste venue ID"
                placeholderTextColor={R.textMuted}
                style={styles.input}
                autoCapitalize="none"
              />
              <Pressable style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed]} onPress={() => void loadPublicMenu()}>
                <Text style={styles.pillPrimaryText}>Load menu</Text>
              </Pressable>
            </View>

            {menuPreview?.ok && menuPreview.restaurant ? (
              <View style={[styles.cardShell, styles.menuCard]}>
                <Text style={styles.menuVenue}>{menuPreview.restaurant.name}</Text>
                {(menuPreview.categories ?? []).map((cat: any) => (
                  <View key={cat.id} style={styles.catBlock}>
                    <Text style={styles.catTitle}>{cat.name}</Text>
                    {(cat.items ?? []).map((item: any) => (
                      <View key={item.id} style={styles.menuRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
                        </View>
                        <Text style={styles.itemPrice}>{money(item.priceCents)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}

            <View style={[styles.cardShell, styles.fieldCard]}>
              <Text style={styles.inputLabel}>Cart · {cart.length} line(s)</Text>
              <Pressable style={({ pressed }) => [styles.pillSecondary, pressed && styles.pressed]} onPress={addFirstMenuItemToCart}>
                <Text style={styles.pillSecondaryText}>Add first item to cart</Text>
              </Pressable>
              <Text style={styles.inputLabel}>Kitchen note</Text>
              <TextInput
                value={orderNote}
                onChangeText={setOrderNote}
                placeholder="Optional"
                placeholderTextColor={R.textMuted}
                style={styles.input}
              />
              <Pressable style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed]} onPress={() => void submitOrder()}>
                <Text style={styles.pillPrimaryText}>Place order</Text>
              </Pressable>
            </View>

            <View style={[styles.cardShell, styles.surfaceCard, styles.mtSm]}>
              <Text style={styles.sectionLabelSmall}>Track an order</Text>
              <Text style={styles.inputLabel}>Order ID</Text>
              <TextInput
                value={trackId}
                onChangeText={setTrackId}
                placeholder="Paste order id"
                placeholderTextColor={R.textMuted}
                style={styles.input}
                autoCapitalize="none"
              />
              <Pressable style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed]} onPress={() => void fetchTrack()}>
                <Text style={styles.pillPrimaryText}>Track</Text>
              </Pressable>
              {trackResult?.ok ? (
                <View style={styles.trackBox}>
                  <Text style={styles.trackVenue}>{trackResult.restaurantName}</Text>
                  <Text style={styles.trackLine}>
                    {trackResult.status} · {money(trackResult.totalCents ?? 0)}
                  </Text>
                </View>
              ) : null}
            </View>

            {token && userRole === "CUSTOMER" ? (
              <View style={[styles.cardShell, styles.surfaceCard, styles.mtSm]}>
                <Text style={styles.sectionLabelSmall}>Your orders</Text>
                {myOrders.length === 0 ? (
                  <Text style={styles.itemDesc}>No orders yet.</Text>
                ) : (
                  myOrders.map((o: any) => (
                    <View key={o.id} style={styles.orderRow}>
                      <Text style={styles.itemName}>{money(o.totalCents)}</Text>
                      <Text style={styles.itemDesc}>{o.status}</Text>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <Text style={styles.hint}>Log in as a customer to see your order history here.</Text>
            )}
          </Animated.ScrollView>
        )}

        {tab === "messages" && (
          <Animated.ScrollView
            style={styles.scrollLayer}
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={[styles.scrollPad, { paddingTop: scrollTopPad, paddingBottom: scrollBottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.pageTitle}>Messages</Text>
            <Text style={styles.pageSub}>Guest and team conversations in one thread — clear, fast, on-brand.</Text>
            <View style={[styles.cardShell, styles.surfaceCard]}>
              <View style={styles.premiumBadgeRow}>
                <Text style={styles.premiumBadge}>Inbox</Text>
              </View>
              <Text style={styles.cardHeadline}>No conversations yet</Text>
              <Text style={styles.cardBodyMuted}>
                When guests or staff message your venues, threads will appear here with read state and quick actions.
              </Text>
            </View>
          </Animated.ScrollView>
        )}

        {tab === "account" && (
          <Animated.ScrollView
            style={styles.scrollLayer}
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={[styles.scrollPad, { paddingTop: scrollTopPad, paddingBottom: scrollBottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.pageTitle}>Account</Text>
            <Text style={styles.pageSub}>Venues, session, and business tools.</Text>

            <View style={[styles.cardShell, styles.fieldCard]}>
              <Text style={styles.inputLabel}>New restaurant</Text>
              <TextInput
                value={restaurantName}
                onChangeText={setRestaurantName}
                placeholder="Name"
                placeholderTextColor={R.textMuted}
                style={styles.input}
              />
              <Pressable
                style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed, !token && styles.disabled]}
                disabled={!token}
                onPress={async () => {
                  if (!token) return;
                  const res = await call("/restaurants/restaurants", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ name: restaurantName })
                  });
                  if (!res.ok) return setStatus(res.error ?? "create_failed");
                  await refreshRestaurants(token);
                  setStatus("Restaurant created");
                }}
              >
                <Text style={styles.pillPrimaryText}>Create venue</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Your venues</Text>
            {restaurants.map((r) => (
              <View key={r.id} style={[styles.cardShell, styles.venueCard]}>
                <Text style={styles.itemName}>{r.name}</Text>
                <Text style={styles.mono}>{r.id}</Text>
                <Text style={styles.itemDesc}>Role: {r.role}</Text>
              </View>
            ))}

            <View style={[styles.cardShell, styles.fieldCard]}>
              <Text style={styles.inputLabel}>API</Text>
              <Text style={styles.mono}>{API_URL}</Text>
              {token ? (
                <Pressable
                  style={({ pressed }) => [styles.pillGhost, styles.mtSm, pressed && styles.pressed]}
                  onPress={() => {
                    setToken(null);
                    setUserRole(null);
                    setRestaurants([]);
                    setMyOrders([]);
                  }}
                >
                  <Text style={styles.pillGhostText}>Sign out</Text>
                </Pressable>
              ) : (
                <Pressable style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed]} onPress={() => setLoginOpen(true)}>
                  <Text style={styles.pillPrimaryText}>Sign in</Text>
                </Pressable>
              )}
            </View>
          </Animated.ScrollView>
        )}
      </View>

      <FloatingGlassTabBar tab={tab} onChange={setTab} insets={insets} />

      <Modal visible={loginOpen} animationType="slide" transparent onRequestClose={() => setLoginOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setLoginOpen(false)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, R.space.lg) }]}>
            <View style={styles.modalGrab} />
            <Text style={styles.modalTitle}>Sign in</Text>
            <Text style={styles.modalSub}>Use your ServeOS email and password.</Text>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="you@email.com" placeholderTextColor={R.textMuted} autoCapitalize="none" keyboardType="email-address" />
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput value={password} onChangeText={setPassword} style={styles.input} placeholder="••••••••" placeholderTextColor={R.textMuted} secureTextEntry />
            <Pressable style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed]} onPress={() => void handleLogin()}>
              <Text style={styles.pillPrimaryText}>Continue</Text>
            </Pressable>
            <Pressable style={styles.modalLink} onPress={() => { setLoginOpen(false); setSignupOpen(true); }}>
              <Text style={styles.modalLinkText}>Need an account? Create one</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={signupOpen} animationType="slide" transparent onRequestClose={() => setSignupOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSignupOpen(false)} />
          <View style={[styles.modalSheet, { maxHeight: "88%", paddingBottom: Math.max(insets.bottom, R.space.lg) }]}>
            <View style={styles.modalGrab} />
            <Text style={styles.modalTitle}>Create account</Text>
            <Text style={styles.modalSub}>Choose how you’ll use ServeOS.</Text>
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.segment}>
              {(["CUSTOMER", "OWNER", "STAFF"] as const).map((r) => (
                <Pressable
                  key={r}
                  style={[styles.segmentChip, signupRole === r && styles.segmentChipOn]}
                  onPress={() => setSignupRole(r)}
                >
                  <Text style={[styles.segmentText, signupRole === r && styles.segmentTextOn]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="you@email.com" placeholderTextColor={R.textMuted} autoCapitalize="none" keyboardType="email-address" />
            <Text style={styles.inputLabel}>Password (8+ characters)</Text>
            <TextInput value={password} onChangeText={setPassword} style={styles.input} placeholder="••••••••" placeholderTextColor={R.textMuted} secureTextEntry />
            <Pressable style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed]} onPress={() => void handleSignup()}>
              <Text style={styles.pillPrimaryText}>Create account</Text>
            </Pressable>
            <Pressable style={styles.modalLink} onPress={() => { setSignupOpen(false); setLoginOpen(true); }}>
              <Text style={styles.modalLinkText}>Already have an account? Sign in</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  splashOnly: { flex: 1, backgroundColor: "#8B5CF6" },
  shell: { flex: 1, backgroundColor: "transparent" },
  main: { flex: 1, position: "relative" },
  scrollLayer: { flex: 1, zIndex: 1 },
  scrollPad: { paddingHorizontal: R.space.sm },

  heroGreeting: { fontSize: R.type.label, color: R.textSecondary, fontWeight: "500" },
  heroTitle: { fontSize: R.type.hero, fontWeight: "800", color: R.text, letterSpacing: -0.5, marginTop: 4 },
  heroSub: { fontSize: R.type.body, color: R.textSecondary, marginTop: R.space.xs, lineHeight: 22 },

  cardShell: {
    backgroundColor: "rgba(255,255,255,0.84)",
    borderRadius: R.radius.card,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.92)",
    ...Platform.select({
      ios: { shadowColor: "#0f172a", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16 },
      android: { elevation: 3 }
    })
  },
  heroCard: {
    marginTop: R.space.md,
    padding: R.space.md
  },
  heroAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: R.radius.card,
    borderTopRightRadius: R.radius.card,
    backgroundColor: R.accentPurple
  },
  cardLabel: { fontSize: R.type.caption, color: R.textSecondary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  heroMetric: { fontSize: 40, fontWeight: "800", color: R.text, marginTop: 8, letterSpacing: -1 },
  cardCaption: { fontSize: R.type.label, color: R.textMuted, marginTop: 4 },
  heroActions: { flexDirection: "row", gap: R.space.xs, marginTop: R.space.md, flexWrap: "wrap" },

  pillPrimary: {
    backgroundColor: R.accentPurple,
    paddingVertical: 14,
    paddingHorizontal: R.space.md,
    borderRadius: R.radius.pill,
    alignItems: "center",
    minWidth: 120
  },
  pillPrimaryText: { color: "#FFFFFF", fontSize: R.type.label, fontWeight: "700" },
  pillGhost: {
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    paddingVertical: 14,
    paddingHorizontal: R.space.md,
    borderRadius: R.radius.pill,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.65)"
  },
  pillGhostText: { color: R.text, fontSize: R.type.label, fontWeight: "600" },
  pillSecondary: {
    borderWidth: 1.5,
    borderColor: R.accentBlue,
    paddingVertical: 12,
    borderRadius: R.radius.pill,
    alignItems: "center"
  },
  pillSecondaryText: { color: R.accentBlue, fontSize: R.type.label, fontWeight: "700" },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.4 },

  sectionLabel: { fontSize: R.type.label, fontWeight: "700", color: R.text, marginTop: R.space.lg, marginBottom: R.space.xs },
  sectionLabelSmall: {
    fontSize: R.type.label,
    fontWeight: "800",
    color: R.text,
    marginBottom: R.space.xs,
    letterSpacing: 0.2
  },
  premiumBadgeRow: { marginBottom: R.space.sm },
  premiumBadge: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "800",
    color: R.accentPurple,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(139,92,246,0.12)",
    overflow: "hidden"
  },
  cardHeadline: { fontSize: R.type.title, fontWeight: "800", color: R.text, letterSpacing: -0.3 },
  cardBodyMuted: { fontSize: R.type.body, color: R.textSecondary, marginTop: R.space.xs, lineHeight: 22 },
  tileRow: { flexDirection: "row", gap: R.space.sm, marginTop: R.space.xs },
  tile: {
    flex: 1,
    borderRadius: R.radius.tile,
    padding: R.space.sm
  },
  tileEmoji: { fontSize: 22, marginBottom: 4 },
  tileTitle: { fontSize: R.type.label, fontWeight: "700", color: R.text },
  tileSub: { fontSize: R.type.caption, color: R.textSecondary, marginTop: 4 },

  banner: { marginTop: R.space.md, fontSize: R.type.caption, color: R.danger },

  pageTitle: { fontSize: R.type.title, fontWeight: "800", color: R.text },
  pageSub: { fontSize: R.type.label, color: R.textSecondary, marginTop: 6, marginBottom: R.space.md, lineHeight: 20 },

  fieldCard: {
    padding: R.space.sm,
    marginBottom: R.space.sm
  },
  surfaceCard: {
    padding: R.space.md,
    marginBottom: R.space.sm
  },
  inputLabel: { fontSize: R.type.caption, fontWeight: "600", color: R.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: R.border,
    borderRadius: R.radius.input,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: R.type.body,
    color: R.text,
    backgroundColor: "rgba(255,255,255,0.85)"
  },
  mtSm: { marginTop: R.space.sm },

  menuCard: {
    padding: R.space.sm,
    marginBottom: R.space.sm
  },
  menuVenue: { fontSize: R.type.title, fontWeight: "800", color: R.text, marginBottom: R.space.sm },
  catBlock: { marginBottom: R.space.md },
  catTitle: { fontSize: R.type.caption, fontWeight: "700", color: R.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  menuRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: R.border },
  itemName: { fontSize: R.type.body, fontWeight: "600", color: R.text },
  itemDesc: { fontSize: R.type.caption, color: R.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: R.type.body, fontWeight: "700", color: R.text },

  trackBox: {
    marginTop: R.space.sm,
    padding: R.space.sm,
    backgroundColor: "rgba(248,250,252,0.96)",
    borderRadius: R.radius.tile,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.85)"
  },
  trackVenue: { fontSize: R.type.body, fontWeight: "700", color: R.text },
  trackLine: { fontSize: R.type.label, color: R.textSecondary, marginTop: 4 },
  orderRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: R.border },
  hint: { fontSize: R.type.caption, color: R.textMuted, marginTop: R.space.sm },

  venueCard: {
    padding: R.space.sm,
    borderRadius: R.radius.tile,
    marginBottom: R.space.xs
  },
  mono: { fontSize: 11, color: R.textMuted, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(17,24,39,0.45)" },
  modalSheet: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: R.space.md,
    paddingTop: R.space.xs
  },
  modalGrab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: R.borderStrong, marginBottom: R.space.sm },
  modalTitle: { fontSize: 22, fontWeight: "800", color: R.text },
  modalSub: { fontSize: R.type.label, color: R.textSecondary, marginTop: 6, marginBottom: R.space.md },
  modalLink: { marginTop: R.space.md, alignItems: "center", paddingVertical: 8 },
  modalLinkText: { fontSize: R.type.label, color: R.accentBlue, fontWeight: "600" },

  segment: { flexDirection: "row", gap: 8, marginBottom: R.space.sm, flexWrap: "wrap" },
  segmentChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: R.radius.pill,
    borderWidth: 1,
    borderColor: R.border,
    backgroundColor: R.bgElevated
  },
  segmentChipOn: { borderColor: R.accentPurple, backgroundColor: "rgba(245,243,255,0.95)" },
  segmentText: { fontSize: 12, fontWeight: "600", color: R.textSecondary },
  segmentTextOn: { color: R.accentPurple }
});
