import * as Haptics from "expo-haptics";
import React from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View, type ScrollView } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { AuthUser } from "../../api";
import { useAppTheme } from "../../theme/AppThemeContext";
import { CustomerMeHub } from "./CustomerMeHub";
import { MeReservationConfirmationScreen } from "./MeReservationConfirmationScreen";
import { ProfileHubSubpageOverlay } from "./ProfileHubSubpageOverlay";
import { ProfilePlaceholderScreen } from "./ProfilePlaceholderScreen";
import { ProfileReviewScreen } from "./ProfileReviewScreen";
import { UpcomingReservationsScreen } from "./UpcomingReservationsScreen";
import type { MeStackRoute } from "./profileHubRoutes";
import type { CustomerReservationApi } from "../reservations/reservationApi";
import { ProfileNavHighlightProvider, useProfileNavHighlight } from "./profileNavHighlight";
import { useProfileSubpageMotion } from "./useProfileSubpageMotion";
import {
  REVIEW_CLOSE_FADE_MS,
  REVIEW_CLOSE_Y_MS,
  REVIEW_CLOSE_Y_TO,
  REVIEW_OPEN_FADE_MS,
  REVIEW_OPEN_Y_FROM,
  REVIEW_OPEN_Y_MS
} from "./profileReviewTransition";

type Props = {
  topInset: number;
  /** Safe-area only — used on sub-screens when the floating top nav is hidden. */
  compactTopInset: number;
  bottomInset: number;
  user: AuthUser | null;
  authToken: string | null;
  venueName: string;
  activeOrderCount: number;
  onOpenOrders: () => void;
  onOpenSupport: () => void;
  onSignOut: () => void;
  onAvatarSaved?: (uri: string) => void;
  /** False only for real ME sub-pages — Review overlay keeps hub chrome frozen. */
  onAtRootChange?: (atRoot: boolean) => void;
};

function BackChevron({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M14.707 17.293a1 1 0 0 1-1.414 1.414l-6-6a1 1 0 0 1 0-1.414l6-6a1 1 0 0 1 1.414 1.414L9.414 12l5.293 5.293Z"
      />
    </Svg>
  );
}

