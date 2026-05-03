import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { nativeNavBoldGradient, type AmbientNativeTab } from "@serveos/core-ambient/themes";
import { ServeOSBrandScreenNative } from "@serveos/core-loading-native";
import React from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { runOnJS, useAnimatedReaction, useSharedValue, withSpring } from "react-native-reanimated";
import { ScrollMeshBackground } from "./src/ambient/ScrollMeshBackground";
import { apiFetch, apiHttpToWsBase, authMe, API_URL, type AuthUser } from "./src/api";
import { AuthFlowScreen } from "./src/auth/AuthFlowScreen";
import { deleteCartLine, fetchCustomerCart, postCartAddItem, type CartLineApi } from "./src/customer/cartApi";
import { CartFABPopup } from "./src/customer/CartFABPopup";
import { CartSheetPanel } from "./src/customer/CartSheetPanel";
import { buildCustomerHomeHeader, customerDisplayName } from "./src/customer/customerHomeCopy";
import {
  getServeosDemoPublicMenu,
  isServeosDemoMenuEnabled,
  SERVEOS_DEMO_RESTAURANT_ID
} from "./src/customer/demoPeakModeMenu";
import { CustomerMenuBrowsing, recordOrderedItemsForRestaurant } from "./src/menu/CustomerMenuBrowsing";
import { buildFilteredMenuPool, type MenuCategoryLite } from "./src/menu/menuBrowseUtils";
import { BottomNavContentDimmer } from "./src/shell/BottomNavContentDimmer";
import { TopNavContentDimmer } from "./src/shell/TopNavContentDimmer";
import {
  contentBottomInset,
  FLOATING_TAB_BAR_HEIGHT,
  FLOAT_MARGIN_BOTTOM,
  FLOAT_MARGIN_SIDE,
  FloatingGlassTabBar,
  type TabId
} from "./src/shell/FloatingGlassTabBar";
import { computeNavSheetSnapDims, SHEET_SPRING_CONFIG } from "./src/shell/NavExpandSheet";
import { FloatingTopBar, FLOATING_TOP_BAR_HEIGHT } from "./src/shell/FloatingTopBar";
import { R } from "./src/theme";

const AUTH_TOKEN_KEY = "serveos.auth.jwt";
const CUSTOMER_VENUE_KEY = "serveos.customer.preferredRestaurantId";

