import * as Haptics from "expo-haptics";
import React from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View, type ScrollView } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { AuthUser } from "../../api";
import { useAppTheme } from "../../theme/AppThemeContext";
import { CustomerMeHub } from "./CustomerMeHub";
import { ProfilePlaceholderScreen } from "./ProfilePlaceholderScreen";
import { ProfileReviewScreen } from "./ProfileReviewScreen";
import type { MeStackRoute } from "./profileHubRoutes";
import { ProfileNavHighlightProvider, useProfileNavHighlight } from "./profileNavHighlight";
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
  venueName: string;
  activeOrderCount: number;
  onOpenBookings: () => void;
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
  const title = route.name === "section" ? route.title : null;
  const reviewFade = React.useRef(new Animated.Value(0)).current;
  const reviewY = React.useRef(new Animated.Value(REVIEW_OPEN_Y_FROM)).current;
  const reviewExitInFlightRef = React.useRef(false);
  const hubScrollRef = React.useRef<ScrollView | null>(null);
  const hubScrollYRef = React.useRef(0);
  const hubTopInset = route.name === "section" ? 0 : props.topInset;

  const push = React.useCallback((next: MeStackRoute) => {
    setStack((s) => [...s, next]);
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

  /** Review is an overlay — app chrome + hub layout stay on the ME root. */
  React.useEffect(() => {
    props.onAtRootChange?.(atRoot || isReviewRoute);
  }, [atRoot, isReviewRoute, props.onAtRootChange]);

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
      onOpenBookings={props.onOpenBookings}
      onOpenOrders={props.onOpenOrders}
      onOpenSupport={props.onOpenSupport}
      onSignOut={props.onSignOut}
      onAvatarSaved={props.onAvatarSaved}
      onScrollCapture={captureHubScroll}
    />
  );

  const content =
    route.name === "home" || route.name === "review" ? (
      meHub
    ) : (
      <ProfilePlaceholderScreen
        title={route.title}
        subtitle={route.subtitle}
        topInset={hubTopInset}
        bottomInset={props.bottomInset}
      />
    );

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
      {!atRoot && !isReviewRoute ? (
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
      <View style={styles.content} pointerEvents={isReviewRoute ? "none" : "auto"}>
        {content}
      </View>

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
