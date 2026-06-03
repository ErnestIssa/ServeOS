import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type CustomerRestaurantRow } from "../api";
import { loadRestaurantDirectoryCached } from "../data/customerDataCache";
import { ScreenErrorState, formatAppError } from "../errors";
import { R } from "../theme";
import { FLOATING_TOP_BAR_HEIGHT } from "../shell/FloatingTopBar";
import { contentBottomInset } from "../shell/navBottomMetrics";
import { getServeosDemoPublicMenu, SERVEOS_DEMO_RESTAURANT_ID } from "./demoPeakModeMenu";
import { CustomerOrderTrackingSection, pickActiveOrder, type CustomerMineOrder } from "./CustomerOrderTrackingSection";
import { CustomerVenueActionsModal } from "./CustomerVenueActionsModal";
import { EmptyOrdersCartAnimation } from "./EmptyOrdersCartAnimation";
import { EmptyOrdersCtaSection } from "./EmptyOrdersCtaSection";
import { isVenueOpenNow, useVenueClockTick } from "./venueOpenNow";

type Props = {
  token: string;
  userId?: string | null;
  userDisplayName: string;
  /** Venue currently driving menus & cart across the app. */
  activeId: string;
  activeName: string;
  /** When true (demo menu env), venue switching in the modal is disabled — layout stays identical. */
  venueSwitchLocked: boolean;
  /** Persist new venue everywhere (menus, cart, profile). Caller may bump keys / reload shell. */
  onVenueHydrated: (restaurantId: string) => Promise<void>;
  /** Customer’s orders from `GET /orders/mine` (same list as app shell). */
  customerOrders: CustomerMineOrder[];
  money: (cents: number) => string;
  onBrowseMenu: () => void;
  onNeedHelp: () => void;
  /** Empty-state CTA: server cart lines (customer session). */
  cartItemCount?: number;
  /** Bumps when menu hearts change so empty Orders CTA reloads prefs. */
  menuPrefsVersion?: number;
  /** How many times user landed on empty Orders this session (tab entries). */
  ordersEmptySessionVisits?: number;
  /** Pauses empty-state cart bounce + rotating CTA (e.g. search sheet open). */
  emptyMotionPaused?: boolean;
};

