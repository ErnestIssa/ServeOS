import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import { ServeOSBrandScreenNative } from "@serveos/core-loading-native";
import React from "react";
import {
  AppState,
  Animated,
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
import Reanimated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { ScrollMeshBackground } from "./src/ambient/ScrollMeshBackground";
import { useAppTheme } from "./src/theme/AppThemeContext";
import { apiFetch, apiHttpToWsBase, authMe, authLogout, API_URL, type AuthUser, type CustomerRestaurantRow } from "./src/api";
import { loadClientConfig } from "./src/bootstrap/clientConfig";
import { syncDevicePushTokenWithBackend } from "./src/notifications/devicePushRegistration";
import {
  loadMyOrdersCached,
  prefetchCustomerSession,
  refreshMyOrdersSilent,
  invalidateRestaurantDirectory,
  TTL
} from "./src/data/customerDataCache";
import { authScope, myOrdersKey } from "./src/data/cache/cacheKeys";
import { cacheInvalidate, cacheWrite } from "./src/data/cache/appCache";
import { CustomerChatScreen } from "./src/customer/CustomerChatScreen";
import { CustomerChatOverviewScreen } from "./src/customer/CustomerChatOverviewScreen";
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
import { formatApiError, isStalePreferredVenue, menuHasBrowsableItems, venueHasNoBrowsableMenu } from "./src/customer/venueContentHelpers";
import { CustomerHomeVenueLoadError } from "./src/customer/CustomerHomeVenueLoadError";
import { CustomerReservationFlow } from "./src/customer/reservations/CustomerReservationFlow";
import { fetchCustomerAppContext } from "./src/customer/customerAppApi";
import {
  defaultNavTabKey,
  fetchMobileExperience,
  homeNavTabKey,
  isChatNavTab,
  isProfileNavTab,
  mobileExperienceFromUser,
  mobileRoleTypeFromUser,
  navTabLabel,
  navTabsFromUser
} from "./src/mobile/mobileExperience";
import {
  fetchExperienceSwitcher,
  patchActiveExperience,
  type ExperienceSwitcherPayload
} from "./src/mobile/experienceSwitcherApi";
import { navKeyToAmbientTab } from "./src/mobile/navAmbient";
import { RoleNavTabPanel } from "./src/workspace/RoleNavTabPanel";
import {
  fetchWorkspaceContext,
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
import { CustomerNavSearchSheetSkeleton } from "./src/customer/CustomerNavSearchSheetSkeleton";
import { CustomerHomeSearchModal } from "./src/shell/CustomerHomeSearchModal";
import { appendNavSearchRecent } from "./src/customer/navSearchRecentStorage";
import { NutritionInfoModal } from "./src/customer/NutritionInfoModal";
import { ActionModal } from "./src/components/ActionModal";
import { AppConnectSkeleton } from "./src/components/skeleton/AppConnectSkeleton";
import { buildCustomerHomeHeader, customerDisplayName, formatUserRoleExperience } from "./src/customer/customerHomeCopy";
import { CustomerMenuBrowsing, recordOrderedItemsForRestaurant } from "./src/menu/CustomerMenuBrowsing";
import { MenuItemDetailSheet } from "./src/menu/MenuItemDetailSheet";
import { createGuestOrderingSession, touchOrderingSession } from "./src/customer/orderingSessionApi";
import {
  addSessionCartItem,
  completeOrderCheckout,
  fetchSessionCart,
  placeOrderFromSessionCart,
  startOrderCheckout
} from "./src/customer/sessionCartApi";
import { bumpBrowseEngagement } from "./src/menu/menuPreferencesStorage";
import { buildFilteredMenuPool, flattenMenu, type MenuCategoryLite, type MenuItemFlat } from "./src/menu/menuBrowseUtils";
import { NavTopScrim } from "./src/shell/NavTopScrim";
import { TabTransitionPanel } from "./src/shell/TabTransitionPanel";
import { useDirectionalTabNavigation } from "./src/shell/useDirectionalTabNavigation";
import {
  contentBottomInset,
  contentTopInset,
  homeContentTopInset,
  homeScrollBottomInset,
  contentTopInsetWithoutTopNav,
  FLOATING_TAB_BAR_HEIGHT,
  FLOAT_MARGIN_SIDE,
  floatingDockBottomY
} from "./src/shell/navBottomMetrics";
import {
  FloatingGlassTabBar,
  type TabId
} from "./src/shell/FloatingGlassTabBar";
import { computeNavSheetSnapDims, SHEET_SPRING_CONFIG } from "./src/shell/NavExpandSheet";
import { NavExpandSheetHost } from "./src/shell/NavExpandSheetHost";
import { NavBottomScrim } from "./src/shell/NavBottomScrim";
import { BOTTOM_NAV_FOCUS_TIMING } from "./src/shell/navBottomFocus";
import { BottomNavScrollReporter } from "./src/shell/BottomNavScrollReporter";
import { updateBottomNavFocusFromScrollY } from "./src/shell/updateBottomNavFocusFromScrollY";
import { CustomerMeStack } from "./src/customer/profile/CustomerMeStack";
import { loadProfileAvatarUri } from "./src/customer/profile/profileAvatarStorage";
import { ExperienceSwitcherModal } from "./src/shell/ExperienceSwitcherModal";
import { FloatingTopBar } from "./src/shell/FloatingTopBar";
import { createAppStyles } from "./src/theme/createAppStyles";
import { R } from "./src/theme";
import { isLikelyErrorStatus, useAppErrors } from "./src/errors";

const AUTH_TOKEN_KEY = "serveos.auth.jwt";
const CUSTOMER_VENUE_KEY = "serveos.customer.preferredRestaurantId";

/** Customer search opens the nav sheet with this timing — slower than drag/snapped springs. */

/** iOS: swipe keyboard down; Android: drag scroll to dismiss. */
const SCROLL_KEYBOARD_DISMISS_MODE = Platform.OS === "ios" ? ("interactive" as const) : ("on-drag" as const);

const APP_CHROME_DISMISS_MS = 500;
const APP_CHROME_RESTORE_MS = 560;
const APP_CHROME_EASE = Easing.bezier(0.22, 1, 0.36, 1);

export default function App() {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useAppTheme();
  const { showErrorModal, errorModalVisible } = useAppErrors();
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
  const homeTabKey = React.useMemo(
    (): TabId => homeNavTabKey(mobileExperienceFromUser(sessionUser)) as TabId,
    [sessionUser]
  );
  const profileTabKey = React.useMemo(
    () => navTabs.find((t) => isProfileNavTab(t.key))?.key ?? "account",
    [navTabs]
  );
  const tabOrderKeys = React.useMemo(() => navTabs.map((t) => t.key), [navTabs]);
  const chatTabKey = React.useMemo(
    () => navTabs.find((t) => isChatNavTab(t.key))?.key ?? "messages",
    [navTabs]
  );
  const staffWorkspaceTabKeys = React.useMemo(
    () => navTabs.filter((t) => t.key !== "home" && !isProfileNavTab(t.key)).map((t) => t.key),
    [navTabs]
  );
  const { navigateTab, transition, progress, width: tabTransitionWidth } = useDirectionalTabNavigation(
    tab,
    setTab,
    tabOrderKeys
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
  const [experienceSwitcher, setExperienceSwitcher] = React.useState<ExperienceSwitcherPayload | null>(null);
  const [experienceSwitchBusy, setExperienceSwitchBusy] = React.useState(false);
  const [venueDirectoryRefreshKey, setVenueDirectoryRefreshKey] = React.useState(0);
  const [menuRid, setMenuRid] = React.useState("");
  const [menuPreview, setMenuPreview] = React.useState<any>(null);
  const [customerMenuLoadState, setCustomerMenuLoadState] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [customerHomeHeroH, setCustomerHomeHeroH] = React.useState(248);
  const [orderingSessionId, setOrderingSessionId] = React.useState<string | null>(null);
  const [orderingSessionVenueId, setOrderingSessionVenueId] = React.useState<string | null>(null);
  const [menuDetailItem, setMenuDetailItem] = React.useState<MenuItemFlat | null>(null);
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
  const [chatThreadRestaurantId, setChatThreadRestaurantId] = React.useState<string | null>(null);
  const [upcomingReservationsCount, setUpcomingReservationsCount] = React.useState(0);
  const [meAvatarUri, setMeAvatarUri] = React.useState<string | null>(null);
  /** ME tab inner stack: only the hub root keeps the floating top search bar visible. */
  const [meStackAtRoot, setMeStackAtRoot] = React.useState(true);
  const tabBeforeChatRef = React.useRef("home");
  const prevTabRef = React.useRef<string>("home");
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
      setExperienceSwitchBusy(true);
      try {
        const res = await patchActiveExperience(token, { mode: "WORKSPACE", restaurantId });
        if (!res.ok) {
          setStatus(res.error ?? "Could not switch workspace");
          return;
        }
        setExperienceSwitcher(res.switcher);
        setSessionUser((u) =>
          u ? { ...u, roleType: res.experience.roleType, mobileExperience: res.experience } : u
        );
        if (res.workspace) setWorkspaceContext(res.workspace);
        else setWorkspaceContext(null);
        const nextTab = defaultNavTabKey(res.experience) as TabId;
        navigateTab(nextTab);
      } finally {
        setExperienceSwitchBusy(false);
      }
    },
    [token, navigateTab]
  );

  const refreshExperienceSwitcher = React.useCallback(async (jwt?: string) => {
    const t = jwt ?? token;
    if (!t) {
      setExperienceSwitcher(null);
      return;
    }
    const res = await fetchExperienceSwitcher(t);
    if (res.ok) setExperienceSwitcher(res.switcher);
  }, [token]);

  React.useEffect(() => {
    if (!isProfileNavTab(tab)) setMeStackAtRoot(true);
  }, [tab]);

  React.useEffect(() => {
    void refreshWorkspaceContext();
  }, [refreshWorkspaceContext]);

  React.useEffect(() => {
    if (!navTabs.length) return;
    if (!navTabs.some((t) => t.key === tab)) setTab(homeTabKey);
  }, [tab, navTabs, homeTabKey]);

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

  React.useEffect(() => {
    if (!token) {
      setExperienceSwitcher(null);
      return;
    }
    void refreshExperienceSwitcher(token);
  }, [token, refreshExperienceSwitcher]);

  const customerSignOut = React.useCallback(async () => {
    disconnectCustomerChatSocket();
    const jwt = token;
    if (jwt) {
      try {
        await authLogout(jwt);
      } catch {
        /* still clear local session */
      }
    }
    await cacheInvalidate(authScope(sessionUser?.id));
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(CUSTOMER_VENUE_KEY);
    setToken(null);
    setUserRole(null);
    setSessionUser(null);
    setRestaurants([]);
    setMyOrders([]);
    setMeAvatarUri(null);
    setExperienceSwitcherOpen(false);
    setExperienceSwitcher(null);
  }, [token, sessionUser?.id]);

  const customerHomeScrollRef = React.useRef<ScrollView | null>(null);
  const [customerMenuTopY, setCustomerMenuTopY] = React.useState(320);

  const scrollY = React.useRef(new Animated.Value(0)).current;
  const sheetHeightSV = useSharedValue(0);
  const bottomNavFocusSV = useSharedValue(1);
  const lastScrollYRef = React.useRef(0);
  const appChromeDismissSV = useSharedValue(1);
  const profileBottomNavSV = useSharedValue(1);
  const customerSearchOpenSV = useSharedValue(0);
  const snapImpactTargetSV = useSharedValue(-1);
  const snapImpactArmedSV = useSharedValue(0);

  const appChromeDismissStyleTop = useAnimatedStyle(() => {
    const v = appChromeDismissSV.value;
    return {
      opacity: interpolate(v, [0, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(v, [0, 1], [-18, 0], Extrapolation.CLAMP) },
        { scale: interpolate(v, [0, 1], [0.94, 1], Extrapolation.CLAMP) }
      ]
    };
  });

  const appChromeDismissStyleBottom = useAnimatedStyle(() => {
    const v = appChromeDismissSV.value * profileBottomNavSV.value;
    return {
      opacity: interpolate(v, [0, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(v, [0, 1], [22, 0], Extrapolation.CLAMP) },
        { scale: interpolate(v, [0, 1], [0.94, 1], Extrapolation.CLAMP) }
      ]
    };
  });

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
        useNativeDriver: false,
        listener: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
          updateBottomNavFocusFromScrollY(bottomNavFocusSV, lastScrollYRef, e.nativeEvent.contentOffset.y);
        }
      }),
    [scrollY, bottomNavFocusSV]
  );

  const reportContentScroll = React.useCallback(
    (y: number) => {
      updateBottomNavFocusFromScrollY(bottomNavFocusSV, lastScrollYRef, y);
    },
    [bottomNavFocusSV]
  );

  const restoreBottomNavFocus = React.useCallback(() => {
    bottomNavFocusSV.value = withTiming(1, BOTTOM_NAV_FOCUS_TIMING);
  }, [bottomNavFocusSV]);

  const onScrollEnd = React.useCallback(() => {
    // Bottom nav restores on scroll-up or dock interaction — not on scroll idle.
  }, []);

  const armNavSheetSnapImpact = React.useCallback(
    (target: number) => {
      snapImpactTargetSV.value = target;
      snapImpactArmedSV.value = 1;
    },
    [snapImpactArmedSV, snapImpactTargetSV]
  );

  /**
   * Cart UI in the nav sheet is shown only after cart FAB on Home or explicit open actions.
   * Cleared when sheet fully collapses or search/experience programmatically opens the sheet.
   */
  const [homeNavSheetCartEligible, setHomeNavSheetCartEligible] = React.useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = React.useState(false);
  const [customerSearchSheetReady, setCustomerSearchSheetReady] = React.useState(false);
  const [customerSearchTyping, setCustomerSearchTyping] = React.useState(false);
  const [experienceSwitcherOpen, setExperienceSwitcherOpen] = React.useState(false);
  const [experienceSwitcherChromeHold, setExperienceSwitcherChromeHold] = React.useState(false);

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
    if (tabRef.current !== "home") navigateTab("home");
    setExperienceSwitcherOpen(false);
    setCustomerSearchOpen(false);
    setCustomerSearchSheetReady(false);
    setCustomerSearchTyping(false);
    setHomeNavSheetCartEligible(true);
    const { snapMid } = computeNavSheetSnapDims(Dimensions.get("window").height, insets);
    armNavSheetSnapImpact(snapMid + 3);
    sheetHeightSV.value = withSpring(snapMid + 3, SHEET_SPRING_CONFIG);
    setCartFabDeferred(true);
  }, [insets, sheetHeightSV, armNavSheetSnapImpact, navigateTab]);

  /** Customer top search — dedicated modal below the morphing search chip. */
  const openCustomerHomeSearch = React.useCallback(() => {
    Keyboard.dismiss();
    setCustomerSearchQuery("");
    setCustomerSearchSheetReady(false);
    setCustomerSearchTyping(false);
    setHomeNavSheetCartEligible(false);
    setExperienceSwitcherOpen(false);
    armNavSheetSnapImpact(0);
    sheetHeightSV.value = withTiming(0, { duration: 320, easing: Easing.inOut(Easing.cubic) });
    setCustomerSearchOpen(true);
  }, [armNavSheetSnapImpact, sheetHeightSV]);

  const closeCustomerHomeSearch = React.useCallback(() => {
    Keyboard.dismiss();
    setCustomerSearchOpen(false);
    setCustomerSearchSheetReady(false);
    setCustomerSearchTyping(false);
  }, []);

  const dismissCustomerSearchKeyboard = React.useCallback(() => {
    Keyboard.dismiss();
    setCustomerSearchTyping(false);
  }, []);

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

  const closeExperienceSwitcher = React.useCallback(() => {
    setExperienceSwitcherOpen(false);
  }, []);

  const releaseExperienceSwitcherChromeHold = React.useCallback(() => {
    setExperienceSwitcherChromeHold(false);
  }, []);

  const restoreAppChromeAfterSwitcher = React.useCallback(() => {
    appChromeDismissSV.value = withTiming(
      1,
      { duration: APP_CHROME_RESTORE_MS, easing: APP_CHROME_EASE },
      (finished) => {
        if (finished) runOnJS(releaseExperienceSwitcherChromeHold)();
      }
    );
  }, [appChromeDismissSV, releaseExperienceSwitcherChromeHold]);

  React.useEffect(() => {
    if (!experienceSwitcherOpen && !experienceSwitcherChromeHold) {
      appChromeDismissSV.value = 1;
    }
  }, [experienceSwitcherOpen, experienceSwitcherChromeHold, appChromeDismissSV]);

  React.useEffect(() => {
    const hideProfileBottomNav = !!token && !!mobileExperience && isProfileNavTab(tab) && !meStackAtRoot;
    profileBottomNavSV.value = withTiming(hideProfileBottomNav ? 0 : 1, {
      duration: APP_CHROME_DISMISS_MS,
      easing: APP_CHROME_EASE
    });
  }, [token, mobileExperience, tab, meStackAtRoot, profileBottomNavSV]);

  const openExperienceSwitcher = React.useCallback(() => {
    Keyboard.dismiss();
    setHomeNavSheetCartEligible(false);
    setCustomerSearchOpen(false);
    setCustomerSearchSheetReady(false);
    setCustomerSearchTyping(false);
    setVenueDirectoryRefreshKey((n) => n + 1);
    void refreshExperienceSwitcher();
    setExperienceSwitcherChromeHold(true);
    appChromeDismissSV.value = withTiming(0, {
      duration: APP_CHROME_DISMISS_MS,
      easing: APP_CHROME_EASE
    });
    setExperienceSwitcherOpen(true);
  }, [appChromeDismissSV, refreshExperienceSwitcher]);

  const closeNavSheetFully = React.useCallback(() => {
    armNavSheetSnapImpact(0);
    sheetHeightSV.value = withTiming(0, { duration: 520, easing: Easing.inOut(Easing.cubic) });
  }, [armNavSheetSnapImpact, sheetHeightSV]);

  const applyActiveExperience = React.useCallback(
    async (body: { mode: "CUSTOMER" } | { mode: "WORKSPACE"; restaurantId: string }) => {
      if (!token) return;
      setExperienceSwitchBusy(true);
      try {
        const res = await patchActiveExperience(token, body);
        if (!res.ok) {
          setStatus(res.error ?? "Could not switch experience");
          return;
        }
        setExperienceSwitcher(res.switcher);
        setSessionUser((u) =>
          u ? { ...u, roleType: res.experience.roleType, mobileExperience: res.experience } : u
        );
        if (res.workspace) setWorkspaceContext(res.workspace);
        else setWorkspaceContext(null);
        setExperienceSwitcherOpen(false);
        navigateTab(defaultNavTabKey(res.experience) as TabId);
        void refreshRestaurants(token);
      } finally {
        setExperienceSwitchBusy(false);
      }
    },
    [token, navigateTab]
  );

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
    lastScrollYRef.current = 0;
    bottomNavFocusSV.value = withTiming(1, BOTTOM_NAV_FOCUS_TIMING);
  }, [tab, scrollY, bottomNavFocusSV]);

  React.useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      Keyboard.dismiss();
      restoreBottomNavFocus();
      setChatThreadRestaurantId(null);
      navigateTab(homeTabKey);
    });
    return () => sub.remove();
  }, [token, homeTabKey, navigateTab, restoreBottomNavFocus]);

  React.useEffect(() => {
    if (!isChatNavTab(tab)) {
      setChatThreadRestaurantId(null);
    }
    if (isChatNavTab(tab) && !isChatNavTab(prevTabRef.current)) {
      tabBeforeChatRef.current = prevTabRef.current;
    }
    prevTabRef.current = tab;
  }, [tab]);

  const openCustomerChatThread = React.useCallback((restaurantId: string) => {
    const rid = restaurantId.trim();
    if (!rid) return;
    setChatThreadRestaurantId(rid);
  }, []);

  const exitCustomerChat = React.useCallback(() => {
    if (chatThreadRestaurantId) {
      setChatThreadRestaurantId(null);
      return;
    }
    navigateTab(tabBeforeChatRef.current || "home");
  }, [chatThreadRestaurantId, navigateTab]);

  React.useEffect(() => {
    if (tab !== "home") {
      setCustomerSearchOpen(false);
      setCustomerSearchSheetReady(false);
      setCustomerSearchTyping(false);
    }
  }, [tab]);

  const onSplashDismiss = React.useCallback(() => setShowSplash(false), []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadClientConfig();
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
    void refreshExperienceSwitcher(jwt);
    return user;
  }, [refreshExperienceSwitcher]);

  const completeAuthSession = React.useCallback(
    async ({ token: jwt }: { token: string; user: AuthUser }) => {
      const meUser = await warmAuthenticatedSession(jwt);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, jwt);
      setToken(jwt);
      setUserRole(meUser.role);
      const exp = meUser.mobileExperience ?? (await fetchMobileExperience(jwt));
      if (exp) setTab(homeNavTabKey(exp) as TabId);
      setStatus("");
      void syncDevicePushTokenWithBackend(jwt);
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
            if (user.mobileExperience) setTab(homeNavTabKey(user.mobileExperience) as TabId);
            void syncDevicePushTokenWithBackend(stored);
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

  async function ensureOrderingSession(restaurantId: string) {
    const rid = restaurantId.trim();
    if (!rid) return null;
    if (orderingSessionId && orderingSessionVenueId === rid) {
      void touchOrderingSession(orderingSessionId);
      return orderingSessionId;
    }
    const res = await createGuestOrderingSession(rid, { paymentMode: "PAY_AT_VENUE" });
    if (res.ok && res.session?.id) {
      setOrderingSessionId(res.session.id);
      setOrderingSessionVenueId(rid);
      return res.session.id;
    }
    return null;
  }

  async function fetchPublicMenuForRestaurant(restaurantId: string) {
    const rid = restaurantId.trim();
    const sessionId = await ensureOrderingSession(rid);
    const path = sessionId
      ? `/ordering-sessions/${encodeURIComponent(sessionId)}/menu`
      : `/restaurants/public/menu/${encodeURIComponent(rid)}`;
    return apiFetch<Record<string, unknown> & { ok?: boolean; error?: string }>(path);
  }

  React.useEffect(() => {
    if (!token || !isCustomerSession) return;
    let cancelled = false;

    async function clearStaleVenue() {
      await AsyncStorage.removeItem(CUSTOMER_VENUE_KEY);
      if (!cancelled) {
        setMenuRid("");
        setMenuPreview(null);
        setLocalCart([]);
      }
    }

    void (async () => {
      const serverPref =
        typeof sessionUser?.preferredRestaurantId === "string"
          ? sessionUser.preferredRestaurantId.trim()
          : "";
      const local = ((await AsyncStorage.getItem(CUSTOMER_VENUE_KEY)) ?? "").trim();
      const rid = serverPref || local;
      if (!rid || cancelled) return;

      const directoryRes = await apiFetch<{ ok: boolean; restaurants?: CustomerRestaurantRow[] }>(
        "/customer/restaurant-directory",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (cancelled) return;

      const directory = directoryRes.ok ? (directoryRes.restaurants ?? []) : [];
      if (directory.length > 0 && isStalePreferredVenue(rid, directory)) {
        await clearStaleVenue();
        return;
      }

      if (serverPref && serverPref !== local) {
        await AsyncStorage.setItem(CUSTOMER_VENUE_KEY, serverPref);
      }
      if (!cancelled) {
        setMenuRid(rid);
        setCustomerMenuLoadState("loading");
      }
      const res = await fetchPublicMenuForRestaurant(rid);
      if (cancelled) return;
      if (!res.ok) {
        if (!cancelled) {
          setMenuPreview({ ok: false, error: res.error ?? "menu_failed" });
          setCustomerMenuLoadState("error");
          setStatus("");
        }
        return;
      }
      setMenuPreview(res);
      setCustomerMenuLoadState("ready");
      setLocalCart([]);
      setStatus("");
      void refreshCustomerCart(rid);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isCustomerSession, sessionUser?.preferredRestaurantId, refreshCustomerCart]);

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
      setCustomerMenuLoadState("loading");
      await AsyncStorage.setItem(CUSTOMER_VENUE_KEY, rid);
      setMenuRid(rid);
      setTrackResult(null);
      setMenuPrefsSeq((x) => x + 1);
      setOrderingSessionId(null);
      setOrderingSessionVenueId(null);
      const res = await fetchPublicMenuForRestaurant(rid);
      if (res.ok) {
        setMenuPreview(res);
        setLocalCart([]);
        setOptimisticMarkedMenuIds(new Set());
        setStatus("");
        setCustomerMenuLoadState("ready");
      } else {
        setMenuPreview({ ok: false, error: res.error ?? "menu_failed" });
        setStatus(formatApiError(res.error));
        setCustomerMenuLoadState("error");
        throw new Error(res.error ?? "menu_failed");
      }
      await refreshCustomerCart(rid);
      await invalidateRestaurantDirectory(sessionUser?.id);
      const me = await authMe(token);
      if (me.ok && me.user) setSessionUser(me.user);
    },
    [token, refreshCustomerCart, sessionUser?.id]
  );

  const onExperienceVenueHydrated = React.useCallback(
    async (restaurantId: string) => {
      await applyCustomerVenueChange(restaurantId);
      setExperienceSwitcherOpen(false);
      closeNavSheetFully();
      setCustomerSearchQuery("");
      setHomeNavSheetCartEligible(false);
      Keyboard.dismiss();
      restoreBottomNavFocus();
      navigateTab("home");
      setVenueDirectoryRefreshKey((n) => n + 1);
      void refreshExperienceSwitcher();
    },
    [applyCustomerVenueChange, closeNavSheetFully, restoreBottomNavFocus, refreshExperienceSwitcher, navigateTab]
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
      const sessionId = await ensureOrderingSession(rid);
      const placeBody: Record<string, unknown> = {
        restaurantId: rid,
        fromCart: true,
        note: noteTrim
      };
      if (sessionId) {
        placeBody.sourceSessionId = sessionId;
        placeBody.sourceSessionType = "LINK";
      }
      setPlacingOrder(true);
    const res = await apiFetch<Record<string, unknown> & { ok?: boolean; error?: string; order?: { id?: string } }>(
      "/orders/place",
      {
        method: "POST",
        headers,
        body: JSON.stringify(placeBody)
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
      navigateTab("orders");
      setTrackId(placed.id ?? "");
      return;
    }

    if (localCart.length === 0) return setStatus("Need restaurant + cart");

    lineIdsSnapshot = localCart.map((l) => l.menuItemId);
    const sessionId = await ensureOrderingSession(rid);
    const guestBody: Record<string, unknown> = {
      restaurantId: rid,
      note: noteTrim
    };
    if (sessionId) {
      guestBody.fromSessionCart = true;
      guestBody.sourceSessionId = sessionId;
      guestBody.sourceSessionType = "LINK";
    } else {
      guestBody.lines = localCart.map((l) => ({
        menuItemId: l.menuItemId,
        quantity: l.quantity,
        modifierOptionIds: l.modifierOptionIds.length ? l.modifierOptionIds : undefined
      }));
    }
    setPlacingOrder(true);
    const res = await apiFetch<Record<string, unknown> & { ok?: boolean; error?: string; order?: { id?: string; status?: string; paymentStatus?: string; totalCents?: number } }>("/orders/place", {
      method: "POST",
      headers,
      body: JSON.stringify(guestBody)
    });
    setPlacingOrder(false);
    if (!res.ok) return setStatus(res.error ?? "order_failed");
    const placed = res.order;
    if (placed?.status === "PENDING_PAYMENT" && placed.id) {
      const checkout = await startOrderCheckout(placed.id, "swish");
      if (checkout.ok) {
        setActionModal({
          visible: true,
          title: "Complete payment",
          message: checkout.checkout?.instructions ?? "Open Swish and approve the payment.",
          primaryLabel: "I paid",
          onPrimary: () => {
            void completeOrderCheckout(placed.id!, "swish").then(() => {
              setActionModal((p) => ({ ...p, visible: false }));
              setStatus("Payment confirmed");
            });
          },
          secondaryLabel: "Later",
          onSecondary: () => setActionModal((p) => ({ ...p, visible: false }))
        });
      }
    }
    void recordOrderedItemsForRestaurant(rid, lineIdsSnapshot, token);
    setMenuPrefsSeq((x) => x + 1);
    setStatus("Order placed");
    setLocalCart([]);
    setOrderNote("");
    navigateTab("orders");
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
  async function addMenuLineFromBrowse(menuItemId: string, modifierOptionIds: string[] = []) {
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
            navigateTab(profileTabKey);
          },
          secondaryLabel: "Dismiss",
          onSecondary: () => setActionModal((p) => ({ ...p, visible: false }))
        });
        return;
      }

      setLocalCart((c) => [...c, { menuItemId, quantity: 1, modifierOptionIds }]);
      setOptimisticCartQty((q) => q + 1);

      if (rid) {
        const sessionId = await ensureOrderingSession(rid);
        if (sessionId) {
          const res = await addSessionCartItem(sessionId, { menuItemId, quantity: 1, modifierOptionIds });
          if (!res.ok) {
            setStatus(res.error ?? "cart_add_failed");
            return;
          }
          setLocalCart(
            (res.lines ?? []).map((l) => ({
              menuItemId: l.menuItemId,
              quantity: l.quantity,
              modifierOptionIds: l.modifierOptionIds ?? []
            }))
          );
          setOptimisticCartQty(res.totalQuantity ?? 0);
          setStatus("Added to cart");
          return;
        }
      }

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

  const customerHasVenue = Boolean(activeRestaurantId().trim());
  const customerVenueNoMenu = customerHasVenue && venueHasNoBrowsableMenu(menuPreview);
  const customerHasBrowsableMenu = customerHasVenue && menuHasBrowsableItems(menuPreview);
  const customerHomeVenueLoadFailed = customerHasVenue && customerMenuLoadState === "error";

  const customerHomeHeader = React.useMemo(() => {
    const firstName = customerDisplayName(sessionUser?.signupProfile, sessionUser?.email ?? undefined);
    const venueName =
      menuPreview?.ok && menuPreview.restaurant?.name ? String(menuPreview.restaurant.name) : null;
    return buildCustomerHomeHeader({
      firstName,
      restaurantName: venueName,
      cartCount: isCustomerSession ? customerCart.totalQuantity : localCart.reduce((s, l) => s + l.quantity, 0),
      hasVenue: customerHasVenue,
      hasBrowsableMenu: !customerVenueNoMenu,
      userRoleExperience: formatUserRoleExperience(mobileExperience?.activeExperience)
    });
  }, [
    sessionUser?.signupProfile,
    sessionUser?.email,
    menuPreview,
    isCustomerSession,
    customerCart.totalQuantity,
    localCart,
    customerHasVenue,
    customerVenueNoMenu,
    mobileExperience?.activeExperience
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
      navigateTab("orders");
    }
  }, [menuPreview, customerScrollToMenu, navigateTab]);

  const customerPopularPicks = React.useCallback(() => {
    if (menuPreview?.ok && menuPreview.restaurant) {
      customerScrollToMenu(96);
    } else {
      navigateTab("orders");
    }
  }, [menuPreview, customerScrollToMenu, navigateTab]);

  const customerHomeHasMenuBody = React.useMemo(() => {
    if (!isCustomerSession) return false;
    return menuHasBrowsableItems(menuPreview);
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
        <AppConnectSkeleton hint="Connecting…" sub="Reconnecting to ServeOS" />
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
  const meCompactTopPad = insets.top + 8;
  const hideProfileSubpageTopNav = !!token && mobileExperience && isProfileNavTab(tab) && !meStackAtRoot;
  const hideChromeForChat = isCustomerSession && isChatNavTab(tab) && !!chatThreadRestaurantId;
  const hideChromeForProfileSubpage = hideProfileSubpageTopNav;
  const profileStackBottomInset = hideChromeForProfileSubpage
    ? homeScrollBottomInset(insets.bottom)
    : scrollBottom;
  const hideChromeForExperienceSwitcher = experienceSwitcherChromeHold;
  const hideAppChrome = hideChromeForExperienceSwitcher || hideChromeForChat;
  const showHomeTopNav = tab === "home" && !hideProfileSubpageTopNav && !hideChromeForChat;
  const scrollTopPad = showHomeTopNav
    ? isCustomerSession
      ? homeContentTopInset(insets.top)
      : contentTopInset(insets.top)
    : contentTopInsetWithoutTopNav(insets.top);
  const homeMenuOverlayTop = scrollTopPad + customerHomeHeroH;
  const homeMenuOverlayBottom = floatingDockBottomY(insets.bottom) + FLOATING_TAB_BAR_HEIGHT;

  const profileVenueDisplayName = isCustomerSession
    ? customerVenueDisplayName
    : experienceSwitcher?.activeWorkspace?.restaurantName ??
      workspaceContext?.memberships.find((m) => m.restaurantId === workspaceRestaurantId)?.restaurantName ??
      "Workspace";

  const pageTitle = navTabLabel(mobileExperience, tab) ?? "ServeOS";

  const leftLabel =
    mobileExperience?.activeExperience?.label ??
    (experienceSwitcher?.customerMode.selected
      ? "Customer"
      : experienceSwitcher?.activeWorkspace?.restaurantName ??
        (menuPreview?.ok && menuPreview.restaurant?.name ? String(menuPreview.restaurant.name) : null) ??
        (restaurants[0]?.name ? String(restaurants[0]?.name) : null) ??
        "ServeOS");

  const leftSubLabel =
    mobileExperience?.activeExperience?.roleLabel ??
    (experienceSwitcher?.activeWorkspace && !experienceSwitcher.customerMode.selected
      ? experienceSwitcher.activeWorkspace.roleLabel
      : undefined);

  /** Home only: full-width menu rails. Orders keeps normal horizontal padding so layout matches other tabs. */
  const customerScreenEdgeBleed = isCustomerSession && tab === "home";
  /** Empty Orders: pause cart bounce + CTA rotation when tab hidden or any overlay/modal is open. */
  const ordersTabCartVisible =
    tab === "orders" && isCustomerSession && transition === null && !hideAppChrome;
  const ordersScreenDistractionOpen =
    customerSearchOpen ||
    sheetBackdropActive ||
    actionModal.visible ||
    experienceSwitcherOpen ||
    nutritionOpen ||
    Boolean(menuDetailItem) ||
    errorModalVisible;
  const ordersEmptyMotionPaused = !ordersTabCartVisible || ordersScreenDistractionOpen;

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
        <BottomNavScrollReporter report={reportContentScroll}>
        <View style={styles.tabStage}>
          <TabTransitionPanel
            tabKey="home"
            activeTab={tab}
            tabOrder={tabOrderKeys}
            transition={transition}
            progress={progress}
            width={tabTransitionWidth}
          >
            <>
              <Animated.ScrollView
                ref={isCustomerSession ? (customerHomeScrollRef as React.RefObject<any>) : undefined}
                style={styles.scrollLayer}
                onScroll={onScroll}
                onScrollEndDrag={onScrollEnd}
                onMomentumScrollEnd={onScrollEnd}
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
                    <View
                      style={styles.customerHomeCopyInset}
                      onLayout={(e) => setCustomerHomeHeroH(e.nativeEvent.layout.height)}
                    >
                      <Text style={styles.customerHeroGreeting}>{customerHomeHeader.greeting}</Text>
                      <Text style={styles.customerHeroSub}>{customerHomeHeader.sub}</Text>
                      <View style={styles.customerCtaColumn}>
                        {customerHasVenue ? (
                          <>
                            <Pressable
                              style={({ pressed }) => [styles.pillPrimary, styles.customerPrimaryCta, pressed && styles.pressed]}
                              onPress={customerVenueNoMenu ? openExperienceSwitcher : customerStartOrdering}
                            >
                              <Text style={styles.pillPrimaryText}>
                                {customerVenueNoMenu ? "Switch venue" : "Start ordering"}
                              </Text>
                            </Pressable>
                            {customerHasBrowsableMenu ? (
                              <Pressable
                                style={({ pressed }) => [pressed && styles.pressed, { alignSelf: "center" }]}
                                onPress={customerPopularPicks}
                              >
                                <Text style={styles.customerSecondaryCta}>Popular picks</Text>
                              </Pressable>
                            ) : null}
                          </>
                        ) : (
                          <Pressable
                            style={({ pressed }) => [styles.pillPrimary, styles.customerPrimaryCta, pressed && styles.pressed]}
                            onPress={openExperienceSwitcher}
                          >
                            <Text style={styles.pillPrimaryText}>Choose a venue</Text>
                          </Pressable>
                        )}
                      </View>

                      {customerHomeHasMenuBody ? (
                        <Text style={[styles.sectionLabel, styles.mtSm]}>Menu</Text>
                      ) : null}
                    </View>
                    {menuPreview?.ok && menuPreview.restaurant && menuHasBrowsableItems(menuPreview) ? (
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
                          onOpenItem={(it) => setMenuDetailItem(it)}
                        />
                      </View>
                    ) : null}

                    {status && customerHasVenue ? (
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
                          onPress={() => navigateTab("orders")}
                        >
                          <Text style={styles.pillPrimaryText}>Order food</Text>
                        </Pressable>
                        <Pressable style={({ pressed }) => [styles.pillGhost, pressed && styles.pressed]} onPress={() => navigateTab(profileTabKey)}>
                          <Text style={styles.pillGhostText}>Account</Text>
                        </Pressable>
                      </View>
                    </View>

                    <Text style={styles.sectionLabel}>Quick actions</Text>
                    <View style={styles.tileRow}>
                      <Pressable style={({ pressed }) => [styles.cardShell, styles.tile, pressed && styles.pressed]} onPress={() => navigateTab(profileTabKey)}>
                        <Text style={styles.tileEmoji}>✦</Text>
                        <Text style={styles.tileTitle}>Venues</Text>
                        <Text style={styles.tileSub}>Manage your restaurants</Text>
                      </Pressable>
                      <Pressable style={({ pressed }) => [styles.cardShell, styles.tile, pressed && styles.pressed]} onPress={() => navigateTab("orders")}>
                        <Text style={styles.tileEmoji}>◎</Text>
                        <Text style={styles.tileTitle}>Track order</Text>
                        <Text style={styles.tileSub}>Status without login</Text>
                      </Pressable>
                    </View>

                    {status ? <Text style={styles.banner}>{status}</Text> : null}
                  </>
                )}
              </Animated.ScrollView>
              {isCustomerSession && customerHomeVenueLoadFailed ? (
                <CustomerHomeVenueLoadError
                  top={homeMenuOverlayTop}
                  bottom={homeMenuOverlayBottom}
                  onSwitchVenue={openExperienceSwitcher}
                />
              ) : null}
            </>
          </TabTransitionPanel>

          {isCustomerSession ? (
            <>
              <TabTransitionPanel
                tabKey="bookings"
                activeTab={tab}
                tabOrder={tabOrderKeys}
                transition={transition}
                progress={progress}
                width={tabTransitionWidth}
              >
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
                  onScrollEndDrag={onScrollEnd}
                  onMomentumScrollEnd={onScrollEnd}
                  scrollTopPad={scrollTopPad}
                  scrollBottom={scrollBottom}
                  onChooseVenue={openExperienceSwitcher}
                  onOpenChat={() => navigateTab(chatTabKey)}
                  onExitToHome={() => navigateTab("home")}
                  onResetScroll={resetBookingsScroll}
                  onRestoreScroll={restoreBookingsScroll}
                  onReservationsChanged={() => void refreshCustomerAppContext()}
                />
              </TabTransitionPanel>

              <TabTransitionPanel
                tabKey="orders"
                activeTab={tab}
                tabOrder={tabOrderKeys}
                transition={transition}
                progress={progress}
                width={tabTransitionWidth}
              >
                {!pickActiveOrder(myOrders as CustomerMineOrder[], activeRestaurantId().trim()) ? (
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
                      venueSwitchLocked={false}
                      onVenueHydrated={applyCustomerVenueChange}
                      onVenueSwitchError={(message) => setStatus(message)}
                      onChooseVenue={openExperienceSwitcher}
                      hasBrowsableMenu={!customerVenueNoMenu}
                      onSwitchVenue={openExperienceSwitcher}
                      customerOrders={myOrders as CustomerMineOrder[]}
                      money={money}
                      onBrowseMenu={() => {
                        navigateTab("home");
                        setTimeout(() => customerScrollToMenu(0), 400);
                      }}
                      onNeedHelp={() => navigateTab(chatTabKey)}
                      onOrdersRefresh={() => void fetchMyOrders({ force: true })}
                      cartItemCount={customerCart.totalQuantity}
                      menuPrefsVersion={menuPrefsSeq}
                      ordersEmptySessionVisits={ordersEmptySessionVisitCount}
                      emptyMotionPaused={ordersEmptyMotionPaused}
                      cartMotionActive={ordersTabCartVisible}
                    />
                  </Animated.View>
                ) : (
                  <Animated.ScrollView
                    style={styles.scrollLayer}
                    onScroll={onScroll}
                    onScrollEndDrag={onScrollEnd}
                    onMomentumScrollEnd={onScrollEnd}
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
                      venueSwitchLocked={false}
                      onVenueHydrated={applyCustomerVenueChange}
                      onVenueSwitchError={(message) => setStatus(message)}
                      onChooseVenue={openExperienceSwitcher}
                      hasBrowsableMenu={!customerVenueNoMenu}
                      onSwitchVenue={openExperienceSwitcher}
                      customerOrders={myOrders as CustomerMineOrder[]}
                      money={money}
                      onBrowseMenu={() => {
                        navigateTab("home");
                        setTimeout(() => customerScrollToMenu(0), 400);
                      }}
                      onNeedHelp={() => navigateTab(chatTabKey)}
                      onOrdersRefresh={() => void fetchMyOrders({ force: true })}
                      cartItemCount={customerCart.totalQuantity}
                      menuPrefsVersion={menuPrefsSeq}
                      ordersEmptySessionVisits={ordersEmptySessionVisitCount}
                      emptyMotionPaused={ordersEmptyMotionPaused}
                      cartMotionActive={ordersTabCartVisible}
                    />
                  </Animated.ScrollView>
                )}
              </TabTransitionPanel>

              <TabTransitionPanel
                tabKey={chatTabKey}
                activeTab={tab}
                tabOrder={tabOrderKeys}
                transition={transition}
                progress={progress}
                width={tabTransitionWidth}
              >
                {chatThreadRestaurantId ? (
                  <CustomerChatScreen
                    token={token}
                    restaurantId={chatThreadRestaurantId}
                    userId={sessionUser?.id}
                    money={money}
                    scrollY={scrollY}
                    onScroll={onScroll}
                    onScrollEndDrag={onScrollEnd}
                    onMomentumScrollEnd={onScrollEnd}
                    chatFocused={isChatNavTab(tab)}
                    onBack={exitCustomerChat}
                    onUnreadCountChange={(n) => {
                      setChatUnreadCount(n);
                      void setChatBadgeCount(n);
                    }}
                    onViewMenu={() => {
                      setChatThreadRestaurantId(null);
                      navigateTab("home");
                      setTimeout(() => customerScrollToMenu(0), 400);
                    }}
                    onPopularItems={customerPopularPicks}
                    onOpenCart={() => {
                      setChatThreadRestaurantId(null);
                      navigateTab("home");
                      setTimeout(() => openCartSheetHalf(), 400);
                    }}
                    onPlaceOrder={() => {
                      setChatThreadRestaurantId(null);
                      navigateTab("home");
                      setTimeout(() => openCartSheetHalf(), 400);
                    }}
                    onReorder={() => {
                      setChatThreadRestaurantId(null);
                      navigateTab("home");
                      setTimeout(() => customerScrollToMenu(0), 400);
                    }}
                    hasBrowsableMenu={!customerVenueNoMenu}
                    venueDisplayName={customerVenueDisplayName}
                    onSwitchVenue={openExperienceSwitcher}
                  />
                ) : (
                  <CustomerChatOverviewScreen
                    token={token}
                    scrollY={scrollY}
                    onScroll={onScroll}
                    onScrollEndDrag={onScrollEnd}
                    onMomentumScrollEnd={onScrollEnd}
                    focused={isChatNavTab(tab)}
                    onOpenThread={openCustomerChatThread}
                    onUnreadCountChange={(n) => {
                      setChatUnreadCount(n);
                      void setChatBadgeCount(n);
                    }}
                  />
                )}
              </TabTransitionPanel>
            </>
          ) : null}

          {mobileExperience && !isCustomerSession
            ? staffWorkspaceTabKeys.map((staffTabKey) => (
                <TabTransitionPanel
                  key={staffTabKey}
                  tabKey={staffTabKey}
                  activeTab={tab}
                  tabOrder={tabOrderKeys}
                  transition={transition}
                  progress={progress}
                  width={tabTransitionWidth}
                >
                  <RoleNavTabPanel
                    tabKey={staffTabKey}
                    mobileExperience={mobileExperience}
                    authToken={token}
                    workspaceContext={workspaceContext}
                    workspaceRestaurantId={workspaceRestaurantId}
                    onSelectVenue={(id) => void setWorkspaceVenue(id)}
                    scrollTopPad={scrollTopPad}
                    scrollBottom={scrollBottom}
                    onScroll={onScroll}
                    onScrollEndDrag={onScrollEnd}
                    onMomentumScrollEnd={onScrollEnd}
                    onNavigateTab={navigateTab}
                    onSignOut={() => void customerSignOut()}
                  />
                </TabTransitionPanel>
              ))
            : null}

          <TabTransitionPanel
            tabKey={profileTabKey}
            activeTab={tab}
            tabOrder={tabOrderKeys}
            transition={transition}
            progress={progress}
            width={tabTransitionWidth}
          >
            {mobileExperience ? (
              <View style={styles.scrollLayer}>
                <CustomerMeStack
                  topInset={scrollTopPad}
                  compactTopInset={meCompactTopPad}
                  bottomInset={profileStackBottomInset}
                  user={sessionUser}
                  authToken={token}
                  mobileExperience={mobileExperience}
                  workspaceRestaurantId={workspaceRestaurantId}
                  venueName={profileVenueDisplayName}
                  activeOrderCount={isCustomerSession ? activeOrderCount : 0}
                  onOpenOrders={() => navigateTab("orders")}
                  onOpenSupport={() => navigateTab(chatTabKey)}
                  onChooseExperience={openExperienceSwitcher}
                  onSignOut={() => void customerSignOut()}
                  onAvatarSaved={setMeAvatarUri}
                  onAtRootChange={setMeStackAtRoot}
                />
              </View>
            ) : (
              <Animated.ScrollView
                style={styles.scrollLayer}
                onScroll={onScroll}
                onScrollEndDrag={onScrollEnd}
                onMomentumScrollEnd={onScrollEnd}
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
            )}
          </TabTransitionPanel>
        </View>
        </BottomNavScrollReporter>
      </View>

      {showHomeTopNav ? (
        <Reanimated.View
          style={[styles.appChromeTopLayer, appChromeDismissStyleTop]}
          pointerEvents={experienceSwitcherChromeHold ? "none" : "box-none"}
        >
          {!(isCustomerSession && customerSearchOpen) ? (
            <NavTopScrim topInset={insets.top} customerHome={isCustomerSession} />
          ) : null}
          {isCustomerSession ? (
            <FloatingTopBar
              variant="customer"
              topInset={insets.top}
              searchOpenSV={customerSearchOpenSV}
              searchValue={customerSearchQuery}
              onSearchChange={setCustomerSearchQuery}
              searchPlaceholder="Search dishes, drinks…"
              searchModalOpen={customerSearchOpen}
              searchSheetReady={customerSearchSheetReady}
              searchTypingActive={customerSearchTyping}
              onSearchExpandSheet={openCustomerHomeSearch}
              onSearchFocusRequest={() => setCustomerSearchTyping(true)}
              onSearchBlur={dismissCustomerSearchKeyboard}
              onSearchSubmit={() => void appendNavSearchRecent(customerSearchQuery.trim())}
              onExperienceSwitcher={openExperienceSwitcher}
            />
          ) : (
            <FloatingTopBar
              topInset={insets.top}
              leftLabel={leftLabel}
              leftSubLabel={leftSubLabel}
              centerTitle={pageTitle}
              onLeftPress={openExperienceSwitcher}
              onSearch={() => setStatus("search")}
              onExperienceSwitcher={openExperienceSwitcher}
            />
          )}
        </Reanimated.View>
      ) : null}

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
            active={displayCartQty > 0 && !cartFabDeferred && !customerSearchOpen && !(sheetBackdropActive && !homeNavSheetCartEligible)}
            bumpKey={cartFabBump}
            totalQuantity={displayCartQty}
            bottomOffset={floatingDockBottomY(insets.bottom) + FLOATING_TAB_BAR_HEIGHT + 12}
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
      <MenuItemDetailSheet
        visible={Boolean(menuDetailItem)}
        item={menuDetailItem}
        money={money}
        onClose={() => setMenuDetailItem(null)}
        onAddToCart={(it, modifierOptionIds) => {
          void addMenuLineFromBrowse(it.id, modifierOptionIds ?? []);
          setMenuDetailItem(null);
        }}
        adding={menuDetailItem ? !!addingById[menuDetailItem.id] : false}
      />

      <NavExpandSheetHost
        insets={insets}
        sheetHeightSV={sheetHeightSV}
        snapImpactTargetSV={snapImpactTargetSV}
        snapImpactArmedSV={snapImpactArmedSV}
        sheetContent={sheetCartPanel ?? undefined}
      />

      {customerSearchOpen && customerSearchTyping ? (
        <Pressable
          style={styles.searchKeyboardDismissLayer}
          onPress={dismissCustomerSearchKeyboard}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
        />
      ) : null}

      {token && isCustomerSession && tab === "home" ? (
        <CustomerHomeSearchModal
          visible={customerSearchOpen}
          onDismiss={closeCustomerHomeSearch}
          onOpened={() => setCustomerSearchSheetReady(true)}
          onClosed={() => {
            setCustomerSearchSheetReady(false);
            setCustomerSearchTyping(false);
          }}
          searchOpenSV={customerSearchOpenSV}
          onDismissKeyboard={dismissCustomerSearchKeyboard}
        >
          {menuPreview?.ok ? (
            <CustomerNavSearchSheet
              surface="dock"
              restaurantId={activeRestaurantId()}
              categories={(menuPreview.categories ?? []) as MenuCategoryLite[]}
              money={money}
              searchQuery={customerSearchQuery}
              onSearchChange={setCustomerSearchQuery}
              onAddItem={(it) => void addMenuLineFromBrowse(it.id)}
              addingItemIds={addingById}
              markedMenuItemIds={markedMenuItemIds}
              onDismissKeyboard={dismissCustomerSearchKeyboard}
            />
          ) : (
            <CustomerNavSearchSheetSkeleton />
          )}
        </CustomerHomeSearchModal>
      ) : null}

      {!hideChromeForChat ? (
        <Reanimated.View
          style={[styles.appChromeBottomLayer, appChromeDismissStyleBottom]}
          pointerEvents={
            hideChromeForProfileSubpage || experienceSwitcherChromeHold ? "none" : "box-none"
          }
        >
          <NavBottomScrim bottomNavFocusSV={bottomNavFocusSV} />
          <FloatingGlassTabBar
            tab={tab}
            onChange={(next) => {
              Keyboard.dismiss();
              restoreBottomNavFocus();
              navigateTab(next);
            }}
            insets={insets}
            bottomNavFocusSV={bottomNavFocusSV}
            onDockPress={restoreBottomNavFocus}
            messagesUnreadCount={chatUnreadCount}
            ordersActiveCount={ordersTabBadgeCount}
            bookingsUpcomingCount={bookTabBadgeCount}
            meAvatarUri={meAvatarUri}
            navTabs={navTabs}
          />
        </Reanimated.View>
      ) : null}

      {token ? (
        <ExperienceSwitcherModal
          visible={experienceSwitcherOpen}
          onDismiss={closeExperienceSwitcher}
          authToken={token}
          switcher={experienceSwitcher}
          busy={experienceSwitchBusy}
          userId={sessionUser?.id}
          userDisplayName={customerDisplayName(sessionUser?.signupProfile, sessionUser?.email ?? undefined)}
          userEmail={sessionUser?.email}
          activeVenueId={activeRestaurantId()}
          activeVenueName={
            menuPreview?.ok &&
            menuPreview.restaurant &&
            String(menuPreview.restaurant.id).trim() === activeRestaurantId().trim()
              ? String(menuPreview.restaurant.name ?? "")
              : ""
          }
          venueSwitchLocked={false}
          directoryRefreshKey={venueDirectoryRefreshKey}
          onVenueHydrated={onExperienceVenueHydrated}
          onVenueSwitchError={(message: string) => setStatus(message)}
          onSelectCustomer={() => void applyActiveExperience({ mode: "CUSTOMER" })}
          onSelectWorkspace={(restaurantId: string) =>
            void applyActiveExperience({ mode: "WORKSPACE", restaurantId })
          }
          onJoined={() => {
            if (!token) return;
            void fetchMobileExperience(token).then((experience) => {
              if (!experience) return;
              setSessionUser((u) =>
                u ? { ...u, roleType: experience.roleType, mobileExperience: experience } : u
              );
            });
            void refreshExperienceSwitcher();
            void refreshWorkspaceContext();
            void refreshRestaurants(token);
          }}
          onClosed={restoreAppChromeAfterSwitcher}
        />
      ) : null}
    </Animated.View>
  );
}

