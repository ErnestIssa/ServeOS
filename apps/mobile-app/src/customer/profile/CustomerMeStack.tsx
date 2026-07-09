import React from "react";
import { Animated, Dimensions, Easing, Modal, StyleSheet, View, type ScrollView } from "react-native";
import type { AuthUser } from "../../api";
import { CustomerMeHub } from "./CustomerMeHub";
import { MeReservationConfirmationScreen } from "./MeReservationConfirmationScreen";
import { ProfileHubSubpageOverlay } from "./ProfileHubSubpageOverlay";
import { ProfilePlaceholderScreen } from "./ProfilePlaceholderScreen";
import { WorkspaceScreenHost } from "../../workspace/WorkspaceScreenHost";
import { ProfileReviewScreen } from "./ProfileReviewScreen";
import { UpcomingReservationsScreen } from "./UpcomingReservationsScreen";
import type { MobileExperienceManifest } from "../../mobile/mobileExperienceTypes";
import type { MeStackRoute } from "./profileHubRoutes";
import { meStackOverlayTitle } from "./profileHubRoutes";
import type { CustomerReservationApi } from "../reservations/reservationApi";
import { ProfileNavHighlightProvider, useProfileNavHighlight, type MeNavHighlightKey, type AppNavHighlightKey, type ProfileNavHighlightKey } from "./profileNavHighlight";
import { HelpScreen } from "./HelpScreen";
import { SafetyScreen } from "./SafetyScreen";
import { SettingsDetailScreen, SettingsHomeScreen } from "./SettingsScreens";
import {
  REVIEW_CLOSE_FADE_MS,
  REVIEW_CLOSE_X_MS,
  REVIEW_CLOSE_X_TO,
  REVIEW_OPEN_FADE_MS,
  REVIEW_OPEN_X_FROM,
  REVIEW_OPEN_X_MS
} from "./profileReviewTransition";

function meStackLayerKey(route: MeStackRoute): string {
  switch (route.name) {
    case "settings_detail":
      return `settings_detail:${route.key}`;
    case "section":
      return `section:${route.title}`;
    case "workspace":
      return `workspace:${route.screenKey}`;
    default:
      return route.name;
  }
}

function isInlineStackRoute(route: MeStackRoute): boolean {
  return (
    route.name !== "home" &&
    route.name !== "review" &&
    route.name !== "upcoming_reservations" &&
    route.name !== "reservation_details"
  );
}

type Props = {
  topInset: number;
  /** Safe-area only — used on sub-screens when the floating top nav is hidden. */
  compactTopInset: number;
  bottomInset: number;
  user: AuthUser | null;
  authToken: string | null;
  workspaceRestaurantId?: string | null;
  mobileExperience: MobileExperienceManifest;
  venueName: string;
  activeOrderCount: number;
  onOpenOrders: () => void;
  onOpenSupport: () => void;
  onSignOut: () => void;
  onChooseExperience?: () => void;
  onAvatarSaved?: (uri: string) => void;
  /** False only for real ME sub-pages — Review overlay keeps hub chrome frozen. */
  onAtRootChange?: (atRoot: boolean) => void;
};