export function CustomerOrdersVenueScreen(props: Props) {
  const {
    token,
    userId,
    userDisplayName,
    activeId,
    activeName,
    venueSwitchLocked,
    onVenueHydrated,
    customerOrders,
    money,
    onBrowseMenu,
    onNeedHelp,
    cartItemCount = 0,
    menuPrefsVersion = 0,
    ordersEmptySessionVisits = 0,
    emptyMotionPaused = false
  } = props;
  const clock = useVenueClockTick(30000);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = React.useState<CustomerRestaurantRow[] | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [directoryRetryTick, setDirectoryRetryTick] = React.useState(0);
  const [venueModalOpen, setVenueModalOpen] = React.useState(false);
  const [phraseLandTick, setPhraseLandTick] = React.useState(0);

  const aid = activeId.trim();
  const activeOrderForPage = React.useMemo(
    () => pickActiveOrder(customerOrders, aid),
    [customerOrders, aid]
  );

  React.useEffect(() => {
    if (!token || !activeOrderForPage) return;
    let cancelled = false;
    setLoadErr(null);
    void (async () => {
      try {
        const list = await loadRestaurantDirectoryCached(token, userId, (cached) => {
          if (!cancelled) setRows(cached);
        });
        if (!cancelled) setRows(list);
      } catch {
        if (!cancelled) {
          setRows([]);
          setLoadErr("directory_failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, userId, activeOrderForPage, directoryRetryTick]);

  const currentRow = React.useMemo(
    () => (rows && activeId ? rows.find((r) => r.id === activeId.trim()) : undefined),
    [rows, activeId]
  );

  const demoNameFallback =
    aid === SERVEOS_DEMO_RESTAURANT_ID ? String(getServeosDemoPublicMenu().restaurant.name ?? "Demo venue") : "Your venue";
  const displayVenueName =
    (currentRow?.name ?? activeName).trim() || (aid ? demoNameFallback : "No venue yet");

  const hoursSource = currentRow?.openingHours ?? null;
  const cardBusy = rows === null;
  const openNow = isVenueOpenNow(hoursSource, clock);

  const modalActive = React.useMemo(
    () => ({
      id: aid,
      name: displayVenueName,
      openingHours: currentRow?.openingHours ?? null
    }),
    [aid, displayVenueName, currentRow?.openingHours]
  );

  function openVenueModal() {
    if (!aid && !venueSwitchLocked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVenueModalOpen(true);
  }

  const cardDisabled = !aid && !venueSwitchLocked;

  const ordersEmptyMinHeight = React.useMemo(() => {
    const scrollBottom = contentBottomInset(insets.bottom);
    const scrollTopPad = R.space.sm + insets.top + FLOATING_TOP_BAR_HEIGHT + 18;
    return Math.max(320, windowHeight - scrollTopPad - scrollBottom);
  }, [windowHeight, insets.top, insets.bottom]);

  if (!activeOrderForPage) {
    return (
      <View
        style={{
          minHeight: ordersEmptyMinHeight,
          width: "100%",
          justifyContent: "center",
          alignItems: "stretch"
        }}
      >
        <EmptyOrdersCartAnimation
          embedded
          paused={emptyMotionPaused}
          onLastBounceLand={() => setPhraseLandTick((n) => n + 1)}
        />
        <EmptyOrdersCtaSection
          restaurantId={aid}
          venueName={displayVenueName}
          cartItemCount={cartItemCount}
          menuPrefsVersion={menuPrefsVersion}
          ordersSessionVisits={ordersEmptySessionVisits}
          phraseLandTick={phraseLandTick}
          motionPaused={emptyMotionPaused}
          authToken={token}
          onPrimaryCta={onBrowseMenu}
        />
      </View>
    );
  }

  return (
    <View style={styles.inset}>
      <View style={styles.venueBarWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cardDisabled ? undefined : `${displayVenueName}, venue and hours`}
          accessibilityHint={cardDisabled ? undefined : "Opens venue options"}
          android_ripple={cardDisabled ? undefined : { color: "rgba(15, 23, 42, 0.06)" }}
          onPress={openVenueModal}
          disabled={cardDisabled}
          style={({ pressed }) => [
            styles.venueBar,
            cardBusy && styles.cardBusy,
            cardDisabled && styles.cardDisabled,
            pressed && !cardDisabled && styles.pressed
          ]}
        >
          <View style={styles.venueBarInner}>
            <Text style={styles.venueBarTitle} numberOfLines={1}>
              {displayVenueName}
            </Text>
            <View style={styles.venueBarRight}>
              <Text style={[styles.venueBarStatus, openNow ? styles.venueOpen : styles.venueClosed]}>
                {openNow ? "Open" : "Closed"}
              </Text>
              {!cardDisabled ? <Text style={styles.venueBarCue}>›</Text> : null}
            </View>
          </View>
        </Pressable>
      </View>

      {venueSwitchLocked ? (
        <Text style={styles.pageSub}>Demo menu mode — venue switching is turned off while previewing this build.</Text>
      ) : null}

      {loadErr ? (
        <ScreenErrorState
          title="Venues unavailable"
          message={formatAppError(loadErr)}
          onRetry={() => {
            setLoadErr(null);
            setDirectoryRetryTick((n) => n + 1);
          }}
          style={styles.screenError}
        />
      ) : null}

      <CustomerOrderTrackingSection
        orders={customerOrders}
        activeVenueId={aid}
        token={token}
        money={money}
        onBrowseMenu={onBrowseMenu}
        onNeedHelp={onNeedHelp}
      />

      <CustomerVenueActionsModal
        visible={venueModalOpen}
        onDismiss={() => setVenueModalOpen(false)}
        userDisplayName={userDisplayName}
        active={modalActive}
        restaurants={rows ?? []}
        token={token}
        onVenueHydrated={onVenueHydrated}
        changeDisabled={venueSwitchLocked}
      />
    </View>
  );
}

const VENUE_BAR_RADIUS = 22;
const VENUE_BAR_MARGIN_H = 10;

const styles = StyleSheet.create({
  inset: { paddingHorizontal: 4, alignItems: "stretch" },
  venueBarWrap: {
    width: "100%",
    paddingHorizontal: VENUE_BAR_MARGIN_H,
    marginTop: 4,
    alignSelf: "stretch"
  },
  venueBar: {
    minHeight: FLOATING_TOP_BAR_HEIGHT,
    borderRadius: VENUE_BAR_RADIUS,
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(203, 213, 225, 0.55)"
  },
  venueBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  venueBarTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 19,
    fontWeight: "900",
    color: R.text,
    letterSpacing: -0.35
  },
  venueBarRight: { flexDirection: "row", alignItems: "center", flexShrink: 0, gap: 2 },
  venueBarStatus: { fontSize: 12, fontWeight: "800" },
  venueOpen: { color: "#047857" },
  venueClosed: { color: "#B91C1C" },
  venueBarCue: {
    fontSize: 22,
    fontWeight: "300",
    color: R.textSecondary,
    marginLeft: 2,
    marginTop: -1
  },
  screenError: {
    marginTop: 8,
    marginBottom: 4,
    minHeight: 160
  },
  pageSub: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 22,
    color: R.textMuted,
    alignSelf: "center",
    textAlign: "center",
    paddingHorizontal: 8
  },
  cardBusy: { opacity: 0.72 },
  cardDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.92 },
  warn: { marginTop: 12, fontSize: 14, color: R.danger, alignSelf: "center", textAlign: "center", paddingHorizontal: 8 }
});
