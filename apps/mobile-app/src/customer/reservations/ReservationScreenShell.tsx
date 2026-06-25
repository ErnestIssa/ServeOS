import * as Haptics from "expo-haptics";
import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
import { R } from "../../theme";
import { BOOKING_UX_TAGLINE } from "./reservationPresets";
import { rubberBandOffsetPastMax } from "./reservationScrollBounds";
import { useFooterKeyboardRevealGap } from "./useFooterKeyboardRevealGap";

const RUBBER_CAP_PX = 26;
const BOUNCE_UNDERSHOOT_PX = 11;
const BOUNCE_SETTLE_MS = 240;

type Props = {
  title?: string;
  /** Short line under the title (screen-specific). */
  purpose?: string;
  /** Blue UX tagline under the title; off on landing. */
  showUxTagline?: boolean;
  /** Full-bleed header (e.g. cinematic hero); title block is omitted. */
  layout?: "standard" | "immersive";
  immersiveHeader?: React.ReactNode;
  /**
   * When layout="immersive" and the hero is rendered outside this scroll view (fixed layer),
   * pass the pixel offset where the card should initially sit so the scroll view starts there.
   */
  sheetTopOffset?: number;
  /** Solid fallback fill for the bottom-sheet card (when no gradient provided). */
  sheetBg?: string;
  /** When set, sheet card uses same top→bottom gradient rules as page mesh. */
  sheetGradient?: [string, string];
  stepLabel?: string;
  onBack?: () => void;
  onScroll: ReturnType<typeof Animated.event>;
  onScrollEndDrag?: () => void;
  onMomentumScrollEnd?: () => void;
  scrollTopPad: number;
  scrollBottom: number;
  /** Optional external ref so parent can programmatically scroll the sheet. */
  scrollRefExternal?: React.RefObject<ScrollView | null>;
  /** When set, scroll the sheet to this offset (e.g. returning from a later step). */
  restoreScrollY?: number;
  /** Bumps when `restoreScrollY` should be re-applied after remount. */
  scrollRestoreToken?: number;
  /** Back control overlaps top-left of the gradient card (post-landing steps). */
  cardOverlayBack?: boolean;
  /** Close (×) overlaps top-right of the gradient card (e.g. confirmation). */
  cardOverlayClose?: boolean;
  onClose?: () => void;
  /** When false, the immersive sheet does not scroll (e.g. quick-booking wheels are active). */
  sheetScrollEnabled?: boolean;
  /** Max extra height below footer (note step). */
  footerScrollRevealGap?: number;
  /** When true, gap animates in only while the keyboard is open. */
  footerScrollRevealKeyboardOnly?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function ReservationScreenShell(props: Props) {
  const immersive = props.layout === "immersive";
  const hasFixedHero = immersive && props.sheetTopOffset != null;
  const internalScrollRef = React.useRef<ScrollView | null>(null);
  const scrollRef = props.scrollRefExternal ?? internalScrollRef;
  const backBlink = React.useRef(new Animated.Value(1)).current;
  const maxScrollYRef = React.useRef(0);
  const bounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const bouncingRef = React.useRef(false);
  const draggingRef = React.useRef(false);
  const hitTopRef = React.useRef(false);
  const hitBottomRef = React.useRef(false);
  const [viewportH, setViewportH] = React.useState(0);
  const [contentH, setContentH] = React.useState(0);

  const footerRevealMax = props.footerScrollRevealGap ?? 0;
  const keyboardRevealOnly = props.footerScrollRevealKeyboardOnly === true && footerRevealMax > 0;

  const getMaxScrollY = React.useCallback(
    () => maxScrollYRef.current,
    []
  );

  const keyboardRevealGapAnim = useFooterKeyboardRevealGap(
    footerRevealMax,
    keyboardRevealOnly && hasFixedHero,
    scrollRef,
    getMaxScrollY
  );

  React.useEffect(() => {
    maxScrollYRef.current = Math.max(0, contentH - viewportH);
  }, [contentH, viewportH]);

  /** Cold start / tab return only — not used for in-flow back (screens stay mounted). */
  const applyRestoredScroll = React.useCallback(() => {
    if (props.restoreScrollY == null || props.scrollRestoreToken == null) return;
    const y = Math.max(0, props.restoreScrollY);
    scrollRef.current?.scrollTo({ y, animated: false });
  }, [props.restoreScrollY, props.scrollRestoreToken, scrollRef]);

  React.useEffect(() => {
    applyRestoredScroll();
  }, [applyRestoredScroll]);

  const onShellLayout = React.useCallback(() => {
    if (props.scrollRestoreToken != null) applyRestoredScroll();
  }, [applyRestoredScroll, props.scrollRestoreToken]);

  const flashOverlayBack = React.useCallback(() => {
    backBlink.setValue(1);
    Animated.sequence([
      Animated.timing(backBlink, { toValue: 0.52, duration: 85, useNativeDriver: true }),
      Animated.timing(backBlink, { toValue: 1, duration: 130, useNativeDriver: true })
    ]).start();
  }, [backBlink]);

  React.useEffect(
    () => () => {
      if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
    },
    []
  );

  const clearBounceTimer = React.useCallback(() => {
    if (bounceTimerRef.current) {
      clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = null;
    }
  }, []);

  /** Hard stop at top — no pull-down past hero rest position. */
  const clampTop = React.useCallback((y: number) => {
    if (y < 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, []);

  /** While dragging past max, rubber-band only above max (never below / past card end). */
  const applyRubberIfPastMax = React.useCallback((y: number) => {
    const max = maxScrollYRef.current;
    if (y <= max) return;
    const resisted = max + rubberBandOffsetPastMax(y - max, RUBBER_CAP_PX);
    if (Math.abs(y - resisted) > 0.5) {
      scrollRef.current?.scrollTo({ y: resisted, animated: false });
    }
  }, []);

  /**
   * Premium end bounce: compress above max, undershoot below max, settle at max.
   * Never animates to y > max (card tail stays hidden).
   */
  const springBounceToMax = React.useCallback(() => {
    const max = maxScrollYRef.current;
    if (max <= 0) return;
    clearBounceTimer();
    bouncingRef.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, max - BOUNCE_UNDERSHOOT_PX), animated: true });
    bounceTimerRef.current = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: max, animated: true });
      bounceTimerRef.current = null;
      bouncingRef.current = false;
    }, BOUNCE_SETTLE_MS);
  }, [clearBounceTimer]);

  const settleScroll = React.useCallback(
    (y: number) => {
      const max = maxScrollYRef.current;
      if (y < 0) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      if (y > max + 0.5) {
        springBounceToMax();
        return;
      }
      if (y > max - 0.5 && y <= max + 0.5) {
        scrollRef.current?.scrollTo({ y: max, animated: true });
      }
    },
    [springBounceToMax]
  );

  const handleScroll = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (typeof props.onScroll === "function") {
        props.onScroll(e);
      }
      if (!hasFixedHero || bouncingRef.current) return;
      const y = e.nativeEvent.contentOffset.y;
      const max = maxScrollYRef.current;

      // Subtle edge feel (one-shot per drag).
      if (!hitTopRef.current && y <= 0.5) {
        hitTopRef.current = true;
        void Haptics.selectionAsync();
      }
      if (!hitBottomRef.current && max > 0 && y >= max - 0.5) {
        hitBottomRef.current = true;
        void Haptics.selectionAsync();
      }

      clampTop(y);
      if (y > max) {
        applyRubberIfPastMax(y);
      }
    },
    [hasFixedHero, props.onScroll, clampTop, applyRubberIfPastMax]
  );

  const handleScrollBeginDrag = React.useCallback(() => {
    if (!hasFixedHero) return;
    draggingRef.current = true;
    clearBounceTimer();
    bouncingRef.current = false;
    hitTopRef.current = false;
    hitBottomRef.current = false;
  }, [hasFixedHero, clearBounceTimer]);

  const handleScrollEndDrag = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (hasFixedHero) {
        draggingRef.current = false;
        settleScroll(e.nativeEvent.contentOffset.y);
      }
      props.onScrollEndDrag?.();
    },
    [hasFixedHero, props.onScrollEndDrag, settleScroll]
  );

  const handleMomentumScrollEnd = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (hasFixedHero) {
        draggingRef.current = false;
        settleScroll(e.nativeEvent.contentOffset.y);
      }
      props.onMomentumScrollEnd?.();
    },
    [hasFixedHero, props.onMomentumScrollEnd, settleScroll]
  );

  return (
    <Animated.ScrollView
      ref={scrollRef as React.RefObject<ScrollView>}
      style={styles.scroll}
      scrollEnabled={props.sheetScrollEnabled !== false}
      onScroll={handleScroll}
      onScrollBeginDrag={hasFixedHero ? handleScrollBeginDrag : undefined}
      onScrollEndDrag={props.onScrollEndDrag || hasFixedHero ? handleScrollEndDrag : undefined}
      onMomentumScrollEnd={props.onMomentumScrollEnd || hasFixedHero ? handleMomentumScrollEnd : undefined}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={hasFixedHero}
      bounces={hasFixedHero ? false : undefined}
      overScrollMode={hasFixedHero ? "never" : undefined}
      onLayout={
        hasFixedHero
          ? (e) => {
              setViewportH(e.nativeEvent.layout.height);
              if (props.scrollRestoreToken != null) onShellLayout();
            }
          : undefined
      }
      onContentSizeChange={
        hasFixedHero
          ? (_w, h) => {
              setContentH(h);
            }
          : undefined
      }
      contentContainerStyle={[
        immersive ? styles.padImmersive : styles.pad,
        immersive ? { paddingTop: 0 } : { paddingTop: props.scrollTopPad },
        hasFixedHero ? { paddingBottom: 0 } : { paddingBottom: props.scrollBottom }
      ]}
    >
      {props.onBack && !props.cardOverlayBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            props.onBack?.();
          }}
          style={({ pressed }) => [
            styles.backRow,
            immersive && styles.backRowImmersive,
            pressed && styles.pressed
          ]}
        >
          <Text style={[styles.backChevron, immersive && styles.backOnHero]}>‹</Text>
          <Text style={[styles.backText, immersive && styles.backOnHero]}>Back</Text>
        </Pressable>
      ) : null}

      {immersive && props.immersiveHeader ? props.immersiveHeader : null}

      {/* Fixed-hero variant: a single card View fills from sheetTopOffset downward so the
          whole content area (including gaps between items) shares one solid background. */}
      {hasFixedHero ? (
        <View
          style={[
            styles.sheetCard,
            {
              marginTop: props.sheetTopOffset,
              backgroundColor: props.sheetGradient ? "transparent" : (props.sheetBg ?? "transparent")
            }
          ]}
        >
          {props.cardOverlayBack && props.onBack ? (
            <Animated.View style={[styles.cardOverlayBackWrap, { opacity: backBlink }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  flashOverlayBack();
                  props.onBack?.();
                }}
                style={({ pressed }) => [styles.cardOverlayBackBtn, pressed && styles.pressed]}
              >
                <Text style={styles.cardOverlayBackChevron}>‹</Text>
                <Text style={styles.cardOverlayBackText}>Back</Text>
              </Pressable>
            </Animated.View>
          ) : null}
          {props.cardOverlayClose && props.onClose ? (
            <Animated.View style={[styles.cardOverlayCloseWrap, { opacity: backBlink }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  flashOverlayBack();
                  props.onClose?.();
                }}
                style={({ pressed }) => [styles.cardOverlayCloseBtn, pressed && styles.pressed]}
              >
                <Text style={styles.cardOverlayCloseX}>×</Text>
              </Pressable>
            </Animated.View>
          ) : null}
          {props.sheetGradient ? (
            <LinearGradient
              colors={props.sheetGradient}
              locations={[0, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : null}
          <View style={styles.immersiveBody}>
            <View style={styles.body}>{props.children}</View>
            {props.footer ? (
              <View style={[styles.footer, { marginBottom: props.scrollBottom }]}>
                {props.footer}
                {footerRevealMax > 0 ? (
                  keyboardRevealOnly ? (
                    <Animated.View style={{ height: keyboardRevealGapAnim, overflow: "hidden" }} />
                  ) : (
                    <View style={{ height: footerRevealMax }} />
                  )
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={immersive ? styles.immersiveBody : undefined}>
          {!immersive ? (
            <>
              {props.stepLabel ? <Text style={styles.stepEyebrow}>{props.stepLabel}</Text> : null}
              {props.title ? <Text style={styles.title}>{props.title}</Text> : null}
              {props.showUxTagline !== false ? <Text style={styles.uxTag}>{BOOKING_UX_TAGLINE}</Text> : null}
              {props.purpose ? <Text style={styles.purpose}>{props.purpose}</Text> : null}
            </>
          ) : null}
          <View style={styles.body}>{props.children}</View>
          {props.footer ? <View style={styles.footer}>{props.footer}</View> : null}
        </View>
      )}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  pad: { paddingHorizontal: R.space.sm },
  padImmersive: { paddingHorizontal: 0 },
  /** Single solid card that acts as the bottom sheet in fixed-hero layouts. */
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden"
  },
  cardOverlayBackWrap: {
    position: "absolute",
    zIndex: 12,
    left: R.space.sm,
    top: 10
  },
  cardOverlayBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingRight: 12,
    paddingLeft: 4,
    borderRadius: R.radius.pill,
    backgroundColor: "rgba(15, 23, 42, 0.42)"
  },
  cardOverlayBackChevron: {
    fontSize: 26,
    fontWeight: "300",
    color: "#FFFFFF",
    marginRight: 2,
    marginTop: -2
  },
  cardOverlayBackText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  cardOverlayCloseWrap: {
    position: "absolute",
    zIndex: 12,
    right: R.space.sm,
    top: 10
  },
  cardOverlayCloseBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.42)"
  },
  cardOverlayCloseX: {
    fontSize: 28,
    fontWeight: "300",
    color: "#FFFFFF",
    lineHeight: 30,
    marginTop: -2
  },
  immersiveBody: {
    paddingHorizontal: R.space.sm,
    paddingTop: 4
  },
  backRowImmersive: {
    position: "absolute",
    zIndex: 4,
    left: R.space.sm,
    top: 0
  },
  backOnHero: {
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 10,
    paddingVertical: 4,
    paddingRight: 8
  },
  pressed: { opacity: 0.85 },
  backChevron: {
    fontSize: 28,
    fontWeight: "300",
    color: R.accentBlue,
    marginRight: 2,
    marginTop: -2
  },
  backText: {
    fontSize: R.type.body,
    fontWeight: "700",
    color: R.accentBlue
  },
  stepEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: R.accentPurple,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: R.text,
    letterSpacing: -0.5,
    marginBottom: 6
  },
  uxTag: {
    fontSize: R.type.label,
    fontWeight: "800",
    color: R.accentBlue,
    marginBottom: 10,
    letterSpacing: 0.2
  },
  purpose: {
    fontSize: R.type.label,
    fontWeight: "600",
    color: R.textSecondary,
    lineHeight: 20,
    marginBottom: R.space.sm
  },
  body: { gap: 4 },
  footer: { marginTop: R.space.md, marginBottom: R.space.sm }
});
