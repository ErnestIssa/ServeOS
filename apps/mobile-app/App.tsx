import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { nativeNavBoldGradient } from "@serveos/core-ambient/themes";
import { formatMoneyCents } from "@serveos/core-shared/currency";
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
import { fetchCustomerAppContext } from "./src/customer/customerAppApi";
import {
  fetchMobileExperience,
  isChatNavTab,
  isProfileNavTab,
  mobileExperienceFromUser,
  mobileRoleTypeFromUser,
  navTabLabel,
  navTabsFromUser
} from "./src/mobile/mobileExperience";
import { navKeyToAmbientTab } from "./src/mobile/navAmbient";
import { RoleNavTabPanel } from "./src/workspace/RoleNavTabPanel";
import {
  fetchWorkspaceContext,
  patchWorkspaceActiveRestaurant,
  type WorkspaceContext
} from "./src/mobile/workspaceApi";
import {
  countActiveCustomerOrders,
  isActiveOrderStatus,
  orderStatusMilestone,
  pickActiveOrder,
  type CustomerMineOrder
} from "./src/customer/CustomerOrderTrackingSection";
import { clearOrderStatusCue, syncOrderStatusCue } from "./src/customer/orderStatusCue";
import { AuthFlowScreen } from "./src/auth/AuthFlowScreen";
import {
  deleteCartLine,
  fetchCustomerCart,
  isCartRemoveConfirmationError,
  patchCartLineDelta,
  patchCustomerCartNote,
  postCartAddItem,
  type CartLineApi
} from "./src/customer/cartApi";
import { buildMarkedMenuItemIdsRecord } from "./src/customer/customerMarkedMenuItems";
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
import { buildFilteredMenuPool, flattenMenu, type MenuCategoryLite } from "./src/menu/menuBrowseUtils";
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
import { NotificationsInboxPage } from "./src/shell/NotificationsInboxPage";
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
  subscribeNotificationRelay
} from "./src/notifications/notificationSocket";
import { fetchNotificationUnreadCount } from "./src/notifications/notificationsApi";
import { FloatingTopBar, FLOATING_TOP_BAR_HEIGHT } from "./src/shell/FloatingTopBar";
import { createAppStyles } from "./src/theme/createAppStyles";
import { R } from "./src/theme";
import { isLikelyErrorStatus, useAppErrors } from "./src/errors";

const AUTH_TOKEN_KEY = "serveos.auth.jwt";
const CUSTOMER_VENUE_KEY = "serveos.customer.preferredRestaurantId";

/** Customer search opens the nav sheet with this timing — slower than drag/snapped springs. */
const SEARCH_SHEET_OPEN_MS = 920;

/** iOS: swipe keyboard down; Android: drag scroll to dismiss. */
const SCROLL_KEYBOARD_DISMISS_MODE = Platform.OS === "ios" ? ("interactive" as const) : ("on-drag" as const);