export default function App() {
  const insets = useSafeAreaInsets();

  const [showSplash, setShowSplash] = React.useState(true);
  const [appReady, setAppReady] = React.useState(false);
  const [sessionReady, setSessionReady] = React.useState(false);
  const screenEnter = React.useRef(new Animated.Value(0)).current; // content enter opacity
  const screenEnterY = React.useRef(new Animated.Value(18)).current;
  const [tab, setTab] = React.useState<TabId>("home");

  const [token, setToken] = React.useState<string | null>(null);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [sessionUser, setSessionUser] = React.useState<AuthUser | null>(null);

  const [restaurants, setRestaurants] = React.useState<Array<{ id: string; name: string; role: string; companyId?: string | null }>>([]);
  const [restaurantName, setRestaurantName] = React.useState("My Restaurant");
  const [status, setStatus] = React.useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = React.useState("");

  const [menuRid, setMenuRid] = React.useState("");
  const [menuPreview, setMenuPreview] = React.useState<any>(null);
  const [localCart, setLocalCart] = React.useState<Array<{ menuItemId: string; quantity: number; modifierOptionIds: string[] }>>(
    []
  );
  const [customerCart, setCustomerCart] = React.useState<{
    lines: CartLineApi[];
    subtotalCents: number;
    totalQuantity: number;
  }>({
    lines: [],
    subtotalCents: 0,
    totalQuantity: 0
  });
  const [orderNote, setOrderNote] = React.useState("");
  const [placingOrder, setPlacingOrder] = React.useState(false);
  const [cartFabBump, setCartFabBump] = React.useState(0);
  const [cartFabDeferred, setCartFabDeferred] = React.useState(false);

  const [trackId, setTrackId] = React.useState("");
  const [trackResult, setTrackResult] = React.useState<any>(null);
  const [myOrders, setMyOrders] = React.useState<any[]>([]);
  const [menuPrefsSeq, setMenuPrefsSeq] = React.useState(0);

  const customerHomeScrollRef = React.useRef<ScrollView | null>(null);
  const [customerMenuTopY, setCustomerMenuTopY] = React.useState(320);

  const scrollY = React.useRef(new Animated.Value(0)).current;
  const onScroll = React.useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false
      }),
    [scrollY]
  );

  const sheetHeightSV = useSharedValue(0);

  const applyCustomerCartResponse = React.useCallback(
    (body: { lines: CartLineApi[]; subtotalCents: number; totalQuantity: number }) => {
      setCustomerCart({
        lines: body.lines,
        subtotalCents: body.subtotalCents,
        totalQuantity: body.totalQuantity
      });
    },
    []
  );

  const refreshCustomerCart = React.useCallback(
    async (restaurantId: string) => {
      const t = token;
      if (!t || userRole !== "CUSTOMER" || !restaurantId.trim()) return;
      const res = await fetchCustomerCart(restaurantId.trim(), t);
      if (res.ok) applyCustomerCartResponse(res);
    },
    [token, userRole, applyCustomerCartResponse]
  );

  const openCartSheetHalf = React.useCallback(() => {
    const { snapMid } = computeNavSheetSnapDims(Dimensions.get("window").height, insets);
    sheetHeightSV.value = withSpring(snapMid, SHEET_SPRING_CONFIG);
    setCartFabDeferred(true);
  }, [insets, sheetHeightSV]);

  /** Restaurant id for the menu on screen (authoritative for cart + place order). */
  const activeRestaurantId = React.useCallback(() => {
    const fromMenu =
      menuPreview?.ok && menuPreview.restaurant?.id ? String(menuPreview.restaurant.id).trim() : "";
    return fromMenu || menuRid.trim();
  }, [menuPreview, menuRid]);

  useAnimatedReaction(
    () => sheetHeightSV.value,
    (h) => {
      if (h <= 40) runOnJS(setCartFabDeferred)(false);
    },
    []
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
    // Smooth transition whenever we (re)enter auth/main screens
    if (showSplash || !sessionReady) return;
    screenEnter.setValue(0);
    screenEnterY.setValue(18);
    Animated.parallel([
      Animated.timing(screenEnter, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(screenEnterY, { toValue: 0, duration: 620, useNativeDriver: true })
    ]).start();
  }, [showSplash, sessionReady, token, screenEnter, screenEnterY]);

  React.useEffect(() => {
    if (Platform.OS === "android") {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor("transparent");
    }
  }, []);

  async function refreshRestaurants(t: string) {
    const res = await apiFetch<{
      ok: boolean;
      restaurants?: Array<{ id: string; name: string; role: string; companyId?: string | null }>;
      error?: string;
    }>("/restaurants/restaurants", { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) return setStatus(res.error ?? "failed_to_list_restaurants");
    setRestaurants(res.restaurants ?? []);
  }

  /** Prefetch authenticated data so tabs render without flashing secondary loaders after entry. */
  const warmAuthenticatedSession = React.useCallback(async (jwt: string) => {
    const me = await authMe(jwt);
    if (!me.ok || !me.user) {
      throw new Error(me.error ?? "session_failed");
    }
    const rest = await apiFetch<{
      ok: boolean;
      restaurants?: Array<{ id: string; name: string; role: string; companyId?: string | null }>;
      error?: string;
    }>("/restaurants/restaurants", { headers: { Authorization: `Bearer ${jwt}` } });
    if (!rest.ok) {
      throw new Error(rest.error ?? "failed_to_list_restaurants");
    }
    setRestaurants(rest.restaurants ?? []);
    const ordersRes = await apiFetch<{ ok: boolean; orders?: any[]; error?: string }>("/orders/mine", {
      headers: { Authorization: `Bearer ${jwt}` }
    });
    if (!ordersRes.ok) {
      throw new Error(ordersRes.error ?? "failed_to_fetch_orders");
    }
    setMyOrders(ordersRes.orders ?? []);
    setSessionUser(me.user);
    return me.user;
  }, []);

  const completeAuthSession = React.useCallback(
    async ({ token: jwt }: { token: string; user: AuthUser }) => {
      const meUser = await warmAuthenticatedSession(jwt);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, jwt);
      setToken(jwt);
      setUserRole(meUser.role);
      setStatus("");
    },
    [warmAuthenticatedSession]
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (cancelled) return;
        if (stored) {
          try {
            const user = await warmAuthenticatedSession(stored);
            if (cancelled) return;
            setToken(stored);
            setUserRole(user.role);
          } catch {
            await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
            if (!cancelled) {
              setToken(null);
              setUserRole(null);
              setSessionUser(null);
              setRestaurants([]);
              setMyOrders([]);
            }
          }
        }
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [warmAuthenticatedSession]);

  async function fetchPublicMenuForRestaurant(restaurantId: string) {
    return apiFetch<Record<string, unknown> & { ok?: boolean; error?: string }>(
      `/restaurants/public/menu/${encodeURIComponent(restaurantId.trim())}`
    );
  }

  React.useEffect(() => {
    if (!token || userRole !== "CUSTOMER" || isServeosDemoMenuEnabled()) return;
    let cancelled = false;
    void (async () => {
      const rid = (await AsyncStorage.getItem(CUSTOMER_VENUE_KEY))?.trim();
      if (!rid || cancelled) return;
      setMenuRid(rid);
      const res = await fetchPublicMenuForRestaurant(rid);
      if (cancelled) return;
      if (res.ok) {
        setMenuPreview(res);
        setLocalCart([]);
        void refreshCustomerCart(rid);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, userRole, refreshCustomerCart]);

  React.useEffect(() => {
    if (!token || userRole !== "CUSTOMER" || !isServeosDemoMenuEnabled()) return;
    setMenuRid(SERVEOS_DEMO_RESTAURANT_ID);
    setMenuPreview(getServeosDemoPublicMenu());
    setLocalCart([]);
    void refreshCustomerCart(SERVEOS_DEMO_RESTAURANT_ID);
  }, [token, userRole, refreshCustomerCart]);

  async function loadPublicMenu() {
    if (!menuRid.trim()) return setStatus("Enter restaurant ID");
    setStatus("Loading…");
    const res = await fetchPublicMenuForRestaurant(menuRid.trim());
    if (!res.ok) {
      setMenuPreview(null);
      return setStatus(res.error ?? "menu_failed");
    }
    setMenuPreview(res);
    setLocalCart([]);
    setStatus("");
    void refreshCustomerCart(menuRid.trim());
    if (userRole === "CUSTOMER" && menuRid.trim()) {
      void AsyncStorage.setItem(CUSTOMER_VENUE_KEY, menuRid.trim());
    }
  }

  async function addFirstMenuItemToCart() {
    const first = menuPreview?.categories?.[0]?.items?.[0];
    if (!first) return setStatus("Load a menu first");
    if (userRole === "CUSTOMER" && token && activeRestaurantId()) {
      const rid = activeRestaurantId();
      const hadAny = customerCart.totalQuantity > 0;
      const res = await postCartAddItem({ jwt: token, restaurantId: rid, menuItemId: first.id });
      if (!res.ok) return setStatus(String((res as { error?: string }).error ?? "cart_add_failed"));
      if (res.ok) applyCustomerCartResponse(res);
      setCartFabDeferred(false);
      if (tab === "home" && hadAny) setCartFabBump((n) => n + 1);
      setStatus("Added to cart");
      return;
    }
    setLocalCart((c) => [...c, { menuItemId: first.id, quantity: 1, modifierOptionIds: [] }]);
    setStatus("Added to cart");
  }

  async function submitOrder() {
    const rid = activeRestaurantId().trim();
    if (!rid) return setStatus("Need restaurant");

    setStatus("Placing…");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    let lineIdsSnapshot: string[];

    if (userRole === "CUSTOMER" && token) {
      if (customerCart.lines.length === 0) {
        setStatus("Cart is empty");
        return;
      }
      lineIdsSnapshot = customerCart.lines.map((l) => l.menuItemId);
      setPlacingOrder(true);
      const res = await apiFetch<Record<string, unknown> & { ok?: boolean; error?: string; order?: { id?: string } }>(
        "/orders/place",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            restaurantId: rid,
            fromCart: true,
            note: orderNote.trim() ? orderNote.trim() : undefined
          })
        }
      );
      setPlacingOrder(false);
      if (!res.ok) return setStatus(res.error ?? "order_failed");
      void recordOrderedItemsForRestaurant(rid, lineIdsSnapshot);
      setMenuPrefsSeq((x) => x + 1);
      setStatus("Order placed");
      void refreshCustomerCart(rid);
      setTab("orders");
      setTrackId(res.order?.id ?? "");
      return;
    }

    if (localCart.length === 0) return setStatus("Need restaurant + cart");

    lineIdsSnapshot = localCart.map((l) => l.menuItemId);
    const res = await apiFetch<Record<string, unknown> & { ok?: boolean; error?: string; order?: { id?: string } }>("/orders/place", {
      method: "POST",
      headers,
      body: JSON.stringify({
        restaurantId: rid,
        lines: localCart.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          modifierOptionIds: l.modifierOptionIds.length ? l.modifierOptionIds : undefined
        })),
        note: orderNote || undefined
      })
    });
    if (!res.ok) return setStatus(res.error ?? "order_failed");
    void recordOrderedItemsForRestaurant(rid, lineIdsSnapshot);
    setMenuPrefsSeq((x) => x + 1);
    setStatus("Order placed");
    setLocalCart([]);
    setTab("orders");
    setTrackId(res.order?.id ?? "");
  }

  async function removeCustomerCartLine(lineId: string) {
    if (!token || userRole !== "CUSTOMER") return;
    const res = await deleteCartLine(token, lineId);
    if (!res.ok) {
      setStatus(String((res as { error?: string }).error ?? "cart_remove_failed"));
      return;
    }
    applyCustomerCartResponse(res);
    setCartFabDeferred(false);
  }

  /** Menu + from Home / Orders (+) buttons */
  async function addMenuLineFromBrowse(menuItemId: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const rid = activeRestaurantId();
    if (!menuItemId.trim()) return setStatus("Missing menu item.");

    try {
      if (userRole === "CUSTOMER" && token && rid) {
        const hadAny = customerCart.totalQuantity > 0;
        const res = await postCartAddItem({ jwt: token, restaurantId: rid, menuItemId });
        if (!res.ok) {
          setStatus(String((res as { error?: string }).error ?? "cart_add_failed"));
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
        applyCustomerCartResponse(res);
        setCartFabDeferred(false);
        setStatus("");
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (tab === "home" && hadAny) setCartFabBump((n) => n + 1);
        return;
      }

      if (userRole === "CUSTOMER" && token && !rid) {
        setStatus("Set a venue ID in Account — we need it to sync your basket.");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      setLocalCart((c) => [...c, { menuItemId, quantity: 1, modifierOptionIds: [] }]);
      setStatus("Added to cart");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "cart_add_failed";
      setStatus(msg);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function fetchTrack() {
    if (!trackId.trim()) return;
    const res = await apiFetch<Record<string, unknown> & { ok?: boolean }>(`/orders/public/${encodeURIComponent(trackId.trim())}`);
    setTrackResult(res);
  }

  async function fetchMyOrders() {
    if (!token || userRole !== "CUSTOMER") return;
    const res = await apiFetch<Record<string, unknown> & { ok?: boolean; orders?: unknown[] }>("/orders/mine", {
      headers: { Authorization: `Bearer ${token}` }
    });
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

  const customerHomeHeader = React.useMemo(() => {
    const firstName = customerDisplayName(sessionUser?.signupProfile, sessionUser?.email ?? undefined);
    const venueName =
      menuPreview?.ok && menuPreview.restaurant?.name ? String(menuPreview.restaurant.name) : null;
    return buildCustomerHomeHeader({
      firstName,
      restaurantName: venueName,
      cartCount: userRole === "CUSTOMER" ? customerCart.totalQuantity : localCart.reduce((s, l) => s + l.quantity, 0)
    });
  }, [sessionUser?.signupProfile, sessionUser?.email, menuPreview, userRole, customerCart.totalQuantity, localCart]);

  const customerScrollToMenu = React.useCallback(
    (offsetExtra = 0) => {
      customerHomeScrollRef.current?.scrollTo({
        y: Math.max(0, customerMenuTopY - 16 + offsetExtra),
        animated: true
      });
    },
    [customerMenuTopY]
  );

  const customerStartOrdering = React.useCallback(() => {
    if (menuPreview?.ok && menuPreview.restaurant) {
      customerScrollToMenu(0);
    } else {
      setTab("account");
    }
  }, [menuPreview, customerScrollToMenu]);

  const customerPopularPicks = React.useCallback(() => {
    if (menuPreview?.ok && menuPreview.restaurant) {
      customerScrollToMenu(96);
    } else {
      setTab("orders");
    }
  }, [menuPreview, customerScrollToMenu]);

  const customerHomeHasMenuBody = React.useMemo(() => {
    if (userRole !== "CUSTOMER") return false;
    if (!menuPreview?.ok || !menuPreview.categories?.length) return false;
    return buildFilteredMenuPool(menuPreview.categories as MenuCategoryLite[], "").length > 0;
  }, [userRole, menuPreview]);

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
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

  if (!sessionReady) {
    return (
      <View style={styles.sessionLoading}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.sessionHint}>Connecting…</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!token) {
    return (
      <>
        <Animated.View style={{ flex: 1, opacity: screenEnter, transform: [{ translateY: screenEnterY }] }}>
          <AuthFlowScreen onAuthed={completeAuthSession} />
        </Animated.View>
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

  const navGradient = nativeNavBoldGradient(tab as AmbientNativeTab);
  /** Home + Orders use full-width menu rails for customers only */
  const customerScreenEdgeBleed = userRole === "CUSTOMER" && (tab === "home" || tab === "orders");

  const sheetCartPanel =
    token && userRole === "CUSTOMER" && menuPreview?.ok && menuPreview.restaurant ? (
      <CartSheetPanel
        lines={customerCart.lines}
        subtotalCents={customerCart.subtotalCents}
        totalQuantity={customerCart.totalQuantity}
        money={money}
        orderNote={orderNote}
        onOrderNoteChange={setOrderNote}
        placing={placingOrder}
        onPlaceOrder={() => void submitOrder()}
        onRemoveLine={(id) => void removeCustomerCartLine(id)}
      />
    ) : null;

  return (
    <Animated.View style={[styles.shell, { opacity: screenEnter, transform: [{ translateY: screenEnterY }] }]}>
      {Platform.OS === "ios" ? <StatusBar style="dark" /> : null}
      {Platform.OS === "android" ? <RNStatusBar translucent backgroundColor="transparent" barStyle="dark-content" /> : null}

      <View style={styles.main}>
        <ScrollMeshBackground tab={tab} scrollY={scrollY} />
        {userRole === "CUSTOMER" ? (
          <FloatingTopBar
            variant="customer"
            topInset={insets.top}
            scrollY={scrollY}
            navGradient={navGradient}
            searchValue={customerSearchQuery}
            onSearchChange={setCustomerSearchQuery}
            searchPlaceholder="Search restaurants, dishes…"
            onSearchSubmit={() => {
              const q = customerSearchQuery.trim();
              if (q) setStatus(`Searching: ${q}`);
            }}
            onMenu={() => setStatus("menu")}
          />
        ) : (
          <FloatingTopBar
            topInset={insets.top}
            scrollY={scrollY}
            navGradient={navGradient}
            leftLabel={leftLabel}
            centerTitle={pageTitle}
            notificationCount={0}
            onLeftPress={() => setTab("account")}
            onSearch={() => setStatus("search")}
            onNotifications={() => setStatus("notifications")}
            onMenu={() => setStatus("menu")}
          />
        )}
        {tab === "home" && (
          <Animated.ScrollView
            ref={userRole === "CUSTOMER" ? (customerHomeScrollRef as React.RefObject<any>) : undefined}
            style={styles.scrollLayer}
            onScroll={onScroll}
            scrollEventThrottle={16}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              customerScreenEdgeBleed ? styles.scrollPadHomeBleed : styles.scrollPad,
              { paddingTop: scrollTopPad, paddingBottom: scrollBottom }
            ]}
            showsVerticalScrollIndicator={false}
          >
            {userRole === "CUSTOMER" ? (
              <>
                <View style={styles.customerHomeCopyInset}>
                  <Text style={styles.customerHeroGreeting}>{customerHomeHeader.greeting}</Text>
                  <Text style={styles.customerHeroSub}>{customerHomeHeader.sub}</Text>
                  <View style={styles.customerCtaColumn}>
                    <Pressable style={({ pressed }) => [styles.pillPrimary, styles.customerPrimaryCta, pressed && styles.pressed]} onPress={customerStartOrdering}>
                      <Text style={styles.pillPrimaryText}>{menuPreview?.ok && menuPreview.restaurant ? "Start ordering" : "Choose venue"}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [pressed && styles.pressed, { alignSelf: "center" }]}
                      onPress={customerPopularPicks}
                    >
                      <Text style={styles.customerSecondaryCta}>{menuPreview?.ok && menuPreview.restaurant ? "Popular picks" : "Load menu in Orders"}</Text>
                    </Pressable>
                  </View>

                  {customerHomeHasMenuBody ? (
                    <Text style={[styles.sectionLabel, styles.mtSm]}>Menu</Text>
                  ) : null}
                </View>
                {menuPreview?.ok && menuPreview.restaurant ? (
                  <View onLayout={(e) => setCustomerMenuTopY(e.nativeEvent.layout.y)}>
                    <CustomerMenuBrowsing
                      key={`menu-${String(menuPreview.restaurant.id)}`}
                      menuPreview={{
                        ok: true,
                        restaurant: menuPreview.restaurant,
                        categories: menuPreview.categories ?? []
                      }}
                      money={money}
                      restaurantId={String(menuPreview.restaurant.id)}
                      filterQuery={userRole === "CUSTOMER" ? customerSearchQuery : ""}
                      prefsVersion={menuPrefsSeq}
                      edgeToEdge
                      onAddItem={(it) => void addMenuLineFromBrowse(it.id)}
                    />
                  </View>
                ) : (
                  <View style={styles.customerHomeCopyInset}>
                    <View style={[styles.cardShell, styles.surfaceCard]}>
                      <Text style={styles.cardBodyMuted}>
                        Set your go-to venue in Account and we will load dishes here so ordering is one scroll away.
                      </Text>
                    </View>
                  </View>
                )}

                {status ? (
                  <View style={styles.customerHomeCopyInset}>
                    <Text style={styles.banner}>{status}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
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
                    <Pressable style={({ pressed }) => [styles.pillGhost, pressed && styles.pressed]} onPress={() => setTab("account")}>
                      <Text style={styles.pillGhostText}>Account</Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Quick actions</Text>
                <View style={styles.tileRow}>
                  <Pressable style={({ pressed }) => [styles.cardShell, styles.tile, pressed && styles.pressed]} onPress={() => setTab("account")}>
                    <Text style={styles.tileEmoji}>✦</Text>
                    <Text style={styles.tileTitle}>Venues</Text>
                    <Text style={styles.tileSub}>Manage your restaurants</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.cardShell, styles.tile, pressed && styles.pressed]} onPress={() => setTab("orders")}>
                    <Text style={styles.tileEmoji}>◎</Text>
                    <Text style={styles.tileTitle}>Track order</Text>
                    <Text style={styles.tileSub}>Status without login</Text>
                  </Pressable>
                </View>

                {status ? <Text style={styles.banner}>{status}</Text> : null}
              </>
            )}
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
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              customerScreenEdgeBleed ? styles.scrollPadHomeBleed : styles.scrollPad,
              { paddingTop: scrollTopPad, paddingBottom: scrollBottom }
            ]}
            showsVerticalScrollIndicator={false}
          >
            {userRole === "CUSTOMER" ? (
              <>
                <View style={styles.customerHomeCopyInset}>
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
                </View>

                {menuPreview?.ok && menuPreview.restaurant ? (
                  <CustomerMenuBrowsing
                    key={`menu-${String(menuPreview.restaurant.id)}`}
                    menuPreview={{
                      ok: true,
                      restaurant: menuPreview.restaurant,
                      categories: menuPreview.categories ?? []
                    }}
                    money={money}
                    restaurantId={String(menuPreview.restaurant.id)}
                    filterQuery={customerSearchQuery}
                    prefsVersion={menuPrefsSeq}
                    edgeToEdge
                    onAddItem={(it) => void addMenuLineFromBrowse(it.id)}
                  />
                ) : null}

                <View style={styles.customerHomeCopyInset}>
                  <View style={[styles.cardShell, styles.surfaceCard]}>
                    <Text style={styles.sectionLabelSmall}>Basket</Text>
                    <Text style={styles.cardBodyMuted}>
                      {customerCart.totalQuantity > 0
                        ? `Cart · ${customerCart.totalQuantity} item(s) · ${money(customerCart.subtotalCents)}. Checkout from the cart shortcut on Home or by expanding the navigation sheet above the tabs.`
                        : "Anything you tap + on saves to your account cart. Checkout appears in that bottom sheet when you are ready."}
                    </Text>
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
                </View>
              </>
            ) : (
              <>
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
                  <CustomerMenuBrowsing
                    key={`menu-${String(menuPreview.restaurant.id)}`}
                    menuPreview={{
                      ok: true,
                      restaurant: menuPreview.restaurant,
                      categories: menuPreview.categories ?? []
                    }}
                    money={money}
                    restaurantId={String(menuPreview.restaurant.id)}
                    filterQuery=""
                    prefsVersion={menuPrefsSeq}
                    onAddItem={(it) => void addMenuLineFromBrowse(it.id)}
                  />
                ) : null}

                <View style={[styles.cardShell, styles.fieldCard]}>
                  <Text style={styles.inputLabel}>Cart · {localCart.length} line(s)</Text>
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
              </>
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
            <Text style={styles.pageSub}>
              {userRole === "CUSTOMER" ? "Your go-to venue, session, and preferences." : "Venues, session, and business tools."}
            </Text>

            {userRole === "CUSTOMER" ? (
              <View style={[styles.cardShell, styles.fieldCard]}>
                <Text style={styles.sectionLabelSmall}>Your go-to venue</Text>
                <Text style={styles.cardBodyMuted}>
                  Paste the restaurant ID for the place you order from most. We will remember it on this device for your home
                  menu.
                </Text>
                <Text style={[styles.inputLabel, styles.mtSm]}>Restaurant ID</Text>
                <TextInput
                  value={menuRid}
                  onChangeText={setMenuRid}
                  placeholder="Paste venue ID"
                  placeholderTextColor={R.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                />
                <Pressable
                  style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed]}
                  onPress={async () => {
                    const id = menuRid.trim();
                    if (!id) return setStatus("Enter a restaurant ID");
                    await AsyncStorage.setItem(CUSTOMER_VENUE_KEY, id);
                    await loadPublicMenu();
                  }}
                >
                  <Text style={styles.pillPrimaryText}>Save & load menu</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={[styles.cardShell, styles.fieldCard]}>
                  <Text style={styles.inputLabel}>Add another venue (same company)</Text>
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
                      const companyId = restaurants.map((r) => r.companyId).find((x) => typeof x === "string" && x.length > 0);
                      const res = await apiFetch<Record<string, unknown> & { ok?: boolean; error?: string }>("/restaurants/restaurants", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                          name: restaurantName.trim(),
                          ...(companyId ? { companyId } : {})
                        })
                      });
                      if (!res.ok) return setStatus(res.error ?? "create_failed");
                      await refreshRestaurants(token);
                      setStatus("Venue created");
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
              </>
            )}

            <View style={[styles.cardShell, styles.fieldCard]}>
              <Text style={styles.inputLabel}>API</Text>
              <Text style={styles.mono}>{API_URL}</Text>
              <Pressable
                style={({ pressed }) => [styles.pillGhost, styles.mtSm, pressed && styles.pressed]}
                onPress={async () => {
                  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
                  await AsyncStorage.removeItem(CUSTOMER_VENUE_KEY);
                  setToken(null);
                  setUserRole(null);
                  setSessionUser(null);
                  setRestaurants([]);
                  setMyOrders([]);
                }}
              >
                <Text style={styles.pillGhostText}>Sign out</Text>
              </Pressable>
            </View>
          </Animated.ScrollView>
        )}
      </View>

      <TopNavContentDimmer scrollY={scrollY} topInset={insets.top} />

      <BottomNavContentDimmer scrollY={scrollY} bottomInset={insets.bottom} />

      {token && userRole === "CUSTOMER" && tab === "home" ? (
        <View style={styles.cartFabPortal} pointerEvents="box-none">
          <CartFABPopup
            active={customerCart.totalQuantity > 0 && !cartFabDeferred}
            bumpKey={cartFabBump}
            totalQuantity={customerCart.totalQuantity}
            bottomOffset={insets.bottom + FLOAT_MARGIN_BOTTOM + FLOATING_TAB_BAR_HEIGHT + 12}
            rightOffset={FLOAT_MARGIN_SIDE + 4}
            onOpenCart={openCartSheetHalf}
          />
        </View>
      ) : null}

      <FloatingGlassTabBar
        tab={tab}
        onChange={setTab}
        insets={insets}
        sheetHeightSV={sheetHeightSV}
        sheetContent={sheetCartPanel ?? undefined}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cartFabPortal: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 13,
    elevation: 0
  },
  splashOnly: { flex: 1, backgroundColor: "#8B5CF6" },
  sessionLoading: { flex: 1, backgroundColor: "#8B5CF6", alignItems: "center", justifyContent: "center" },
  sessionHint: { marginTop: 16, textAlign: "center", color: "rgba(255,255,255,0.88)", fontSize: 14, fontWeight: "600" },
  shell: { flex: 1, backgroundColor: "transparent" },
  main: { flex: 1, position: "relative" },
  scrollLayer: { flex: 1, zIndex: 1 },
  scrollPad: { paddingHorizontal: R.space.sm },
  /** Customer home: menu carousels + grids bleed to screen edges */
  scrollPadHomeBleed: { paddingHorizontal: 0 },
  customerHomeCopyInset: { paddingHorizontal: R.space.sm },

  customerHeroGreeting: {
    fontSize: 26,
    fontWeight: "800",
    color: R.text,
    letterSpacing: -0.35,
    lineHeight: 32
  },
  customerHeroSub: {
    fontSize: R.type.body,
    color: R.textSecondary,
    marginTop: R.space.sm,
    lineHeight: 22,
    fontWeight: "500"
  },
  customerCtaColumn: {
    marginTop: R.space.md,
    alignItems: "stretch",
    gap: R.space.sm
  },
  customerPrimaryCta: { alignSelf: "stretch" },
  customerSecondaryCta: {
    textAlign: "center",
    fontSize: R.type.label,
    fontWeight: "700",
    color: R.accentPurple,
    paddingVertical: 8
  },

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

});