function CustomerMeStackInner(props: Props) {
  const {
    navigate,
    onReturnedToMeHome,
    onReturnedToAppHome,
    onReturnedToAppSettings,
    clearPendingHighlight
  } = useProfileNavHighlight();
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
  const isInlineSubpage = !atRoot && !isReviewRoute && !isReservationOverlay;
  const dismissInlineOnBack = stack.length <= 2;
  const reviewScreenW = Dimensions.get("window").width;
  const reviewFade = React.useRef(new Animated.Value(0)).current;
  const reviewX = React.useRef(new Animated.Value(reviewScreenW)).current;
  const reviewExitInFlightRef = React.useRef(false);
  const hubScrollRef = React.useRef<ScrollView | null>(null);
  const hubScrollYRef = React.useRef(0);
  const contentEnterX = React.useRef(new Animated.Value(0)).current;
  const stackLenRef = React.useRef(1);
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
      const nextRoute = next[next.length - 1];
      if (closing?.name === "review") {
        clearPendingHighlight();
      } else if (nextRoute?.name === "home") {
        onReturnedToMeHome();
        onReturnedToAppHome();
      } else if (nextRoute?.name === "settings" || nextRoute?.name === "safety" || nextRoute?.name === "help") {
        onReturnedToAppSettings();
        onReturnedToAppHome();
      }
      return next;
    });
  }, [clearPendingHighlight, onReturnedToAppHome, onReturnedToAppSettings, onReturnedToMeHome]);

  const restoreHubScroll = React.useCallback(() => {
    const y = hubScrollYRef.current;
    requestAnimationFrame(() => {
      hubScrollRef.current?.scrollTo({ y, animated: false });
    });
  }, []);

  const handleOverlayBackComplete = React.useCallback(() => {
    pop();
    restoreHubScroll();
  }, [pop, restoreHubScroll]);

  const handleOverlayNestedBack = React.useCallback(() => {
    pop();
  }, [pop]);

  React.useEffect(() => {
    if (!isInlineSubpage) {
      stackLenRef.current = stack.length;
      return;
    }
    const pushed = stack.length > stackLenRef.current;
    stackLenRef.current = stack.length;
    if (!pushed) return;
    contentEnterX.setValue(28);
    Animated.timing(contentEnterX, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [route, stack.length, isInlineSubpage, contentEnterX]);

  const runReviewOpen = React.useCallback(() => {
    reviewExitInFlightRef.current = false;
    reviewFade.setValue(0);
    reviewX.setValue(reviewScreenW * REVIEW_OPEN_X_FROM);
    Animated.parallel([
      Animated.timing(reviewFade, { toValue: 1, duration: REVIEW_OPEN_FADE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(reviewX, { toValue: 0, duration: REVIEW_OPEN_X_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    ]).start();
  }, [reviewFade, reviewScreenW, reviewX]);

  const runReviewClose = React.useCallback(
    (onDone: () => void) => {
      Animated.parallel([
        Animated.timing(reviewFade, { toValue: 0, duration: REVIEW_CLOSE_FADE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(reviewX, { toValue: reviewScreenW * REVIEW_CLOSE_X_TO, duration: REVIEW_CLOSE_X_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      ]).start(({ finished }) => {
        if (!finished) return;
        onDone();
      });
    },
    [reviewFade, reviewScreenW, reviewX]
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
    reviewX.setValue(reviewScreenW * REVIEW_OPEN_X_FROM);
    reviewExitInFlightRef.current = false;
  }, [isReviewRoute, reviewFade, reviewScreenW, reviewX]);

  const captureHubScroll = React.useCallback((y: number) => {
    hubScrollYRef.current = Math.max(0, y);
  }, []);

  const isCustomer = props.mobileExperience.roleType === "CUSTOMER";

  const openUpcomingReservations = React.useCallback(() => {
    if (!isCustomer || !props.authToken?.trim()) return;
    navigate("me:reservations", () => push({ name: "upcoming_reservations" }));
  }, [isCustomer, navigate, props.authToken, push]);

  const openReview = React.useCallback(() => {
    if (!isCustomer) return;
    push({ name: "review" });
  }, [isCustomer, push]);

  const closeReservationOverlay = React.useCallback(() => {
    if (!isReservationOverlay) return;
    if (route.name === "reservation_details") {
      pop();
      return;
    }
    pop();
    restoreHubScroll();
  }, [isReservationOverlay, pop, restoreHubScroll, route.name]);

  const pushAppSection = React.useCallback(
    (sectionTitle: string, subtitle: string | undefined, key: AppNavHighlightKey) => {
      if (key === "app:chip:settings") {
        navigate(key, () => push({ name: "settings" }));
        return;
      }
      if (key === "app:chip:help") {
        navigate(key, () => push({ name: "help" }));
        return;
      }
      if (key === "app:chip:safety") {
        navigate(key, () => push({ name: "safety" }));
        return;
      }
      navigate(key, () => push({ name: "section", title: sectionTitle, subtitle }));
    },
    [navigate, push]
  );

  const pushMeSection = React.useCallback(
    (sectionTitle: string, subtitle: string | undefined, key: MeNavHighlightKey) => {
      if (key === "me:manage_account") {
        navigate(key, () => push({ name: "settings_detail", key: "manage_account" }));
        return;
      }
      if (key === "me:privacy") {
        navigate(key, () => push({ name: "settings_detail", key: "privacy" }));
        return;
      }
      navigate(key, () => push({ name: "section", title: sectionTitle, subtitle }));
    },
    [navigate, push]
  );

  const meHub = (
    <CustomerMeHub
      user={props.user}
      authToken={props.authToken}
      mobileExperience={props.mobileExperience}
      venueName={props.venueName}
      topInset={hubTopInset}
      bottomInset={props.bottomInset}
      activeOrderCount={props.activeOrderCount}
      scrollRefExternal={hubScrollRef}
      scrollEnabled={!isReviewRoute}
      onNavigateSection={pushMeSection}
      onNavigateScreen={(screenKey, title, subtitle) =>
        navigate(screenKey as ProfileNavHighlightKey, () =>
          push({ name: "workspace", screenKey, title, subtitle })
        )
      }
      onNavigateReview={openReview}
      onOpenBookings={openUpcomingReservations}
      onOpenOrders={props.onOpenOrders}
      onChooseExperience={props.onChooseExperience}
      onNavigateHelp={() => navigate("app:chip:help", () => push({ name: "help" }))}
      onNavigateSafety={() => navigate("app:chip:safety", () => push({ name: "safety" }))}
      onNavigateAppSettings={() => navigate("app:chip:settings", () => push({ name: "settings" }))}
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

  const renderStackRouteContent = React.useCallback(
    (layerRoute: MeStackRoute) => {
      if (layerRoute.name === "workspace" && props.authToken) {
        return (
          <WorkspaceScreenHost
            screenKey={layerRoute.screenKey}
            authToken={props.authToken}
            restaurantId={props.workspaceRestaurantId}
            title={layerRoute.title}
            subtitle={layerRoute.subtitle}
            topInset={0}
            bottomInset={props.bottomInset}
          />
        );
      }
      if (layerRoute.name === "settings") {
        return (
          <SettingsHomeScreen
            bottomInset={props.bottomInset}
            accountKeys={props.mobileExperience.settings.accountKeys}
            generalKeys={props.mobileExperience.settings.generalKeys}
            platformKeys={props.mobileExperience.settings.platformKeys ?? []}
            onOpenDetail={(key) =>
              navigate(`app:settings:${key}`, () => push({ name: "settings_detail", key }))
            }
          />
        );
      }
      if (layerRoute.name === "settings_detail") {
        return (
          <SettingsDetailScreen
            detailKey={layerRoute.key}
            user={props.user}
            authToken={props.authToken}
            roleType={props.mobileExperience.roleType}
            bottomInset={props.bottomInset}
          />
        );
      }
      if (layerRoute.name === "help") {
        return (
          <HelpScreen
            bottomInset={props.bottomInset}
            onOpenSupport={() => navigate("app:help:support", () => props.onOpenSupport())}
            onOpenSection={pushAppSection}
          />
        );
      }
      if (layerRoute.name === "safety") {
        return (
          <SafetyScreen
            authToken={props.authToken}
            bottomInset={props.bottomInset}
            onOpenSettingsDetail={(key) =>
              navigate(`app:settings:${key}`, () => push({ name: "settings_detail", key }))
            }
          />
        );
      }
      if (layerRoute.name === "section") {
        return (
          <ProfilePlaceholderScreen
            title={layerRoute.title}
            subtitle={layerRoute.subtitle}
            topInset={0}
            bottomInset={props.bottomInset}
          />
        );
      }
      return null;
    },
    [
      navigate,
      props.authToken,
      props.bottomInset,
      props.mobileExperience.roleType,
      props.mobileExperience.settings.accountKeys,
      props.mobileExperience.settings.generalKeys,
      props.mobileExperience.settings.platformKeys,
      props.onOpenSupport,
      props.user,
      props.workspaceRestaurantId,
      push,
      pushAppSection
    ]
  );

  const inlineStackRoutes = stack.slice(1).filter(isInlineStackRoute);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        fill: { flex: 1 },
        content: { flex: 1 }
      }),
    []
  );

  return (
    <View style={styles.fill}>
      <View
        style={styles.content}
        pointerEvents={atRoot && !isReviewRoute && !isReservationOverlay ? "auto" : "none"}
      >
        {meHub}
      </View>

      {inlineStackRoutes.map((layerRoute, index) => {
        const isTop = index === inlineStackRoutes.length - 1;
        const layerTitle = meStackOverlayTitle(layerRoute);
        const content = renderStackRouteContent(layerRoute);
        if (!content) return null;

        return (
          <ProfileHubSubpageOverlay
            key={meStackLayerKey(layerRoute)}
            visible
            layerMode={isTop ? "active" : "frozen"}
            zIndex={10 + index}
            presentation="inline"
            title={layerTitle}
            topInset={props.compactTopInset}
            dismissOnBack={dismissInlineOnBack}
            onBackComplete={handleOverlayBackComplete}
            onNestedBack={handleOverlayNestedBack}
          >
            {isTop ? (
              <Animated.View style={{ flex: 1, transform: [{ translateX: contentEnterX }] }}>
                {content}
              </Animated.View>
            ) : (
              content
            )}
          </ProfileHubSubpageOverlay>
        );
      })}

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
            dismissOnBack={route.name === "upcoming_reservations"}
            onBackComplete={closeReservationOverlay}
            onNestedBack={closeReservationOverlay}
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
          style={{ flex: 1, opacity: reviewFade, transform: [{ translateX: reviewX }] }}
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
