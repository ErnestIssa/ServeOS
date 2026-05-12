import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { nativeNavBoldGradient, type AmbientNativeTab } from "@serveos/core-ambient/themes";
import { ServeOSBrandScreenNative } from "@serveos/core-loading-native";
import React from "react";
import {
  Animated,
  DevSettings,
  Dimensions,
  Keyboard,
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
import { Easing, runOnJS, useAnimatedReaction, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { ScrollMeshBackground } from "./src/ambient/ScrollMeshBackground";
import { apiFetch, apiHttpToWsBase, authMe, API_URL, type AuthUser } from "./src/api";
import { CustomerOrdersVenueScreen } from "./src/customer/CustomerOrdersVenueScreen";
import { AuthFlowScreen } from "./src/auth/AuthFlowScreen";
import { deleteCartLine, fetchCustomerCart, patchCartLineQuantity, postCartAddItem, type CartLineApi } from "./src/customer/cartApi";
import { playCartAddCue } from "./src/customer/cartCueSound";
import { CartFABPopup } from "./src/customer/CartFABPopup";
import { CartSheetPanel } from "./src/customer/CartSheetPanel";
import { CustomerNavSearchSheet } from "./src/customer/CustomerNavSearchSheet";
import { appendNavSearchRecent } from "./src/customer/navSearchRecentStorage";
import { NutritionInfoModal } from "./src/customer/NutritionInfoModal";
import { ActionModal } from "./src/components/ActionModal";
import { SwapColorFullscreenLoader } from "./src/components/SwapColorLoader";
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

/** Customer search opens the nav sheet with this timing — slower than drag/snapped springs. */
const SEARCH_SHEET_OPEN_MS = 920;

/** iOS: swipe keyboard down; Android: drag scroll to dismiss. */
const SCROLL_KEYBOARD_DISMISS_MODE = Platform.OS === "ios" ? ("interactive" as const) : ("on-drag" as const);

export default function App() {
  const insets = useSafeAreaInsets();

  const [showSplash, setShowSplash] = React.useState(true);
  const [appReady, setAppReady] = React.useState(false);
  const [sessionReady, setSessionReady] = React.useState(false);
  const screenEnter = React.useRef(new Animated.Value(0)).current; // content enter opacity
  const screenEnterY = React.useRef(new Animated.Value(18)).current;
  const [tab, setTab] = React.useState<TabId>("home");
  const tabRef = React.useRef<TabId>(tab);
  tabRef.current = tab;

  const [token, setToken] = React.useState<string | null>(null);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [sessionUser, setSessionUser] = React.useState<AuthUser | null>(null);

  /** JWT + profile can disagree briefly; cart API gate uses this (not UI role alone). */
  const isCustomerSession = React.useMemo(
    () => String(sessionUser?.role ?? userRole ?? "").toUpperCase() === "CUSTOMER",
    [sessionUser?.role, userRole]
  );

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
  const [pendingAddsCount, setPendingAddsCount] = React.useState(0);
  const [addingById, setAddingById] = React.useState<Record<string, boolean>>({});
  const [optimisticCartQty, setOptimisticCartQty] = React.useState(0);

  const [actionModal, setActionModal] = React.useState<{
    visible: boolean;
    title: string;
    message: string;
    primaryLabel: string;
    onPrimary: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    primaryLabel: "OK",
    onPrimary: () => {}
  });

  const lastAddAttemptRef = React.useRef<null | { menuItemId: string }>(null);
  const [nutritionOpen, setNutritionOpen] = React.useState(false);
  const [nutritionPendingOpen, setNutritionPendingOpen] = React.useState(false);
  const nutritionPendingOpenSV = useSharedValue(0);

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

  /**
   * Cart UI in the nav sheet is shown only after:
   * - cart FAB on Home, or
   * - user drag-opens from collapsed on Home (see `onSheetDragOpenFromCollapsed`).
   * Cleared when sheet fully collapses or search programmatically opens the sheet.
   */
  const [homeNavSheetCartEligible, setHomeNavSheetCartEligible] = React.useState(false);
  /** True from search-bar open until sheet fully closes or cart sheet takes over — drives full-only sheet snap + early mount. */
  const [navSheetSearchMode, setNavSheetSearchMode] = React.useState(false);

  const applyCustomerCartResponse = React.useCallback(
    (body: { lines: CartLineApi[]; subtotalCents: number; totalQuantity: number }) => {
      setCustomerCart({
        lines: body.lines,
        subtotalCents: body.subtotalCents,
        totalQuantity: body.totalQuantity
      });
      setOptimisticCartQty(body.totalQuantity);
    },
    []
  );

  const refreshCustomerCart = React.useCallback(
    async (restaurantId: string) => {
      const t = token;
      if (!t || !isCustomerSession || !restaurantId.trim()) return;
      const res = await fetchCustomerCart(restaurantId.trim(), t);
      if (res.ok) applyCustomerCartResponse(res);
    },
    [token, isCustomerSession, applyCustomerCartResponse]
  );

  const openCartSheetHalf = React.useCallback(() => {
    if (tabRef.current !== "home") setTab("home");
    setNavSheetSearchMode(false);
    setHomeNavSheetCartEligible(true);
    const { snapMid } = computeNavSheetSnapDims(Dimensions.get("window").height, insets);
    sheetHeightSV.value = withSpring(snapMid + 3, SHEET_SPRING_CONFIG);
    setCartFabDeferred(true);
  }, [insets, sheetHeightSV]);

  const onSheetDragOpenFromCollapsed = React.useCallback(() => {
    if (tabRef.current !== "home") return;
    setNavSheetSearchMode(false);
    setHomeNavSheetCartEligible(true);
  }, []);

  /** Customer top search: first taps expand nav sheet to full without raising the keyboard. */
  const expandCustomerNavSheetFullFromSearch = React.useCallback(() => {
    Keyboard.dismiss();
    setCustomerSearchQuery("");
    setHomeNavSheetCartEligible(false);
    setNavSheetSearchMode(true);
    const { snapHigh } = computeNavSheetSnapDims(Dimensions.get("window").height, insets);
    sheetHeightSV.value = withTiming(snapHigh, {
      duration: SEARCH_SHEET_OPEN_MS,
      easing: Easing.inOut(Easing.cubic)
    });
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
      if (h > 56) runOnJS(setCartFabDeferred)(true);
    },
    []
  );

  const [sheetBackdropActive, setSheetBackdropActive] = React.useState(false);
  const [sheetOpenStage, setSheetOpenStage] = React.useState<0 | 1 | 2>(0);
  const { snapMid: snapMidNow, snapHigh: snapHighNow } = React.useMemo(
    () => computeNavSheetSnapDims(Dimensions.get("window").height, insets),
    [insets.top, insets.bottom]
  );
  useAnimatedReaction(
    () => sheetHeightSV.value,
    (h, prevH) => {
      if (h > 12) runOnJS(setSheetBackdropActive)(true);
      if (h <= 12) {
        runOnJS(setSheetBackdropActive)(false);
        /** Only clear cart eligibility when the sheet actually collapses (was above 12). Otherwise FAB/search springs start at h≈0 and would wipe eligibility before the sheet grows. */
        if (typeof prevH === "number" && prevH > 12) {
          runOnJS(setHomeNavSheetCartEligible)(false);
          runOnJS(setNavSheetSearchMode)(false);
        }
      }

      // 0 = closed-ish, 1 = half-ish, 2 = full-ish
      const fullish = h >= snapHighNow * 0.86;
      const halfish = h >= snapMidNow * 0.82;
      const stage: 0 | 1 | 2 = fullish ? 2 : halfish ? 1 : 0;
      const p = typeof prevH === "number" ? prevH : 0;
      const prevStage: 0 | 1 | 2 = p >= snapHighNow * 0.86 ? 2 : p >= snapMidNow * 0.82 ? 1 : 0;
      if (stage !== prevStage) runOnJS(setSheetOpenStage)(stage);
    },
    [snapMidNow, snapHighNow]
  );

  const closeSheetFromBackdrop = React.useCallback(() => {
    const { snapMid, snapHigh } = computeNavSheetSnapDims(Dimensions.get("window").height, insets);
    const cur = sheetHeightSV.value;
    /** Cart panel open — allow half-dismiss. Search / discovery uses full-only snapping via `sheetFullOnly`. */
    if (!homeNavSheetCartEligible) {
      sheetHeightSV.value = withTiming(0, { duration: 520, easing: Easing.inOut(Easing.cubic) });
      return;
    }
    const target = cur >= snapHigh * 0.86 ? snapMid : 0;
    sheetHeightSV.value = withSpring(target, { ...SHEET_SPRING_CONFIG, damping: 28, stiffness: 320, mass: 0.7 });
  }, [insets, sheetHeightSV, homeNavSheetCartEligible]);

  const openNutritionAfterFullSheet = React.useCallback(() => {
    const { snapHigh } = computeNavSheetSnapDims(Dimensions.get("window").height, insets);
    const cur = sheetHeightSV.value;
    if (cur >= snapHigh * 0.9) {
      setNutritionOpen(true);
      return;
    }
    setNutritionPendingOpen(true);
    nutritionPendingOpenSV.value = 1;
    sheetHeightSV.value = withSpring(snapHigh, { ...SHEET_SPRING_CONFIG, damping: 26, stiffness: 360, mass: 0.62 });
  }, [insets, sheetHeightSV, nutritionPendingOpenSV]);

  const requestKitchenNoteFocus = React.useCallback(() => {
    const { snapHigh } = computeNavSheetSnapDims(Dimensions.get("window").height, insets);
    const cur = sheetHeightSV.value;
    if (cur >= snapHigh * 0.9) return;
    sheetHeightSV.value = withSpring(snapHigh, { ...SHEET_SPRING_CONFIG, damping: 26, stiffness: 360, mass: 0.62 });
  }, [insets, sheetHeightSV]);

  useAnimatedReaction(
    () => sheetHeightSV.value,
    (h) => {
      if (nutritionPendingOpenSV.value < 0.5) return;
      if (h >= snapHighNow * 0.9) {
        nutritionPendingOpenSV.value = 0;
        runOnJS(setNutritionPendingOpen)(false);
        runOnJS(setNutritionOpen)(true);
      }
    },
    [snapHighNow]
  );

  React.useEffect(() => {
    scrollY.setValue(0);
  }, [tab, scrollY]);

  React.useEffect(() => {
    if (tab !== "home") setNavSheetSearchMode(false);
  }, [tab]);

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
      const serverPref =
        typeof sessionUser?.preferredRestaurantId === "string"
          ? sessionUser.preferredRestaurantId.trim()
          : "";
      const local = ((await AsyncStorage.getItem(CUSTOMER_VENUE_KEY)) ?? "").trim();
      const rid = serverPref || local;
      if (!rid || cancelled) return;
      if (serverPref && serverPref !== local) {
        await AsyncStorage.setItem(CUSTOMER_VENUE_KEY, serverPref);
      }
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
  }, [token, userRole, sessionUser?.preferredRestaurantId, refreshCustomerCart]);

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
      const id = menuRid.trim();
      void AsyncStorage.setItem(CUSTOMER_VENUE_KEY, id);
    }
  }

  /** After PATCH on the server — refresh menus, cart, and profile snapshot (single source of truth). */
  const applyCustomerVenueChange = React.useCallback(
    async (restaurantId: string) => {
      const rid = restaurantId.trim();
      if (!rid || !token) return;
      await AsyncStorage.setItem(CUSTOMER_VENUE_KEY, rid);
      setMenuRid(rid);
      setTrackResult(null);
      setMenuPrefsSeq((x) => x + 1);
      const res = await fetchPublicMenuForRestaurant(rid);
      if (res.ok) {
        setMenuPreview(res);
        setLocalCart([]);
        setStatus("");
      } else {
        setMenuPreview(null);
        setStatus(res.error ?? "menu_failed");
      }
      await refreshCustomerCart(rid);
      const me = await authMe(token);
      if (me.ok && me.user) setSessionUser(me.user);
      if (__DEV__ && Platform.OS !== "web") {
        DevSettings.reload();
      }
    },
    [token, refreshCustomerCart]
  );

  async function addFirstMenuItemToCart() {
    const first = menuPreview?.categories?.[0]?.items?.[0];
    if (!first) return setStatus("Load a menu first");
    await addMenuLineFromBrowse(first.id);
  }

  async function submitOrder() {
    if (placingOrder) return;
    const rid = activeRestaurantId().trim();
    if (!rid) return setStatus("Need restaurant");

    const noteTrim = orderNote.trim() || undefined;

    setStatus("Placing…");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    let lineIdsSnapshot: string[];

    if (isCustomerSession && token) {
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
            note: noteTrim
          })
        }
      );
      setPlacingOrder(false);
      if (!res.ok) return setStatus(res.error ?? "order_failed");
      void recordOrderedItemsForRestaurant(rid, lineIdsSnapshot);
      setMenuPrefsSeq((x) => x + 1);
      setStatus("Order placed");
      void refreshCustomerCart(rid);
      setOrderNote("");
      setTab("orders");
      setTrackId(res.order?.id ?? "");
      return;
    }

    if (localCart.length === 0) return setStatus("Need restaurant + cart");

    lineIdsSnapshot = localCart.map((l) => l.menuItemId);
    setPlacingOrder(true);
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
        note: noteTrim
      })
    });
    setPlacingOrder(false);
    if (!res.ok) return setStatus(res.error ?? "order_failed");
    void recordOrderedItemsForRestaurant(rid, lineIdsSnapshot);
    setMenuPrefsSeq((x) => x + 1);
    setStatus("Order placed");
    setLocalCart([]);
    setOrderNote("");
    setTab("orders");
    setTrackId(res.order?.id ?? "");
  }

  async function removeCustomerCartLine(lineId: string) {
    if (!token || !isCustomerSession) return;
    const res = await deleteCartLine(token, lineId);
    if (!res.ok) {
      setStatus(String((res as { error?: string }).error ?? "cart_remove_failed"));
      return;
    }
    applyCustomerCartResponse(res);
    setCartFabDeferred(false);
  }

  async function incCustomerCartLine(lineId: string) {
    if (!token || !isCustomerSession) return;
    const cur = customerCart.lines.find((l) => l.id === lineId);
    if (!cur) return;
    applyCustomerCartResponse({
      lines: customerCart.lines.map((l) => (l.id === lineId ? { ...l, quantity: l.quantity + 1, lineTotalCents: l.unitPriceCents * (l.quantity + 1) } : l)),
      subtotalCents: customerCart.subtotalCents + cur.unitPriceCents,
      totalQuantity: customerCart.totalQuantity + 1
    });
    setOptimisticCartQty((q) => q + 1);
    const res = await patchCartLineQuantity(token, lineId, cur.quantity + 1);
    if (res.ok) applyCustomerCartResponse(res);
  }

  async function decCustomerCartLine(lineId: string) {
    if (!token || !isCustomerSession) return;
    const cur = customerCart.lines.find((l) => l.id === lineId);
    if (!cur) return;
    if (cur.quantity <= 1) return void removeCustomerCartLine(lineId);
    applyCustomerCartResponse({
      lines: customerCart.lines.map((l) => (l.id === lineId ? { ...l, quantity: l.quantity - 1, lineTotalCents: l.unitPriceCents * (l.quantity - 1) } : l)),
      subtotalCents: Math.max(0, customerCart.subtotalCents - cur.unitPriceCents),
      totalQuantity: Math.max(0, customerCart.totalQuantity - 1)
    });
    setOptimisticCartQty((q) => Math.max(0, q - 1));
    const res = await patchCartLineQuantity(token, lineId, cur.quantity - 1);
    if (res.ok) applyCustomerCartResponse(res);
  }

  function showCartErrorModal(raw: string) {
    const msg =
      raw === "missing_token"
        ? "You’re signed out. Please sign in again."
        : raw === "restaurant_required"
          ? "Pick a venue first so we know where you’re ordering from."
          : raw === "restaurant_not_found"
            ? "That venue couldn’t be found. Try choosing a different venue."
            : raw === "menu_item_not_found"
              ? "That item isn’t available right now. Try another dish."
              : raw === "modifier_count_invalid"
                ? "This item needs a quick choice (like doneness). Tap the item to customize, then add again."
                : /can’t reach|can't reach|network|timeout/i.test(raw)
                  ? "We can’t reach the server right now. Check your connection and try again."
                  : "We couldn’t add that item. Please try again.";

    setActionModal({
      visible: true,
      title: "Couldn’t add to cart",
      message: msg,
      primaryLabel: "Try again",
      onPrimary: () => {
        setActionModal((p) => ({ ...p, visible: false }));
        const last = lastAddAttemptRef.current;
        if (last?.menuItemId) void addMenuLineFromBrowse(last.menuItemId);
      },
      secondaryLabel: "Dismiss",
      onSecondary: () => setActionModal((p) => ({ ...p, visible: false }))
    });
  }

  /** Menu + from Home / Orders (+) buttons */
  async function addMenuLineFromBrowse(menuItemId: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const rid = activeRestaurantId();
    if (!menuItemId.trim()) return setStatus("Missing menu item.");

    lastAddAttemptRef.current = { menuItemId };

    // Instant UI feedback (optimistic): spinner on this card + FAB bump + sound.
    setAddingById((prev) => ({ ...prev, [menuItemId]: true }));
    setPendingAddsCount((n) => n + 1);
    setCartFabDeferred(false);
    if (tab === "home") setCartFabBump((n) => n + 1);
    void playCartAddCue();
    if (isCustomerSession) setOptimisticCartQty((q) => q + 1);

    try {
      /** Primary path: server cart. Reconcile after POST; don't block UI on GET. */
      if (token && isCustomerSession && rid) {
        const res = await postCartAddItem({ jwt: token, restaurantId: rid, menuItemId });
        if (!res.ok) {
          const err = String((res as { error?: string }).error ?? "cart_add_failed");
          setStatus(err);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          showCartErrorModal(err);
          if (isCustomerSession) setOptimisticCartQty((q) => Math.max(0, q - 1));
          return;
        }
        void refreshCustomerCart(rid);
        setStatus("");
        return;
      }

      if (token && isCustomerSession && !rid) {
        const msg = "Set your go-to venue in Account so we can sync your basket to the server.";
        setStatus(msg);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setActionModal({
          visible: true,
          title: "Choose a venue",
          message: msg,
          primaryLabel: "Go to Account",
          onPrimary: () => {
            setActionModal((p) => ({ ...p, visible: false }));
            setTab("account");
          },
          secondaryLabel: "Dismiss",
          onSecondary: () => setActionModal((p) => ({ ...p, visible: false }))
        });
        return;
      }

      setLocalCart((c) => [...c, { menuItemId, quantity: 1, modifierOptionIds: [] }]);
      setStatus("Added to cart (this device only — sign in as a diner for cloud cart).");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "cart_add_failed";
      setStatus(msg);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showCartErrorModal(msg);
      if (isCustomerSession) setOptimisticCartQty((q) => Math.max(0, q - 1));
    } finally {
      setAddingById((prev) => {
        const next = { ...prev };
        delete next[menuItemId];
        return next;
      });
      setPendingAddsCount((n) => Math.max(0, n - 1));
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
      cartCount: isCustomerSession ? customerCart.totalQuantity : localCart.reduce((s, l) => s + l.quantity, 0)
    });
  }, [
    sessionUser?.signupProfile,
    sessionUser?.email,
    menuPreview,
    isCustomerSession,
    customerCart.totalQuantity,
    localCart
  ]);

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
      setTab("orders");
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
      <>
        <SwapColorFullscreenLoader hint="Connecting…" sub="Reconnecting to ServeOS" />
        <StatusBar style="light" />
      </>
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
    token &&
    isCustomerSession &&
    tab === "home" &&
    homeNavSheetCartEligible &&
    sheetBackdropActive &&
    menuPreview?.ok &&
    menuPreview.restaurant ? (
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
        onIncLine={(id) => void incCustomerCartLine(id)}
        onDecLine={(id) => void decCustomerCartLine(id)}
        onOpenInfo={openNutritionAfterFullSheet}
        userFirstName={customerDisplayName(sessionUser?.signupProfile, sessionUser?.email ?? undefined)}
        sheetOpenStage={sheetOpenStage}
        onRequestNoteFocus={requestKitchenNoteFocus}
      />
    ) : null;

  const sheetSearchPanel =
    token &&
    isCustomerSession &&
    !homeNavSheetCartEligible &&
    (navSheetSearchMode || sheetBackdropActive) &&
    menuPreview?.ok &&
    menuPreview.restaurant ? (
      <CustomerNavSearchSheet
        restaurantId={String(menuPreview.restaurant.id)}
        categories={(menuPreview.categories ?? []) as MenuCategoryLite[]}
        money={money}
        searchQuery={customerSearchQuery}
        onSearchChange={setCustomerSearchQuery}
        onAddItem={(it) => void addMenuLineFromBrowse(it.id)}
        addingItemIds={addingById}
      />
    ) : null;

  const displayCartQty = isCustomerSession ? Math.max(0, optimisticCartQty) : Math.max(0, localCart.reduce((s, l) => s + l.quantity, 0));

  return (
    <Animated.View style={[styles.shell, { opacity: screenEnter, transform: [{ translateY: screenEnterY }] }]}>
      {Platform.OS === "ios" ? <StatusBar style="dark" /> : null}
      {Platform.OS === "android" ? <RNStatusBar translucent backgroundColor="transparent" barStyle="dark-content" /> : null}

      <View style={styles.main}>
        <ScrollMeshBackground tab={tab} scrollY={scrollY} />
        <TopNavContentDimmer scrollY={scrollY} topInset={insets.top} />
        {userRole === "CUSTOMER" ? (
          <FloatingTopBar
            variant="customer"
            topInset={insets.top}
            scrollY={scrollY}
            navGradient={navGradient}
            searchValue={customerSearchQuery}
            onSearchChange={setCustomerSearchQuery}
            searchPlaceholder="Search dishes, drinks…"
            searchSheetFullyExpanded={sheetOpenStage === 2}
            onSearchExpandSheet={expandCustomerNavSheetFullFromSearch}
            onSearchSubmit={() => void appendNavSearchRecent(customerSearchQuery.trim())}
            onMenu={() => {
              Keyboard.dismiss();
              setStatus("menu");
            }}
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
            keyboardDismissMode={SCROLL_KEYBOARD_DISMISS_MODE}
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
                      <Text style={styles.customerSecondaryCta}>{menuPreview?.ok && menuPreview.restaurant ? "Popular picks" : "Choose venue in Orders"}</Text>
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
                      filterQuery=""
                      prefsVersion={menuPrefsSeq}
                      edgeToEdge
                      addingItemIds={addingById}
                      onAddItem={(it) => void addMenuLineFromBrowse(it.id)}
                    />
                  </View>
                ) : (
                  <View style={styles.customerHomeCopyInset}>
                    <View style={[styles.cardShell, styles.surfaceCard]}>
                      <Text style={styles.cardBodyMuted}>
                        Open the Orders tab to pick your restaurant — it is saved to your account — and we’ll load dishes here.
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
            keyboardDismissMode={SCROLL_KEYBOARD_DISMISS_MODE}
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
            keyboardDismissMode={SCROLL_KEYBOARD_DISMISS_MODE}
            contentContainerStyle={[
              customerScreenEdgeBleed ? styles.scrollPadHomeBleed : styles.scrollPad,
              { paddingTop: scrollTopPad, paddingBottom: scrollBottom }
            ]}
            showsVerticalScrollIndicator={false}
          >
            {userRole === "CUSTOMER" ? (
              <CustomerOrdersVenueScreen
                token={token}
                activeId={activeRestaurantId()}
                activeName={
                  menuPreview?.ok &&
                  menuPreview.restaurant &&
                  String(menuPreview.restaurant.id).trim() === activeRestaurantId().trim()
                    ? String(menuPreview.restaurant.name ?? "")
                    : ""
                }
                demoMode={isServeosDemoMenuEnabled()}
                onVenueHydrated={applyCustomerVenueChange}
              />
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
                    addingItemIds={addingById}
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
            keyboardDismissMode={SCROLL_KEYBOARD_DISMISS_MODE}
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
            keyboardDismissMode={SCROLL_KEYBOARD_DISMISS_MODE}
            contentContainerStyle={[styles.scrollPad, { paddingTop: scrollTopPad, paddingBottom: scrollBottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.pageTitle}>Account</Text>
            <Text style={styles.pageSub}>
              {userRole === "CUSTOMER" ? "Your go-to venue, session, and preferences." : "Venues, session, and business tools."}
            </Text>

            {userRole === "CUSTOMER" ? (
              <View style={[styles.cardShell, styles.fieldCard]}>
                <Text style={styles.sectionLabelSmall}>Your restaurant</Text>
                <Text style={styles.cardBodyMuted}>
                  Venue choice is tied to your account on the server. Use the Orders tab to see every venue and switch — the app
                  then reloads menus and your cart for that place only.
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.pillPrimary, styles.mtSm, pressed && styles.pressed]}
                  onPress={() => setTab("orders")}
                >
                  <Text style={styles.pillPrimaryText}>Choose or change venue</Text>
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
        <BottomNavContentDimmer scrollY={scrollY} bottomInset={insets.bottom} />
      </View>

      {sheetBackdropActive ? (
        <Pressable
          style={styles.sheetBackdropTapClose}
          onPress={() => {
            Keyboard.dismiss();
            closeSheetFromBackdrop();
          }}
          accessibilityRole="button"
          accessibilityLabel="Close panel"
        />
      ) : null}

      {token && isCustomerSession && tab === "home" && menuPreview?.ok ? (
        <View style={styles.cartFabPortal} pointerEvents="box-none">
          <CartFABPopup
            active={displayCartQty > 0 && !cartFabDeferred && !(sheetBackdropActive && !homeNavSheetCartEligible)}
            bumpKey={cartFabBump}
            totalQuantity={displayCartQty}
            bottomOffset={insets.bottom + FLOAT_MARGIN_BOTTOM + FLOATING_TAB_BAR_HEIGHT + 12}
            rightOffset={FLOAT_MARGIN_SIDE + 4}
            onOpenCart={openCartSheetHalf}
          />
        </View>
      ) : null}

      <ActionModal
        visible={actionModal.visible}
        title={actionModal.title}
        message={actionModal.message}
        primaryLabel={actionModal.primaryLabel}
        onPrimary={actionModal.onPrimary}
        secondaryLabel={actionModal.secondaryLabel}
        onSecondary={actionModal.onSecondary}
        onDismiss={() => setActionModal((p) => ({ ...p, visible: false }))}
      />

      <NutritionInfoModal visible={nutritionOpen} onDismiss={() => setNutritionOpen(false)} />

      <FloatingGlassTabBar
        tab={tab}
        onChange={(next) => {
          Keyboard.dismiss();
          setTab(next);
        }}
        insets={insets}
        sheetHeightSV={sheetHeightSV}
        sheetContent={sheetCartPanel ?? sheetSearchPanel ?? undefined}
        onSheetDragOpenFromCollapsed={onSheetDragOpenFromCollapsed}
        sheetFullOnly={navSheetSearchMode}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheetBackdropTapClose: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 19
  },
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
