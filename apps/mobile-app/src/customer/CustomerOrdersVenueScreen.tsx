import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type CustomerRestaurantRow } from "../api";
import { loadRestaurantDirectoryCached } from "../data/customerDataCache";
import { ScreenErrorState, formatAppError } from "../errors";
import { R } from "../theme";
import { useAppTheme } from "../theme/AppThemeContext";
import { FLOATING_TOP_BAR_HEIGHT } from "../shell/FloatingTopBar";
import { contentBottomInset } from "../shell/navBottomMetrics";
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
  /** When true, venue switching in the modal is disabled. */
  venueSwitchLocked: boolean;
  /** Persist new venue everywhere (menus, cart, profile). Caller may bump keys / reload shell. */
  onVenueHydrated: (restaurantId: string) => Promise<void>;
  onVenueSwitchError?: (message: string) => void;
  /** Opens the global restaurant picker (store icon sheet). */
  onChooseVenue?: () => void;
  /** Customer’s orders from `GET /orders/mine` (same list as app shell). */
  customerOrders: CustomerMineOrder[];
  money: (cents: number) => string;
  onBrowseMenu: () => void;
  onNeedHelp: () => void;
  onOrdersRefresh?: () => void;
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
    onVenueSwitchError,
    onChooseVenue,
    customerOrders,
    money,
    onBrowseMenu,
    onNeedHelp,
    cartItemCount = 0,
    menuPrefsVersion = 0,
    ordersEmptySessionVisits = 0,
    emptyMotionPaused = false
  } = props;
  const { colors: t } = useAppTheme();
  const clock = useVenueClockTick(30000);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = React.useState<CustomerRestaurantRow[] | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = React.useState(false);
  const [directoryRetryTick, setDirectoryRetryTick] = React.useState(0);
  const [venueModalOpen, setVenueModalOpen] = React.useState(false);
  const [phraseLandTick, setPhraseLandTick] = React.useState(0);

  const aid = activeId.trim();
  const activeOrderForPage = React.useMemo(
    () => pickActiveOrder(customerOrders, aid),
    [customerOrders, aid]
  );

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoadErr(null);
    setDirectoryLoading(true);
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
      } finally {
        if (!cancelled) setDirectoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, userId, directoryRetryTick]);

  const currentRow = React.useMemo(
    () => (rows && aid ? rows.find((r) => r.id === aid) : undefined),
    [rows, aid]
  );

  const displayVenueName =
    (currentRow?.name ?? activeName).trim() || (aid ? "Your venue" : "Choose a venue");

  const hoursSource = currentRow?.openingHours ?? null;
  const cardBusy = rows === null && directoryLoading;
  const openNow = aid ? isVenueOpenNow(hoursSource, clock) : null;
  const cardDisabled = venueSwitchLocked;

  const modalActive = React.useMemo(
    () => ({
      id: aid,
      name: displayVenueName,
      openingHours: currentRow?.openingHours ?? null
    }),
    [aid, displayVenueName, currentRow?.openingHours]
  );

  function openVenueModal() {
    if (venueSwitchLocked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVenueModalOpen(true);
  }

  const ordersEmptyMinHeight = React.useMemo(() => {
    const scrollBottom = contentBottomInset(insets.bottom);
    const scrollTopPad = R.space.sm + insets.top + FLOATING_TOP_BAR_HEIGHT + 18;
    return Math.max(320, windowHeight - scrollTopPad - scrollBottom);
  }, [windowHeight, insets.top, insets.bottom]);

  const venueBar = (
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
            {aid && openNow !== null ? (
              <Text style={[styles.venueBarStatus, openNow ? styles.venueOpen : styles.venueClosed]}>
                {openNow ? "Open" : "Closed"}
              </Text>
            ) : null}
            {!cardDisabled ? <Text style={styles.venueBarCue}>›</Text> : null}
          </View>
        </View>
      </Pressable>
    </View>
  );

  const directoryError = loadErr ? (
    <ScreenErrorState
      title="Venues unavailable"
      message={formatAppError(loadErr)}
      onRetry={() => {
        setLoadErr(null);
        setDirectoryRetryTick((n) => n + 1);
      }}
      style={styles.screenError}
    />
  ) : null;

  const venueModal = (
    <CustomerVenueActionsModal
      visible={venueModalOpen}
      onDismiss={() => setVenueModalOpen(false)}
      userDisplayName={userDisplayName}
      active={modalActive}
      restaurants={rows ?? []}
      directoryLoading={directoryLoading}
      token={token}
      onVenueHydrated={onVenueHydrated}
      changeDisabled={venueSwitchLocked}
      onSwitchError={onVenueSwitchError}
    />
  );

  if (!activeOrderForPage) {
    if (!aid) {
      return (
        <View style={[styles.inset, styles.noVenueRoot, { minHeight: ordersEmptyMinHeight }]}>
          {directoryError}
          <View style={styles.noVenueCenter}>
            <Text style={[styles.noVenueMessage, { color: t.textSecondary }]}>
              Select preferred venue to start ordering
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose a venue"
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                (onChooseVenue ?? openVenueModal)();
              }}
              style={({ pressed }) => [
                styles.chooseVenueBtn,
                { backgroundColor: t.accentPurple },
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.chooseVenueBtnText}>Choose a venue</Text>
            </Pressable>
          </View>
          {venueModal}
        </View>
      );
    }

    return (
      <View style={styles.inset}>
        {venueBar}
        {directoryError}
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
        {venueModal}
      </View>
    );
  }

  return (
    <View style={styles.inset}>
      {venueBar}
      {directoryError}

      <CustomerOrderTrackingSection
        orders={customerOrders}
        activeVenueId={aid}
        token={token}
        money={money}
        onBrowseMenu={onBrowseMenu}
        onNeedHelp={onNeedHelp}
        onOrdersRefresh={props.onOrdersRefresh}
      />

      {venueModal}
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
  noVenueRoot: {
    justifyContent: "center",
    alignItems: "stretch"
  },
  noVenueCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    gap: 20
  },
  noVenueMessage: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 300
  },
  chooseVenueBtn: {
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  chooseVenueBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900"
  },
  cardBusy: { opacity: 0.72 },
  cardDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.92 }
});
