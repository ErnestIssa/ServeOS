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
import { useAppTheme } from "./src/theme/AppThemeContext";
import { apiFetch, apiHttpToWsBase, authMe, API_URL, type AuthUser } from "./src/api";
import {
  loadMyOrdersCached,
  prefetchCustomerSession,
  refreshMyOrdersSilent,
  TTL
} from "./src/data/customerDataCache";
import { authScope, myOrdersKey } from "./src/data/cache/cacheKeys";
import { cacheInvalidate, cacheWrite } from "./src/data/cache/appCache";
import { CustomerChatScreen } from "./src/customer/CustomerChatScreen";
import { fetchCustomerChatUnreadCount } from "./src/customer/customerChatApi";
import {
  ensureChatNotificationPermissions,
  notifyIncomingChatMessage,
  setChatBadgeCount
} from "./src/customer/chat/chatMessageNotification";
import {
  connectCustomerChatSocket,
  disconnectCustomerChatSocket,
  subscribeChatRelay
} from "./src/customer/chat/customerChatSocket";
import { CustomerOrdersVenueScreen } from "./src/customer/CustomerOrdersVenueScreen";
import { CustomerReservationFlow } from "./src/customer/reservations/CustomerReservationFlow";
import {
  countActiveCustomerOrders,
  isActiveOrderStatus,
  orderStatusMilestone,
  pickActiveOrder,
  type CustomerMineOrder
} from "./src/customer/CustomerOrderTrackingSection";
import { clearOrderStatusCue, syncOrderStatusCue } from "./src/customer/orderStatusCue";
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
import { bumpBrowseEngagement } from "./src/menu/menuPreferencesStorage";
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
import { CustomerMeStack } from "./src/customer/profile/CustomerMeStack";
import { loadProfileAvatarUri } from "./src/customer/profile/profileAvatarStorage";
import { CustomerNavMenuPage } from "./src/shell/CustomerNavMenuPage";
import { FloatingTopBar, FLOATING_TOP_BAR_HEIGHT } from "./src/shell/FloatingTopBar";
import { createAppStyles } from "./src/theme/createAppStyles";
import { R } from "./src/theme";

const AUTH_TOKEN_KEY = "serveos.auth.jwt";
const CUSTOMER_VENUE_KEY = "serveos.customer.preferredRestaurantId";

/** Customer search opens the nav sheet with this timing — slower than drag/snapped springs. */
const SEARCH_SHEET_OPEN_MS = 920;

/** iOS: swipe keyboard down; Android: drag scroll to dismiss. */
const SCROLL_KEYBOARD_DISMISS_MODE = Platform.OS === "ios" ? ("interactive" as const) : ("on-drag" as const);