export default function App() {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useAppTheme();
  const { showErrorModal } = useAppErrors();
  const styles = React.useMemo(() => createAppStyles(themeColors, isDark), [themeColors, isDark]);
  const lastStatusErrorRef = React.useRef("");

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

  const mobileExperience = React.useMemo(() => mobileExperienceFromUser(sessionUser), [sessionUser]);
  const mobileRoleType = React.useMemo(() => mobileRoleTypeFromUser(sessionUser), [sessionUser]);
  /** Backend `roleType` — not raw DB role strings. */
  const isCustomerSession = mobileRoleType === "CUSTOMER";
  const navTabs = navTabsFromUser(sessionUser);
  const profileTabKey = React.useMemo(
    () => navTabs.find((t) => isProfileNavTab(t.key))?.key ?? "account",
    [navTabs]
  );

  const [restaurants, setRestaurants] = React.useState<Array<{ id: string; name: string; role: string; companyId?: string | null }>>([]);
  const [restaurantName, setRestaurantName] = React.useState("My Restaurant");
  const [status, setStatus] = React.useState("");
  React.useEffect(() => {
    if (!status || !isLikelyErrorStatus(status)) {
      lastStatusErrorRef.current = "";
      return;
    }
    if (lastStatusErrorRef.current === status) return;
    lastStatusErrorRef.current = status;
    showErrorModal(status, {
      title: "Could not complete",
      onClosed: () => {
        setStatus("");
        lastStatusErrorRef.current = "";
      }
    });
  }, [status, showErrorModal]);
  const [customerSearchQuery, setCustomerSearchQuery] = React.useState("");
  /** Full-screen page from customer top-bar menu (hamburger); back restores prior tab/screen. */
  const [customerNavMenuOpen, setCustomerNavMenuOpen] = React.useState(false);
  const [notificationsInboxOpen, setNotificationsInboxOpen] = React.useState(false);
  const [platformNotificationCount, setPlatformNotificationCount] = React.useState(0);
  const notificationsInboxOpenRef = React.useRef(false);
  notificationsInboxOpenRef.current = notificationsInboxOpen;
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
  const [serverMarkedMenuIds, setServerMarkedMenuIds] = React.useState<string[]>([]);
  const [optimisticMarkedMenuIds, setOptimisticMarkedMenuIds] = React.useState<Set<string>>(() => new Set());
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
  const [upcomingReservationsCount, setUpcomingReservationsCount] = React.useState(0);
  const [meAvatarUri, setMeAvatarUri] = React.useState<string | null>(null);
  /** ME tab inner stack: only the hub root keeps the floating top search bar visible. */
  const [meStackAtRoot, setMeStackAtRoot] = React.useState(true);
  const [workspaceContext, setWorkspaceContext] = React.useState<WorkspaceContext | null>(null);

  const refreshWorkspaceContext = React.useCallback(async (jwt?: string) => {
    const t = jwt ?? token;
    if (!t || mobileRoleTypeFromUser(sessionUser) === "CUSTOMER") {
      setWorkspaceContext(null);
      return;
    }
    const res = await fetchWorkspaceContext(t);
    if (res.ok) setWorkspaceContext(res.context);
  }, [token, sessionUser]);

  const workspaceRestaurantId = workspaceContext?.activeRestaurantId ?? null;

  const setWorkspaceVenue = React.useCallback(
    async (restaurantId: string) => {
      if (!token) return;
      const res = await patchWorkspaceActiveRestaurant(token, restaurantId);
      if (res.ok) setWorkspaceContext(res.context);
    },
    [token]
  );

  React.useEffect(() => {
    if (!isProfileNavTab(tab)) setMeStackAtRoot(true);
  }, [tab]);

  React.useEffect(() => {
    void refreshWorkspaceContext();
  }, [refreshWorkspaceContext]);

  React.useEffect(() => {
    if (!navTabs.length) return;
    if (!navTabs.some((t) => t.key === tab)) setTab(navTabs[0]!.key);
  }, [tab, navTabs]);

  React.useEffect(() => {
    if (!token || sessionUser?.mobileExperience) return;
    let cancelled = false;
    void fetchMobileExperience(token).then((experience) => {
      if (cancelled || !experience) return;
      setSessionUser((u) => (u ? { ...u, roleType: experience.roleType, mobileExperience: experience } : u));
      if (experience.roleType !== "CUSTOMER") void refreshWorkspaceContext(token);
    });
    return () => {
      cancelled = true;
    };
  }, [token, sessionUser?.mobileExperience]);

  const activeOrderCount = React.useMemo(() => {
    if (!isCustomerSession) return 0;
    return countActiveCustomerOrders(myOrders as CustomerMineOrder[]);
  }, [myOrders, isCustomerSession]);

  const ordersTabBadgeCount = tab === "orders" ? 0 : activeOrderCount;
  const bookTabBadgeCount = tab === "bookings" ? 0 : upcomingReservationsCount;

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

  const refreshPlatformNotificationCount = React.useCallback(async () => {
    if (!token) {
      setPlatformNotificationCount(0);
      return;
    }
    const res = await fetchNotificationUnreadCount(token);
    if (res.ok && typeof res.count === "number") setPlatformNotificationCount(res.count);
  }, [token]);

  const openNotificationsInbox = React.useCallback(() => {
    Keyboard.dismiss();
    if (sheetBackdropActive) closeSheetFromBackdrop();
    setNotificationsInboxOpen(true);
  }, [sheetBackdropActive, closeSheetFromBackdrop]);

  React.useEffect(() => {
    if (!token) {
      disconnectNotificationSocket();
      setPlatformNotificationCount(0);
      return;
    }
    connectNotificationSocket(token);
    void refreshPlatformNotificationCount();
    const poll = setInterval(() => void refreshPlatformNotificationCount(), 60_000);
    const off = subscribeNotificationRelay((payload) => {
      if (payload.type !== "notification") return;
      void refreshPlatformNotificationCount();
      if (!notificationsInboxOpenRef.current) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
    return () => {
      clearInterval(poll);
      off();
      disconnectNotificationSocket();
    };
  }, [token, refreshPlatformNotificationCount]);

  const customerSignOut = React.useCallback(async () => {
    disconnectCustomerChatSocket();
    disconnectNotificationSocket();
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
    setNotificationsInboxOpen(false);
    setPlatformNotificationCount(0);
  }, [sessionUser?.id]);

  const customerHomeScrollRef = React.useRef<ScrollView | null>(null);
  const [customerMenuTopY, setCustomerMenuTopY] = React.useState(320);

  const scrollY = React.useRef(new Animated.Value(0)).current;
  const resetBookingsScroll = React.useCallback(() => {
    scrollY.setValue(0);
  }, [scrollY]);
  const restoreBookingsScroll = React.useCallback(
    (y: number) => {
      scrollY.setValue(Math.max(0, y));
    },
    [scrollY]
  );
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

  const skipCartNotePersistRef = React.useRef(true);
  const cartNoteSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyCustomerCartResponse = React.useCallback(
    (body: {
      lines: CartLineApi[];
      subtotalCents: number;
      totalQuantity: number;
      markedMenuItemIds?: string[];
      orderNote?: string;
    }) => {
      setCustomerCart({
        lines: body.lines,
        subtotalCents: body.subtotalCents,
        totalQuantity: body.totalQuantity
      });
      setOptimisticCartQty(body.totalQuantity);
      if (body.orderNote !== undefined) {
        skipCartNotePersistRef.current = true;
        setOrderNote(body.orderNote);
      }
      const marked = body.markedMenuItemIds ?? [];
      setServerMarkedMenuIds(marked);
      setOptimisticMarkedMenuIds((prev) => {
        const next = new Set(prev);
        for (const id of marked) next.delete(id);
        for (const line of body.lines) next.delete(line.menuItemId);
        return next;
      });
    },
    []
  );

  const menuItemPool = React.useMemo(() => {
    if (!menuPreview?.ok || !menuPreview.categories) return [];
    return flattenMenu((menuPreview.categories ?? []) as MenuCategoryLite[]);
  }, [menuPreview]);

  const applyOptimisticAddToCustomerCart = React.useCallback(
    (menuItemId: string) => {
      const item = menuItemPool.find((i) => i.id === menuItemId);
      const unitPriceCents = item?.priceCents ?? 0;
      const name = item?.name ?? "Item";

      setOptimisticMarkedMenuIds((prev) => new Set(prev).add(menuItemId));

      setCustomerCart((prev) => {
        const idx = prev.lines.findIndex((l) => l.menuItemId === menuItemId);
        if (idx >= 0) {
          const line = prev.lines[idx]!;
          const quantity = line.quantity + 1;
          const nextLines = prev.lines.map((l, i) =>
            i === idx ? { ...l, quantity, lineTotalCents: l.unitPriceCents * quantity } : l
          );
          return {
            lines: nextLines,
            totalQuantity: prev.totalQuantity + 1,
            subtotalCents: prev.subtotalCents + line.unitPriceCents
          };
        }
        const tempLine: CartLineApi = {
          id: `optimistic-${menuItemId}`,
          menuItemId,
          name,
          quantity: 1,
          unitPriceCents,
          lineTotalCents: unitPriceCents,
          modifierOptionIds: []
        };
        return {
          lines: [...prev.lines, tempLine],
          totalQuantity: prev.totalQuantity + 1,
          subtotalCents: prev.subtotalCents + unitPriceCents
        };
      });
      setOptimisticCartQty((q) => q + 1);
    },
    [menuItemPool]
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

  const refreshCustomerAppContext = React.useCallback(
    async (restaurantId?: string) => {
      const t = token;
      if (!t || !isCustomerSession) {
        setUpcomingReservationsCount(0);
        setChatUnreadCount(0);
        return;
      }
      const rid = (restaurantId ?? activeRestaurantId()).trim() || null;
      try {
        const res = await fetchCustomerAppContext(t, rid);
        if (!res.ok) return;
        const ctx = res.context;
        setChatUnreadCount(ctx.badges.chatUnread);
        setUpcomingReservationsCount(ctx.badges.upcomingReservations);
        if (ctx.avatarUri) setMeAvatarUri(ctx.avatarUri);
        if (ctx.cart) {
          applyCustomerCartResponse({
            lines: ctx.cart.lines,
            subtotalCents: ctx.cart.subtotalCents,
            totalQuantity: ctx.cart.totalQuantity,
            markedMenuItemIds: ctx.cart.markedMenuItemIds,
            orderNote: ctx.cart.orderNote
          });
        }
      } catch {
        /* keep last snapshot */
      }
    },
    [token, isCustomerSession, activeRestaurantId, applyCustomerCartResponse]
  );

  const markedMenuItemIds = React.useMemo(() => {
    if (!isCustomerSession) {
      return buildMarkedMenuItemIdsRecord({
        serverMarkedMenuItemIds: [],
        cartLines: [],
        orders: [],
        restaurantId: activeRestaurantId(),
        optimisticMenuItemIds: localCart.map((l) => l.menuItemId)
      });
    }
    return buildMarkedMenuItemIdsRecord({
      serverMarkedMenuItemIds: serverMarkedMenuIds,
      cartLines: customerCart.lines,
      orders: myOrders as CustomerMineOrder[],
      restaurantId: activeRestaurantId(),
      optimisticMenuItemIds: optimisticMarkedMenuIds
    });
  }, [
    isCustomerSession,
    serverMarkedMenuIds,
    customerCart.lines,
    myOrders,
    activeRestaurantId,
    optimisticMarkedMenuIds,
    localCart
  ]);

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
    let user = me.user;
    if (!user.mobileExperience) {
      const experience = await fetchMobileExperience(jwt);
      if (experience) {
        user = { ...user, roleType: experience.roleType, mobileExperience: experience };
      }
    }
    setSessionUser(user);
    return user;
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
        setOptimisticMarkedMenuIds(new Set());
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
      skipCartNotePersistRef.current = true;
      const noteSave = await patchCustomerCartNote(token, rid, orderNote);
      if (noteSave.ok) applyCustomerCartResponse(noteSave);
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
      void recordOrderedItemsForRestaurant(rid, lineIdsSnapshot, token);
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
    void recordOrderedItemsForRestaurant(rid, lineIdsSnapshot, token);
    setMenuPrefsSeq((x) => x + 1);
    setStatus("Order placed");
    setLocalCart([]);
    setOrderNote("");
    setTab("orders");
    setTrackId(res.order?.id ?? "");
  }

  function showCartMutationError(raw: string, title = "Couldn't update cart") {
    const msg =
      raw === "remove_confirmation_required"
        ? "Please confirm removing this item."
        : raw === "not_found"
          ? "That item is no longer in your cart."
          : /can’t reach|can't reach|network|timeout/i.test(raw)
            ? "We can't reach the server right now. Check your connection and try again."
            : "Something went wrong updating your cart. Please try again.";
    setActionModal({
      visible: true,
      title,
      message: msg,
      primaryLabel: "OK",
      onPrimary: () => setActionModal((p) => ({ ...p, visible: false })),
      onSecondary: undefined,
      secondaryLabel: undefined
    });
  }

  function confirmRemoveCartLine(line: CartLineApi, onConfirmed: () => void) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionModal({
      visible: true,
      title: "Remove item?",
      message: `Remove "${line.name}" from your cart? This can't be undone.`,
      primaryLabel: "Remove",
      onPrimary: () => {
        setActionModal((p) => ({ ...p, visible: false }));
        onConfirmed();
      },
      secondaryLabel: "Keep item",
      onSecondary: () => setActionModal((p) => ({ ...p, visible: false }))
    });
  }

  async function executeRemoveCustomerCartLine(lineId: string) {
    if (!token || !isCustomerSession) return;
    const rid = activeRestaurantId().trim();
    const res = await deleteCartLine(token, lineId, true);
    if (!res.ok) {
      if (isCartRemoveConfirmationError(res)) return;
      showCartMutationError(String(res.error ?? "cart_remove_failed"));
      if (rid) void refreshCustomerCart(rid);
      return;
    }
    applyCustomerCartResponse(res);
    setCartFabDeferred(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function requestRemoveCustomerCartLine(lineId: string) {
    const line = customerCart.lines.find((l) => l.id === lineId);
    if (!line) return;
    confirmRemoveCartLine(line, () => void executeRemoveCustomerCartLine(lineId));
  }

  async function incCustomerCartLine(lineId: string) {
    if (!token || !isCustomerSession) return;
    const rid = activeRestaurantId().trim();
    const res = await patchCartLineDelta(token, lineId, 1);
    if (!res.ok) {
      showCartMutationError(String(res.error ?? "cart_update_failed"));
      if (rid) void refreshCustomerCart(rid);
      return;
    }
    applyCustomerCartResponse(res);
  }

  async function decCustomerCartLine(lineId: string) {
    if (!token || !isCustomerSession) return;
    const cur = customerCart.lines.find((l) => l.id === lineId);
    if (!cur) return;
    if (cur.quantity <= 1) {
      confirmRemoveCartLine(cur, () => void executeRemoveCustomerCartLine(lineId));
      return;
    }
    const rid = activeRestaurantId().trim();
    const res = await patchCartLineDelta(token, lineId, -1);
    if (!res.ok) {
      if (isCartRemoveConfirmationError(res)) {
        confirmRemoveCartLine(cur, () => void executeRemoveCustomerCartLine(lineId));
        return;
      }
      showCartMutationError(String(res.error ?? "cart_update_failed"));
      if (rid) void refreshCustomerCart(rid);
      return;
    }
    applyCustomerCartResponse(res);
  }

  const persistCustomerCartNote = React.useCallback(
    async (note: string) => {
      const t = token;
      const rid = activeRestaurantId().trim();
      if (!t || !isCustomerSession || !rid) return;
      const res = await patchCustomerCartNote(t, rid, note);
      if (!res.ok) {
        showCartMutationError(String(res.error ?? "cart_note_failed"), "Couldn't save note");
        return;
      }
      applyCustomerCartResponse(res);
    },
    [token, isCustomerSession, applyCustomerCartResponse, activeRestaurantId]
  );

  const onCustomerCartNoteChange = React.useCallback((text: string) => {
    skipCartNotePersistRef.current = false;
    setOrderNote(text);
  }, []);

  React.useEffect(() => {
    if (!token || !isCustomerSession) return;
    const rid = activeRestaurantId().trim();
    if (!rid || skipCartNotePersistRef.current) return;
    if (cartNoteSaveTimerRef.current) clearTimeout(cartNoteSaveTimerRef.current);
    cartNoteSaveTimerRef.current = setTimeout(() => {
      void persistCustomerCartNote(orderNote);
    }, 480);
    return () => {
      if (cartNoteSaveTimerRef.current) clearTimeout(cartNoteSaveTimerRef.current);
    };
  }, [orderNote, token, isCustomerSession, persistCustomerCartNote]);

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

    setCartFabDeferred(false);
    if (tab === "home") setCartFabBump((n) => n + 1);
    void playCartAddCue();

    try {
      /** Primary path: server cart. Reconcile after POST; don't block UI on GET. */
      if (token && isCustomerSession && rid) {
        applyOptimisticAddToCustomerCart(menuItemId);
        setPendingAddsCount((n) => n + 1);
        const res = await postCartAddItem({ jwt: token, restaurantId: rid, menuItemId });
        setPendingAddsCount((n) => Math.max(0, n - 1));
        if (!res.ok) {
          const err = String((res as { error?: string }).error ?? "cart_add_failed");
          setOptimisticMarkedMenuIds((prev) => {
            const next = new Set(prev);
            next.delete(menuItemId);
            return next;
          });
          void refreshCustomerCart(rid);
          setStatus(err);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          showCartErrorModal(err);
          return;
        }
        applyCustomerCartResponse(res);
        void bumpBrowseEngagement(rid, token).then(() => {
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
            setTab(profileTabKey);
          },
          secondaryLabel: "Dismiss",
          onSecondary: () => setActionModal((p) => ({ ...p, visible: false }))
        });
        return;
      }

      setLocalCart((c) => [...c, { menuItemId, quantity: 1, modifierOptionIds: [] }]);
      setOptimisticCartQty((q) => q + 1);
      setStatus("Added to cart (this device only — sign in as a diner for cloud cart).");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "cart_add_failed";
      setStatus(msg);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showCartErrorModal(msg);
      if (isCustomerSession && rid) {
        setOptimisticMarkedMenuIds((prev) => {
          const next = new Set(prev);
          next.delete(menuItemId);
          return next;
        });
        void refreshCustomerCart(rid);
      }
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
        const rid =
          menuPreview?.ok && menuPreview.restaurant?.id
            ? String(menuPreview.restaurant.id).trim()
            : menuRid.trim();
        if (rid) void refreshCustomerCart(rid);
      } catch {
        /* Keep last cached list visible. */
      }
    },
    [token, isCustomerSession, sessionUser?.id, menuPreview, menuRid, refreshCustomerCart]
  );

  React.useEffect(() => {
    if (tab === "orders" && token && isCustomerSession) void fetchMyOrders();
  }, [tab, token, isCustomerSession, fetchMyOrders]);

  React.useEffect(() => {
    if (token && isCustomerSession) void refreshCustomerAppContext();
  }, [tab, token, isCustomerSession, refreshCustomerAppContext, menuRid, sessionUser?.preferredRestaurantId]);

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
        if (
          (data.type === "order_updated" || data.type === "ocl_updated") &&
          data.orderId === id
        ) {
          setTrackResult((prev: any) => ({
            ok: true,
            orderId: data.orderId,
            status: data.status ?? prev?.status,
            totalCents: data.totalCents ?? prev?.totalCents,
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
    return formatMoneyCents(cents);
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
  const hideProfileSubpageTopNav = !!token && mobileExperience && isProfileNavTab(tab) && !meStackAtRoot;

  const pageTitle = navTabLabel(mobileExperience, tab) ?? "ServeOS";

  const leftLabel =
    (menuPreview?.ok && menuPreview.restaurant?.name ? String(menuPreview.restaurant.name) : null) ??
    (restaurants[0]?.name ? String(restaurants[0]?.name) : null) ??
    "ServeOS";

  /** One nav capsule look for all customer tabs (matches Home glass chrome). */
  const navGradient = isCustomerSession
    ? nativeNavBoldGradient("home")
    : nativeNavBoldGradient(navKeyToAmbientTab(tab));
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
        onOrderNoteChange={onCustomerCartNoteChange}
        placing={placingOrder}
        onPlaceOrder={() => void submitOrder()}
        onRemoveLine={(id) => requestRemoveCustomerCartLine(id)}
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
        markedMenuItemIds={markedMenuItemIds}
      />
    ) : null;

  const displayCartQty = isCustomerSession ? Math.max(0, optimisticCartQty) : Math.max(0, localCart.reduce((s, l) => s + l.quantity, 0));

  return (
    <Animated.View style={[styles.shell, { opacity: screenEnter, transform: [{ translateY: screenEnterY }] }]}>
      {Platform.OS === "ios" ? <StatusBar style={isDark ? "light" : "dark"} /> : null}
      {Platform.OS === "android" ? (
        <RNStatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDark ? "light-content" : "dark-content"}
        />
      ) : null}

      <View style={styles.main}>
        <ScrollMeshBackground tab={navKeyToAmbientTab(tab)} scrollY={scrollY} />
        {!hideProfileSubpageTopNav ? <TopNavContentDimmer topInset={insets.top} /> : null}
        {isCustomerSession ? (
          !hideProfileSubpageTopNav ? (
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
            notificationCount={platformNotificationCount}
            onNotifications={openNotificationsInbox}
            onMenu={() => {
              Keyboard.dismiss();
              if (sheetBackdropActive) closeSheetFromBackdrop();
              setCustomerNavMenuOpen(true);
            }}
          />
          ) : null
        ) : token && mobileExperience ? (
          !hideProfileSubpageTopNav ? (
            <FloatingTopBar
              topInset={insets.top}
              scrollY={scrollY}
              navGradient={navGradient}
              leftLabel={leftLabel}
              centerTitle={pageTitle}
              notificationCount={platformNotificationCount}
              onLeftPress={() => setTab(profileTabKey)}
              onSearch={() => setStatus("search")}
              onNotifications={openNotificationsInbox}
              onMenu={() => {
                Keyboard.dismiss();
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
            notificationCount={platformNotificationCount}
            onLeftPress={() => setTab(profileTabKey)}
            onSearch={() => setStatus("search")}
            onNotifications={openNotificationsInbox}
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
                      markedMenuItemIds={markedMenuItemIds}
                      authToken={token}
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
                    <Pressable style={({ pressed }) => [styles.pillGhost, pressed && styles.pressed]} onPress={() => setTab(profileTabKey)}>
                      <Text style={styles.pillGhostText}>Account</Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Quick actions</Text>
                <View style={styles.tileRow}>
                  <Pressable style={({ pressed }) => [styles.cardShell, styles.tile, pressed && styles.pressed]} onPress={() => setTab(profileTabKey)}>
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
            userId={sessionUser?.id}
            scrollY={scrollY}
            onScroll={onScroll}
            scrollTopPad={scrollTopPad}
            scrollBottom={scrollBottom}
            onChooseVenue={() => setTab("orders")}
            onOpenChat={() => setTab("messages")}
            onExitToHome={() => setTab("home")}
            onResetScroll={resetBookingsScroll}
            onRestoreScroll={restoreBookingsScroll}
            onReservationsChanged={() => void refreshCustomerAppContext()}
          />
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
        ) : tab === "orders" && isCustomerSession ? (
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
          </Animated.ScrollView>
        ) : null}

        {token && isCustomerSession ? (
          <View
            style={[styles.scrollLayer, !isChatNavTab(tab) ? { display: "none" } : null]}
            pointerEvents={isChatNavTab(tab) ? "auto" : "none"}
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
            chatFocused={isChatNavTab(tab)}
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
        ) : null}

        {token && mobileExperience && !isCustomerSession && !isProfileNavTab(tab) && tab !== "home" ? (
          <RoleNavTabPanel
            tabKey={tab}
            mobileExperience={mobileExperience}
            authToken={token}
            workspaceContext={workspaceContext}
            workspaceRestaurantId={workspaceRestaurantId}
            onSelectVenue={(id) => void setWorkspaceVenue(id)}
            scrollTopPad={scrollTopPad}
            scrollBottom={scrollBottom}
            onScroll={onScroll}
            onNavigateTab={setTab}
            onSignOut={() => void customerSignOut()}
          />
        ) : null}

        {isProfileNavTab(tab) && token && mobileExperience && isCustomerSession ? (
          <View style={styles.scrollLayer}>
            <CustomerMeStack
              topInset={scrollTopPad}
              compactTopInset={meCompactTopPad}
              bottomInset={scrollBottom}
              user={sessionUser}
              authToken={token}
              mobileExperience={mobileExperience}
              workspaceRestaurantId={workspaceRestaurantId}
              venueName={customerVenueDisplayName}
              activeOrderCount={activeOrderCount}
              onOpenOrders={() => setTab("orders")}
              onOpenSupport={() => {
                const chatTab = navTabs.find((t) => isChatNavTab(t.key))?.key;
                if (chatTab) setTab(chatTab);
              }}
              onSignOut={() => void customerSignOut()}
              onAvatarSaved={setMeAvatarUri}
              onAtRootChange={setMeStackAtRoot}
            />
          </View>
        ) : isProfileNavTab(tab) && token && mobileExperience ? (
          <RoleNavTabPanel
            tabKey={tab}
            mobileExperience={mobileExperience}
            authToken={token}
            workspaceContext={workspaceContext}
            workspaceRestaurantId={workspaceRestaurantId}
            onSelectVenue={(id) => void setWorkspaceVenue(id)}
            scrollTopPad={scrollTopPad}
            scrollBottom={scrollBottom}
            onScroll={onScroll}
            onNavigateTab={setTab}
            onSignOut={() => void customerSignOut()}
          />
        ) : isProfileNavTab(tab) ? (
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
        <BottomNavContentDimmer bottomInset={insets.bottom} />
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

      {token && mobileExperience ? (
        <CustomerNavMenuPage
          visible={customerNavMenuOpen}
          ambientTab={navKeyToAmbientTab(tab)}
          topInset={insets.top}
          bottomInset={contentBottomInset(insets.bottom)}
          user={sessionUser}
          authToken={token}
          mobileExperience={mobileExperience}
          workspaceRestaurantId={workspaceRestaurantId}
          onBack={() => setCustomerNavMenuOpen(false)}
          onChooseVenue={() => {
            setCustomerNavMenuOpen(false);
            if (isCustomerSession) setTab("orders");
            else if (workspaceContext && workspaceContext.memberships.length > 1) setTab("home");
            else setTab("orders");
          }}
        />
      ) : null}

      {token ? (
        <NotificationsInboxPage
          visible={notificationsInboxOpen}
          ambientTab={navKeyToAmbientTab(tab)}
          topInset={insets.top}
          bottomInset={contentBottomInset(insets.bottom)}
          authToken={token}
          onBack={() => setNotificationsInboxOpen(false)}
          onUnreadCountChange={setPlatformNotificationCount}
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
        bookingsUpcomingCount={bookTabBadgeCount}
        meAvatarUri={meAvatarUri}
        navTabs={navTabs}
      />
    </Animated.View>
  );
}