function CustomerMeStackInner(props: Props) {
  const { colors: t } = useAppTheme();
  const { navigate, onReturnedToMeHome, clearPendingHighlight } = useProfileNavHighlight();
  const [stack, setStack] = React.useState<MeStackRoute[]>([{ name: "home" }]);

  const route = stack[stack.length - 1]!;
  const atRoot = stack.length <= 1;
  const isReviewRoute = route.name === "review";
  const isReservationOverlay =
    route.name === "upcoming_reservations" || route.name === "reservation_details";
  const reservationOverlayTitle =
    route.name === "upcoming_reservations"
      ? "Upcoming reservations"
      : route.name === "reservation_details"
        ? "Booking details"
        : null;
  const title = route.name === "section" ? route.title : null;
  const reservationExitInFlightRef = React.useRef(false);
  const { motionStyle, scrimStyle, runClose } = useProfileSubpageMotion(isReservationOverlay);
  const reviewFade = React.useRef(new Animated.Value(0)).current;
  const reviewY = React.useRef(new Animated.Value(REVIEW_OPEN_Y_FROM)).current;
  const reviewExitInFlightRef = React.useRef(false);
  const hubScrollRef = React.useRef<ScrollView | null>(null);
  const hubScrollYRef = React.useRef(0);
  const hubTopInset = route.name === "section" ? 0 : props.topInset;

  const push = React.useCallback((next: MeStackRoute) => {
    setStack((s) => [...s, next]);
  }, []);

  const syncReservationInStack = React.useCallback((updated: CustomerReservationApi) => {
    setStack((s) =>
      s.map((r) =>
        r.name === "reservation_details" && r.reservation.id === updated.id
          ? { ...r, reservation: updated }
          : r
      )
    );
  }, []);

  const pop = React.useCallback(() => {
    setStack((s) => {
      if (s.length <= 1) return s;
      const closing = s[s.length - 1];
      const next = s.slice(0, -1);
      if (closing?.name === "review") {
        clearPendingHighlight();
      } else if (next[next.length - 1]?.name === "home") {
        onReturnedToMeHome();
      }
      return next;
    });
  }, [clearPendingHighlight, onReturnedToMeHome]);

  const handleBack = React.useCallback(() => {
    if (atRoot) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pop();
  }, [atRoot, pop]);

  const restoreHubScroll = React.useCallback(() => {
    const y = hubScrollYRef.current;
    requestAnimationFrame(() => {
      hubScrollRef.current?.scrollTo({ y, animated: false });
    });
  }, []);

  const runReviewOpen = React.useCallback(() => {
    reviewExitInFlightRef.current = false;
    reviewFade.setValue(0);
    reviewY.setValue(REVIEW_OPEN_Y_FROM);
    Animated.parallel([
      Animated.timing(reviewFade, { toValue: 1, duration: REVIEW_OPEN_FADE_MS, useNativeDriver: true }),
      Animated.timing(reviewY, { toValue: 0, duration: REVIEW_OPEN_Y_MS, useNativeDriver: true })
    ]).start();
  }, [reviewFade, reviewY]);

  const runReviewClose = React.useCallback(
    (onDone: () => void) => {
      Animated.parallel([
        Animated.timing(reviewFade, { toValue: 0, duration: REVIEW_CLOSE_FADE_MS, useNativeDriver: true }),
        Animated.timing(reviewY, { toValue: REVIEW_CLOSE_Y_TO, duration: REVIEW_CLOSE_Y_MS, useNativeDriver: true })
      ]).start(({ finished }) => {
        if (!finished) return;
        onDone();
      });
    },
    [reviewFade, reviewY]
  );

  React.useEffect(() => {
    if (!props.user) setStack([{ name: "home" }]);
  }, [props.user?.id]);

  /** Review keeps app top nav; reservation overlays hide it like app control centre subpages. */
  React.useEffect(() => {
    props.onAtRootChange?.((atRoot || isReviewRoute) && !isReservationOverlay);
  }, [atRoot, isReservationOverlay, isReviewRoute, props.onAtRootChange]);

  const closeReview = React.useCallback(() => {
    if (reviewExitInFlightRef.current) return;
    reviewExitInFlightRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runReviewClose(() => {
      reviewExitInFlightRef.current = false;
      pop();
      restoreHubScroll();
    });
  }, [pop, restoreHubScroll, runReviewClose]);

  React.useEffect(() => {
    if (!isReviewRoute) return;
    runReviewOpen();
  }, [isReviewRoute, runReviewOpen]);

  React.useEffect(() => {
    if (isReviewRoute) return;
    reviewFade.setValue(0);
    reviewY.setValue(REVIEW_OPEN_Y_FROM);
    reviewExitInFlightRef.current = false;
  }, [isReviewRoute, reviewFade, reviewY]);

  const captureHubScroll = React.useCallback((y: number) => {
    hubScrollYRef.current = Math.max(0, y);
  }, []);

  const openReview = React.useCallback(() => {
    void Haptics.selectionAsync();
    push({ name: "review" });
  }, [push]);

  const openUpcomingReservations = React.useCallback(() => {
    void Haptics.selectionAsync();
    if (!props.authToken?.trim()) return;
    navigate("me:reservations", () => push({ name: "upcoming_reservations" }));
  }, [navigate, props.authToken, push]);

  const closeReservationOverlay = React.useCallback(() => {
    if (reservationExitInFlightRef.current || !isReservationOverlay) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (route.name === "reservation_details") {
      pop();
      return;
    }
    reservationExitInFlightRef.current = true;
    runClose(() => {
      reservationExitInFlightRef.current = false;
      pop();
      restoreHubScroll();
    });
  }, [isReservationOverlay, pop, restoreHubScroll, route.name, runClose]);

  const meHub = (
    <CustomerMeHub
      user={props.user}
      venueName={props.venueName}
      topInset={hubTopInset}
      bottomInset={props.bottomInset}
      activeOrderCount={props.activeOrderCount}
      scrollRefExternal={hubScrollRef}
      scrollEnabled={!isReviewRoute}
      onNavigateSection={(sectionTitle, subtitle, key) =>
        navigate(key, () => push({ name: "section", title: sectionTitle, subtitle }))
      }
      onNavigateReview={openReview}
      onOpenBookings={openUpcomingReservations}
      onOpenOrders={props.onOpenOrders}
      onOpenSupport={props.onOpenSupport}
      onSignOut={props.onSignOut}
      onAvatarSaved={props.onAvatarSaved}
      onScrollCapture={captureHubScroll}
    />
  );

  const reservationOverlayContent =
    route.name === "upcoming_reservations" && props.authToken?.trim() ? (
      <UpcomingReservationsScreen
        authToken={props.authToken.trim()}
        topInset={0}
        bottomInset={props.bottomInset}
        onReservationUpdated={syncReservationInStack}
        onOpenBookingDetails={(reservation) =>
          navigate("me:reservations", () => push({ name: "reservation_details", reservation }))
        }
      />
    ) : route.name === "reservation_details" && props.authToken?.trim() ? (
      <MeReservationConfirmationScreen
        authToken={props.authToken.trim()}
        reservationId={route.reservation.id}
        initialReservation={route.reservation}
        topInset={0}
        bottomInset={props.bottomInset}
      />
    ) : null;

  const content =
    route.name === "home" || route.name === "review" || isReservationOverlay ? (
      meHub
    ) : route.name === "section" ? (
      <ProfilePlaceholderScreen
        title={route.title}
        subtitle={route.subtitle}
        topInset={hubTopInset}
        bottomInset={props.bottomInset}
      />
    ) : null;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        fill: { flex: 1 },
        topBar: { paddingHorizontal: t.space.sm, zIndex: 2, minHeight: atRoot ? 0 : 36 },
        backBtn: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          paddingVertical: 6,
          paddingRight: 10,
          gap: 2
        },
        pressed: { opacity: 0.85 },
        backLabel: { fontSize: 15, fontWeight: "600", color: t.accentBlue },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: t.text,
          textAlign: "center",
          marginTop: 2,
          marginBottom: 4
        },
        content: { flex: 1 }
      }),
    [t, atRoot]
  );

  return (
    <View style={styles.fill}>
      {!atRoot && !isReviewRoute && !isReservationOverlay ? (
        <View style={[styles.topBar, { paddingTop: props.compactTopInset }]}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <BackChevron color={t.accentBlue} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      ) : null}
      <View
        style={styles.content}
        pointerEvents={isReviewRoute || isReservationOverlay ? "box-none" : "auto"}
      >
        {content}
      </View>

      <Modal
        visible={isReservationOverlay}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={closeReservationOverlay}
      >
        {isReservationOverlay && reservationOverlayContent ? (
          <ProfileHubSubpageOverlay
            visible
            presentation="modal"
            title={reservationOverlayTitle}
            topInset={props.compactTopInset}
            motionStyle={motionStyle}
            scrimStyle={scrimStyle}
            onBack={closeReservationOverlay}
          >
            {reservationOverlayContent}
          </ProfileHubSubpageOverlay>
        ) : null}
      </Modal>

      <Modal
        visible={isReviewRoute}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={closeReview}
      >
        <Animated.View
          style={{ flex: 1, opacity: reviewFade, transform: [{ translateY: reviewY }] }}
        >
          <ProfileReviewScreen topInset={props.compactTopInset} onClose={closeReview} />
        </Animated.View>
      </Modal>
    </View>
  );
}

export function CustomerMeStack(props: Props) {
  return (
    <ProfileNavHighlightProvider>
      <CustomerMeStackInner {...props} />
    </ProfileNavHighlightProvider>
  );
}