export default function App() {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useAppTheme();
  const styles = React.useMemo(() => createAppStyles(themeColors, isDark), [themeColors, isDark]);

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
  /** Full-screen page from customer top-bar menu (hamburger); back restores prior tab/screen. */
  const [customerNavMenuOpen, setCustomerNavMenuOpen] = React.useState(false);
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
  const [ordersEmptySessionVisitCount, setOrdersEmptySessionVisitCount] = React.useState(0);
  const ordersEmptyVisitLatchRef = React.useRef(false);
  const [chatUnreadCount, setChatUnreadCount] = React.useState(0);
  const [meAvatarUri, setMeAvatarUri] = React.useState<string | null>(null);
  /** ME tab inner stack: only the hub root keeps the floating top search bar visible. */
  const [meStackAtRoot, setMeStackAtRoot] = React.useState(true);

  React.useEffect(() => {
    if (tab !== "account") setMeStackAtRoot(true);
  }, [tab]);

  const activeOrderCount = React.useMemo(() => {
    if (!isCustomerSession) return 0;
    return countActiveCustomerOrders(myOrders as CustomerMineOrder[]);
  }, [myOrders, isCustomerSession]);

  const ordersTabBadgeCount = tab === "orders" ? 0 : activeOrderCount;

  const customerVenueDisplayName =
    menuPreview?.ok && menuPreview.restaurant?.name
      ? String(menuPreview.restaurant.name)
      : restaurantName.trim() || "Your restaurant";

  React.useEffect(() => {
    if (!token || !isCustomerSession) {
      setMeAvatarUri(null);
      return;
    }
    let cancelled = false;
    void loadProfileAvatarUri().then((uri) => {
      if (!cancelled) setMeAvatarUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [token, isCustomerSession, sessionUser?.id]);

  const customerSignOut = React.useCallback(async () => {
    disconnectCustomerChatSocket();
    await cacheInvalidate(authScope(sessionUser?.id));
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(CUSTOMER_VENUE_KEY);
    setToken(null);
    setUserRole(null);
    setSessionUser(null);
    setRestaurants([]);
    setMyOrders([]);
    setMeAvatarUri(null);
    setCustomerNavMenuOpen(false);
  }, [sessionUser?.id]);

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
  const snapImpactTargetSV = useSharedValue(-1);
  const snapImpactArmedSV = useSharedValue(0);

  const armNavSheetSnapImpact = React.useCallback(
    (target: number) => {
      snapImpactTargetSV.value = target;
      snapImpactArmedSV.value = 1;
    },
    [snapImpactArmedSV, snapImpactTargetSV]
  );

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
    armNavSheetSnapImpact(snapMid + 3);
    sheetHeightSV.value = withSpring(snapMid + 3, SHEET_SPRING_CONFIG);
    setCartFabDeferred(true);
  }, [insets, sheetHeightSV, armNavSheetSnapImpact]);

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
    armNavSheetSnapImpact(snapHigh);
    sheetHeightSV.value = withTiming(snapHigh, {
      duration: SEARCH_SHEET_OPEN_MS,
      easing: Easing.inOut(Easing.cubic)
    });
  }, [insets, sheetHeightSV, armNavSheetSnapImpact]);

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
      armNavSheetSnapImpact(0);
      sheetHeightSV.value = withTiming(0, { duration: 520, easing: Easing.inOut(Easing.cubic) });
      return;
    }
    const target = cur >= snapHigh * 0.86 ? snapMid : 0;
    armNavSheetSnapImpact(target);
    sheetHeightSV.value = withSpring(target, { ...SHEET_SPRING_CONFIG, damping: 28, stiffness: 320, mass: 0.7 });
  }, [insets, sheetHeightSV, homeNavSheetCartEligible, armNavSheetSnapImpact]);

  const openNutritionAfterFullSheet = React.useCallback(() => {
    const { snapHigh } = computeNavSheetSnapDims(Dimensions.get("window").height, insets);
    const cur = sheetHeightSV.value;
    if (cur >= snapHigh * 0.9) {
      setNutritionOpen(true);
      return;
    }
    setNutritionPendingOpen(true);
    nutritionPendingOpenSV.value = 1;
    armNavSheetSnapImpact(snapHigh);
    sheetHeightSV.value = withSpring(snapHigh, { ...SHEET_SPRING_CONFIG, damping: 26, stiffness: 360, mass: 0.62 });
  }, [insets, sheetHeightSV, nutritionPendingOpenSV, armNavSheetSnapImpact]);

  const requestKitchenNoteFocus = React.useCallback(() => {
    const { snapHigh } = computeNavSheetSnapDims(Dimensions.get("window").height, insets);
    const cur = sheetHeightSV.value;
    if (cur >= snapHigh * 0.9) return;
    armNavSheetSnapImpact(snapHigh);
    sheetHeightSV.value = withSpring(snapHigh, { ...SHEET_SPRING_CONFIG, damping: 26, stiffness: 360, mass: 0.62 });
  }, [insets, sheetHeightSV, armNavSheetSnapImpact]);

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
    const orders = ordersRes.orders ?? [];
    setMyOrders(orders);
    await cacheWrite(myOrdersKey(authScope(me.user.id)), orders, TTL.myOrders);
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
    if (!token || !isCustomerSession || isServeosDemoMenuEnabled()) return;
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
  }, [token, isCustomerSession, sessionUser?.preferredRestaurantId, refreshCustomerCart]);

  React.useEffect(() => {
    if (!token || !isCustomerSession || !isServeosDemoMenuEnabled()) return;
    setMenuRid(SERVEOS_DEMO_RESTAURANT_ID);
    setMenuPreview(getServeosDemoPublicMenu());
    setLocalCart([]);
    void refreshCustomerCart(SERVEOS_DEMO_RESTAURANT_ID);
  }, [token, isCustomerSession, refreshCustomerCart]);

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
    if (isCustomerSession && menuRid.trim()) {
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
      const placed = res.order as {
        id?: string;
        status?: string;
        totalCents?: number;
        lines?: Array<{ name: string; quantity: number; lineTotalCents: number }>;
      };
      const venueName =
        menuPreview?.ok && String(menuPreview.restaurant?.id ?? "").trim() === rid
          ? String(menuPreview.restaurant?.name ?? "")
          : "";
      if (placed?.id) {
        setMyOrders((prev: any[]) => {
          if (prev.some((o) => o?.id === placed.id)) return prev;
          return [
            {
              id: placed.id,
              restaurant: { id: rid, name: venueName || "Restaurant" },
              status: String(placed.status ?? "PENDING"),
              totalCents: Number(placed.totalCents ?? 0),
              lines: (placed.lines ?? []).map((l) => ({
                name: l.name,
                quantity: l.quantity,
                lineTotalCents: l.lineTotalCents
              }))
            },
            ...prev
          ];
        });
      }
      void recordOrderedItemsForRestaurant(rid, lineIdsSnapshot);
      setMenuPrefsSeq((x) => x + 1);
      setStatus("Order placed");
      void refreshCustomerCart(rid);
      setOrderNote("");
      await fetchMyOrders();
      setTab("orders");
      setTrackId(placed.id ?? "");
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
        void bumpBrowseEngagement(rid).then(() => {
          setMenuPrefsSeq((s) => s + 1);
        });
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

  const fetchMyOrders = React.useCallback(
    async (opts?: { force?: boolean }) => {
      if (!token || !isCustomerSession) return;
      try {
        const orders = await loadMyOrdersCached(token, sessionUser?.id, (cached) => setMyOrders(cached as CustomerMineOrder[]), {
          force: opts?.force
        });
        setMyOrders(orders as CustomerMineOrder[]);
      } catch {
        /* Keep last cached list visible. */
      }
    },
    [token, isCustomerSession, sessionUser?.id]
  );

  React.useEffect(() => {
    if (tab === "orders" && token && isCustomerSession) void fetchMyOrders();
  }, [tab, token, isCustomerSession, fetchMyOrders]);

  React.useEffect(() => {
    if (!isCustomerSession) return;
    const list = myOrders as CustomerMineOrder[];
    for (const o of list) {
      if (!isActiveOrderStatus(o.status)) {
        clearOrderStatusCue(o.id);
        continue;
      }
      syncOrderStatusCue(o.id, orderStatusMilestone(o.status));
    }
  }, [myOrders, isCustomerSession]);

  React.useEffect(() => {
    if (!token || !isCustomerSession) return;
    const rid = activeRestaurantId().trim();
    if (!rid) return;
    prefetchCustomerSession(token, sessionUser?.id, rid, {
      onOrders: (orders) => setMyOrders(orders as CustomerMineOrder[])
    });
  }, [token, isCustomerSession, sessionUser?.id, menuRid, sessionUser?.preferredRestaurantId, activeRestaurantId]);

  React.useEffect(() => {
    if (tab === "messages" && token && isCustomerSession) {
      refreshMyOrdersSilent(token, sessionUser?.id, (orders) => setMyOrders(orders as CustomerMineOrder[]));
    }
  }, [tab, token, isCustomerSession, sessionUser?.id]);

  const refreshChatUnreadCount = React.useCallback(async () => {
    if (!token || !isCustomerSession) return;
    const res = await fetchCustomerChatUnreadCount(token);
    if (res.ok && typeof res.unreadCount === "number") {
      setChatUnreadCount(res.unreadCount);
      void setChatBadgeCount(res.unreadCount);
    }
  }, [token, isCustomerSession]);

  React.useEffect(() => {
    if (!token || !isCustomerSession) {
      setChatUnreadCount(0);
      void setChatBadgeCount(0);
      disconnectCustomerChatSocket();
      return;
    }
    void ensureChatNotificationPermissions();
    connectCustomerChatSocket(token);
    void refreshChatUnreadCount();
    const poll = setInterval(() => void refreshChatUnreadCount(), 45_000);
    return () => {
      clearInterval(poll);
      disconnectCustomerChatSocket();
    };
  }, [token, isCustomerSession, refreshChatUnreadCount]);

  React.useEffect(() => {
    if (!token || !isCustomerSession) return;
    const off = subscribeChatRelay((payload) => {
      if (payload.type !== "new_message") return;
      if (payload.message.senderRole === "CUSTOMER") return;
      void refreshChatUnreadCount();
      if (tabRef.current !== "messages") {
        const name = restaurantName.trim() || "Restaurant";
        const preview = payload.message.content?.trim() || "New message";
        void notifyIncomingChatMessage(name, preview);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
    return off;
  }, [token, isCustomerSession, refreshChatUnreadCount, restaurantName]);

  React.useEffect(() => {
    const emptyCustomerOrders =
      tab === "orders" &&
      token &&
      isCustomerSession &&
      !pickActiveOrder(myOrders as CustomerMineOrder[], activeRestaurantId().trim());
    if (emptyCustomerOrders) {
      if (!ordersEmptyVisitLatchRef.current) {
        setOrdersEmptySessionVisitCount((n) => n + 1);
        ordersEmptyVisitLatchRef.current = true;
      }
    } else {
      ordersEmptyVisitLatchRef.current = false;
    }
  }, [tab, token, isCustomerSession, myOrders, activeRestaurantId]);

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
    if (!token || !isCustomerSession) return;
    const url = `${apiHttpToWsBase(API_URL)}/orders/events?${new URLSearchParams({ mine: "1", token }).toString()}`;
    const ws = new WebSocket(url);
    ws.onmessage = () => {
      void fetchMyOrders({ force: true });
    };
    return () => ws.close();
  }, [token, isCustomerSession, API_URL, fetchMyOrders]);

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
    if (!isCustomerSession) return false;
    if (!menuPreview?.ok || !menuPreview.categories?.length) return false;
    return buildFilteredMenuPool(menuPreview.categories as MenuCategoryLite[], "").length > 0;
  }, [isCustomerSession, menuPreview]);

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
  const meCompactTopPad = insets.top + 8;
  const hideCustomerTopNav = isCustomerSession && tab === "account" && !meStackAtRoot;

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
  /** Home only: full-width menu rails. Orders keeps normal horizontal padding so layout matches other tabs. */
  const customerScreenEdgeBleed = isCustomerSession && tab === "home";
  /** Empty Orders: pause cart bounce + CTA rotation while customer search sheet is open. */
  const ordersEmptyMotionPaused =
    tab === "orders" && isCustomerSession && (navSheetSearchMode || sheetBackdropActive);

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
      {Platform.OS === "ios" ? <StatusBar style={isDark ? "light" : "dark"} /> : null}
      {Platform.OS === "android" ? (
        <RNStatusBar translucent backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />
      ) : null}

      <View style={styles.main}>
        <ScrollMeshBackground tab={tab} scrollY={scrollY} />
        {!hideCustomerTopNav ? <TopNavContentDimmer scrollY={scrollY} topInset={insets.top} /> : null}
        {isCustomerSession ? (
          !hideCustomerTopNav ? (
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
              if (sheetBackdropActive) closeSheetFromBackdrop();
              setCustomerNavMenuOpen(true);
            }}
          />
          ) : null
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
            ref={isCustomerSession ? (customerHomeScrollRef as React.RefObject<any>) : undefined}
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
            {isCustomerSession ? (
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
                      <Text style={styles.customerSecondaryCta}>
                        {menuPreview?.ok && menuPreview.restaurant ? "Popular picks" : "Choose venue in Orders"}
                      </Text>
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
                      onMenuEngagement={() => setMenuPrefsSeq((s) => s + 1)}
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

        {tab === "bookings" && token && isCustomerSession ? (
          <CustomerReservationFlow
            restaurantId={activeRestaurantId()}
            restaurantName={
              menuPreview?.ok && menuPreview.restaurant?.name
                ? String(menuPreview.restaurant.name)
                : restaurantName.trim() || "Your restaurant"
            }
            userDisplayName={customerDisplayName(sessionUser?.signupProfile, sessionUser?.email ?? undefined)}
            hasVenue={Boolean(activeRestaurantId().trim())}
            authToken={token}
            scrollY={scrollY}
            onScroll={onScroll}
            scrollTopPad={scrollTopPad}
            scrollBottom={scrollBottom}
            onChooseVenue={() => setTab("orders")}
            onOpenChat={() => setTab("messages")}
            onExitToHome={() => setTab("home")}
          />
        ) : tab === "bookings" ? (
          <Animated.ScrollView
            style={styles.scrollLayer}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardDismissMode={SCROLL_KEYBOARD_DISMISS_MODE}
            contentContainerStyle={[styles.scrollPad, { paddingTop: scrollTopPad, paddingBottom: scrollBottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.pageTitle}>Bookings</Text>
            <Text style={styles.pageSub}>Reserve tables and manage upcoming visits — staff & owner tools.</Text>
            <View style={[styles.cardShell, styles.surfaceCard]}>
              <View style={styles.premiumBadgeRow}>
                <Text style={styles.premiumBadge}>Staff</Text>
              </View>
              <Text style={styles.cardHeadline}>Table & event bookings</Text>
              <Text style={styles.cardBodyMuted}>
                Reservation list, walk-ins, and capacity rules live in the web admin and staff workflows. Customer booking
                uses the Book tab when signed in as a guest.
              </Text>
            </View>
          </Animated.ScrollView>
        ) : null}

        {tab === "orders" &&
          token &&
          isCustomerSession &&
          !pickActiveOrder(myOrders as CustomerMineOrder[], activeRestaurantId().trim()) ? (
          <Animated.View
            style={[
              styles.scrollLayer,
              customerScreenEdgeBleed ? styles.scrollPadHomeBleed : styles.scrollPad,
              { paddingTop: scrollTopPad, paddingBottom: scrollBottom }
            ]}
          >
            <CustomerOrdersVenueScreen
              token={token}
              userId={sessionUser?.id}
              userDisplayName={customerDisplayName(sessionUser?.signupProfile, sessionUser?.email ?? undefined)}
              activeId={activeRestaurantId()}
              activeName={
                menuPreview?.ok &&
                menuPreview.restaurant &&
                String(menuPreview.restaurant.id).trim() === activeRestaurantId().trim()
                  ? String(menuPreview.restaurant.name ?? "")
                  : ""
              }
              venueSwitchLocked={isServeosDemoMenuEnabled()}
              onVenueHydrated={applyCustomerVenueChange}
              customerOrders={myOrders as CustomerMineOrder[]}
              money={money}
              onBrowseMenu={() => {
                setTab("home");
                setTimeout(() => customerScrollToMenu(0), 400);
              }}
              onNeedHelp={() => setTab("messages")}
              cartItemCount={customerCart.totalQuantity}
              menuPrefsVersion={menuPrefsSeq}
              ordersEmptySessionVisits={ordersEmptySessionVisitCount}
              emptyMotionPaused={ordersEmptyMotionPaused}
            />
          </Animated.View>
        ) : tab === "orders" ? (
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
            {token && isCustomerSession ? (
              <CustomerOrdersVenueScreen
                token={token}
                userDisplayName={customerDisplayName(sessionUser?.signupProfile, sessionUser?.email ?? undefined)}
                activeId={activeRestaurantId()}
                activeName={
                  menuPreview?.ok &&
                  menuPreview.restaurant &&
                  String(menuPreview.restaurant.id).trim() === activeRestaurantId().trim()
                    ? String(menuPreview.restaurant.name ?? "")
                    : ""
                }
                venueSwitchLocked={isServeosDemoMenuEnabled()}
                onVenueHydrated={applyCustomerVenueChange}
                customerOrders={myOrders as CustomerMineOrder[]}
                money={money}
                onBrowseMenu={() => {
                  setTab("home");
                  setTimeout(() => customerScrollToMenu(0), 400);
                }}
                onNeedHelp={() => setTab("messages")}
                cartItemCount={customerCart.totalQuantity}
                menuPrefsVersion={menuPrefsSeq}
                ordersEmptySessionVisits={ordersEmptySessionVisitCount}
                emptyMotionPaused={ordersEmptyMotionPaused}
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
                    placeholderTextColor={themeColors.textMuted}
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
                    onMenuEngagement={() => setMenuPrefsSeq((s) => s + 1)}
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
                    placeholderTextColor={themeColors.textMuted}
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
                    placeholderTextColor={themeColors.textMuted}
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

                {token && isCustomerSession ? (
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
        ) : null}

        {token && isCustomerSession ? (
          <View
            style={[styles.scrollLayer, tab !== "messages" ? { display: "none" } : null]}
            pointerEvents={tab === "messages" ? "auto" : "none"}
          >
          <CustomerChatScreen
            token={token}
            restaurantId={activeRestaurantId()}
            userId={sessionUser?.id}
            money={money}
            scrollY={scrollY}
            onScroll={onScroll}
            scrollTopPad={scrollTopPad}
            scrollBottom={scrollBottom}
            chatFocused={tab === "messages"}
            onUnreadCountChange={(n) => {
              setChatUnreadCount(n);
              void setChatBadgeCount(n);
            }}
            onViewMenu={() => {
              setTab("home");
              setTimeout(() => customerScrollToMenu(0), 400);
            }}
            onPopularItems={customerPopularPicks}
            onOpenCart={() => {
              setTab("home");
              setTimeout(() => openCartSheetHalf(), 400);
            }}
            onPlaceOrder={() => {
              setTab("home");
              setTimeout(() => openCartSheetHalf(), 400);
            }}
            onChooseVenue={() => setTab("orders")}
            onReorder={() => {
              setTab("home");
              setTimeout(() => customerScrollToMenu(0), 400);
            }}
          />
          </View>
        ) : tab === "messages" ? (
          <Animated.ScrollView
            style={styles.scrollLayer}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardDismissMode={SCROLL_KEYBOARD_DISMISS_MODE}
            contentContainerStyle={[styles.scrollPad, { paddingTop: scrollTopPad, paddingBottom: scrollBottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.pageTitle}>Messages</Text>
            <Text style={styles.pageSub}>Operational threads for your venues — order-linked, not social chat.</Text>
            <View style={[styles.cardShell, styles.surfaceCard]}>
              <View style={styles.premiumBadgeRow}>
                <Text style={styles.premiumBadge}>Staff & owner</Text>
              </View>
              <Text style={styles.cardHeadline}>Venue operations inbox</Text>
              <Text style={styles.cardBodyMuted}>
                Guest order threads and internal coordination will appear here. Customer assistance lives in the customer Chat
                tab.
              </Text>
            </View>
          </Animated.ScrollView>
        ) : null}

        {tab === "account" && token && isCustomerSession ? (
          <View style={styles.scrollLayer}>
            <CustomerMeStack
              topInset={scrollTopPad}
              compactTopInset={meCompactTopPad}
              bottomInset={scrollBottom}
              user={sessionUser}
              venueName={customerVenueDisplayName}
              activeOrderCount={activeOrderCount}
              onOpenBookings={() => setTab("bookings")}
              onOpenOrders={() => setTab("orders")}
              onOpenSupport={() => setTab("messages")}
              onSignOut={() => void customerSignOut()}
              onAvatarSaved={setMeAvatarUri}
              onAtRootChange={setMeStackAtRoot}
            />
          </View>
        ) : tab === "account" ? (
          <Animated.ScrollView
            style={styles.scrollLayer}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardDismissMode={SCROLL_KEYBOARD_DISMISS_MODE}
            contentContainerStyle={[styles.scrollPad, { paddingTop: scrollTopPad, paddingBottom: scrollBottom }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.pageTitle}>Account</Text>
            <Text style={styles.pageSub}>Venues, session, and business tools.</Text>

            <View style={[styles.cardShell, styles.fieldCard]}>
              <Text style={styles.inputLabel}>Add another venue (same company)</Text>
              <TextInput
                value={restaurantName}
                onChangeText={setRestaurantName}
                placeholder="Name"
                placeholderTextColor={themeColors.textMuted}
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
        ) : null}
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

      {token && isCustomerSession ? (
        <CustomerNavMenuPage
          visible={customerNavMenuOpen}
          ambientTab={tab}
          topInset={insets.top}
          bottomInset={contentBottomInset(insets.bottom)}
          user={sessionUser}
          onBack={() => setCustomerNavMenuOpen(false)}
          onChooseVenue={() => {
            setCustomerNavMenuOpen(false);
            setTab("orders");
          }}
        />
      ) : null}

      <FloatingGlassTabBar
        tab={tab}
        onChange={(next) => {
          Keyboard.dismiss();
          setCustomerNavMenuOpen(false);
          setTab(next);
        }}
        insets={insets}
        sheetHeightSV={sheetHeightSV}
        snapImpactTargetSV={snapImpactTargetSV}
        snapImpactArmedSV={snapImpactArmedSV}
        sheetContent={sheetCartPanel ?? sheetSearchPanel ?? undefined}
        onSheetDragOpenFromCollapsed={onSheetDragOpenFromCollapsed}
        sheetFullOnly={navSheetSearchMode}
        messagesUnreadCount={chatUnreadCount}
        ordersActiveCount={ordersTabBadgeCount}
        meAvatarUri={isCustomerSession ? meAvatarUri : null}
      />
    </Animated.View>
  );
}

