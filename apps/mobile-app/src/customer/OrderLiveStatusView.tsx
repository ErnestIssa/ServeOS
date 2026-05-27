import * as Haptics from "expo-haptics";
import React from "react";
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PixelRatio,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type ListRenderItemInfo
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import {
  ORDER_STATUS_ICON_MEAL_PREPARATION,
  ORDER_STATUS_ICON_ORDER_READY,
  ORDER_STATUS_ICON_ORDER_RECEIVED
} from "../shell/orderStatusIconAssets";
import { LiveStatusEnergyLine } from "./LiveStatusEnergyLine";
import { R } from "../theme";

const LIVE_GREEN = "#22C55E";

/** Fling velocity (px/ms) — lower = easier page change on a short swipe. */
const SNAP_VELOCITY = 0.18;
/** Drag past this fraction of a page width → snap to the next step without a hard fling. */
const SNAP_DRAG_FRAC = 0.07;

function resolvePageIndex(offsetX: number, velocityX: number, pageW: number, count: number): number {
  const max = Math.max(0, count - 1);
  const raw = offsetX / pageW;
  if (velocityX > SNAP_VELOCITY) {
    return Math.max(0, Math.min(max, Math.ceil(raw - 1e-4)));
  }
  if (velocityX < -SNAP_VELOCITY) {
    return Math.max(0, Math.min(max, Math.floor(raw + 1e-4)));
  }
  const base = Math.floor(raw + 1e-4);
  const frac = raw - base;
  if (frac > SNAP_DRAG_FRAC) return Math.min(max, base + 1);
  return Math.max(0, Math.min(max, base));
}

export type LiveStatusStep = {
  key: string;
  title: string;
  subtitle: string;
  icon: ImageSourcePropType;
};

const SEC_PER_DAY = 86400;
const SEC_PER_HOUR = 3600;
const SEC_PER_MIN = 60;

/** Largest sensible unit for the remaining window (full words, pluralized). */
function formatRemainingHuman(totalMs: number): { value: number; unit: string } {
  const totalSec = Math.max(0, Math.floor(totalMs / 1000));
  if (totalSec >= SEC_PER_DAY) {
    const days = Math.floor(totalSec / SEC_PER_DAY);
    return { value: days, unit: days === 1 ? "day" : "days" };
  }
  if (totalSec >= SEC_PER_HOUR) {
    const hours = Math.floor(totalSec / SEC_PER_HOUR);
    return { value: hours, unit: hours === 1 ? "hour" : "hours" };
  }
  if (totalSec >= SEC_PER_MIN) {
    const minutes = Math.floor(totalSec / SEC_PER_MIN);
    return { value: minutes, unit: minutes === 1 ? "minute" : "minutes" };
  }
  return { value: totalSec, unit: totalSec === 1 ? "second" : "seconds" };
}

function RemainingCountdown(props: { remainingMs: number; live: boolean }) {
  const { value, unit } = formatRemainingHuman(props.remainingMs);
  return (
    <View style={styles.remainingRow} accessibilityLabel={`Approximately ${value} ${unit} remaining`}>
      <Text style={styles.approxIcon} accessibilityElementsHidden>
        ≈
      </Text>
      <View style={styles.remainingPhraseRow}>
        <Text style={[styles.remainingValue, props.live && styles.remainingValueLive]}>{value}</Text>
        <Text style={styles.remainingMeta}>{` ${unit} remaining`}</Text>
      </View>
    </View>
  );
}

function parseMs(iso?: string | null): number | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Budget for each live-status phase (matches the countdown above the step title). */
const STEP_PHASE_MS = [10 * 60 * 1000, 30 * 60 * 1000, 25 * 60 * 1000] as const;

function stepBudgetMs(stepIndex: number): number {
  return STEP_PHASE_MS[Math.max(0, Math.min(2, stepIndex))] ?? STEP_PHASE_MS[2];
}

function stepPhaseStartMs(focusedStep: number, status: string, created: number, updated: number): number {
  if (focusedStep === 0) return created;
  if (focusedStep === 1) return created + stepBudgetMs(0);
  return status === "READY" ? updated : created + stepBudgetMs(0) + stepBudgetMs(1);
}

/** Time left in the current swipe card's phase only. */
export function stepRemainingMsForCard(
  stepIndex: number,
  focusedStep: number,
  status: string,
  createdAt: string | null | undefined,
  updatedAt: string | null | undefined,
  nowMs: number
): number {
  const created = parseMs(createdAt) ?? nowMs;
  const updated = parseMs(updatedAt) ?? created;
  const budget = stepBudgetMs(stepIndex);
  if (stepIndex < focusedStep) return 0;
  if (stepIndex > focusedStep) return budget;
  const start = stepPhaseStartMs(focusedStep, status, created, updated);
  return Math.max(0, budget - (nowMs - start));
}

export function stepProgressForCard(
  stepIndex: number,
  focusedStep: number,
  status: string,
  createdAt: string | null | undefined,
  updatedAt: string | null | undefined,
  nowMs: number
): number {
  if (stepIndex < focusedStep) return 1;
  if (stepIndex > focusedStep) return 0;
  const budget = stepBudgetMs(stepIndex);
  if (budget <= 0) return 0;
  const rem = stepRemainingMsForCard(stepIndex, focusedStep, status, createdAt, updatedAt, nowMs);
  return clamp01(1 - rem / budget);
}

/** First step whose phase still has time left; otherwise the last step. */
function resolveTimedFocusedStep(
  status: string,
  createdAt: string | null | undefined,
  updatedAt: string | null | undefined,
  nowMs: number,
  stepCount: number
): number {
  for (let s = 0; s < stepCount; s += 1) {
    const rem = stepRemainingMsForCard(s, s, status, createdAt, updatedAt, nowMs);
    if (rem > 0) return s;
  }
  return Math.max(0, stepCount - 1);
}

/** Short label for the energy line: `3 sec`, `17 mins`, `1hr`, `4hrs`. */
export function formatStepRemainingShort(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    return h === 1 ? "1hr" : `${h}hrs`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    return `${m} mins`;
  }
  return sec === 1 ? "1 sec" : `${sec} sec`;
}

function useTickMs(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function BlinkingLiveRing(props: { active: boolean; children: React.ReactNode }) {
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    if (!props.active) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [props.active, pulse]);

  const ringStyle = useAnimatedStyle(() => {
    if (!props.active) {
      return { shadowOpacity: 0 };
    }
    const glow = interpolate(pulse.value, [0.35, 1], [0.65, 1], Extrapolation.CLAMP);
    return {
      shadowColor: LIVE_GREEN,
      shadowOpacity: 0.2 + 0.45 * glow,
      shadowRadius: 12 + 10 * glow,
      shadowOffset: { width: 0, height: 0 }
    };
  }, [props.active]);

  return (
    <Animated.View style={[styles.liveCardShell, props.active && styles.liveCardShellActive, ringStyle]}>
      {props.children}
    </Animated.View>
  );
}

function ClockBlock(props: {
  stepIndex: number;
  focusedStep: number;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  nowMs: number;
}) {
  if (props.stepIndex !== props.focusedStep) {
    return <View style={styles.clockBlockPlaceholder} />;
  }
  const stepRemainingMs = stepRemainingMsForCard(
    props.focusedStep,
    props.focusedStep,
    props.status,
    props.createdAt,
    props.updatedAt,
    props.nowMs
  );
  return (
    <View style={styles.clockBlock}>
      <RemainingCountdown remainingMs={stepRemainingMs} live />
    </View>
  );
}

function buildSteps(venueName: string): LiveStatusStep[] {
  const kitchen = venueName.trim() || "Your venue";
  return [
    {
      key: "received",
      title: "Order received",
      subtitle: `${kitchen} has your order in the queue.`,
      icon: ORDER_STATUS_ICON_ORDER_RECEIVED
    },
    {
      key: "prep",
      title: "In preparation",
      subtitle: `${kitchen} is preparing your items fresh.`,
      icon: ORDER_STATUS_ICON_MEAL_PREPARATION
    },
    {
      key: "ready",
      title: "Ready for pickup",
      subtitle: `${kitchen} has your order ready — head to the pickup area when you arrive.`,
      icon: ORDER_STATUS_ICON_ORDER_READY
    }
  ];
}

type Props = {
  milestone: number;
  status: string;
  /** Restaurant / kitchen name for personalised step copy. */
  venueName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** In hero mode, hide header/hint so it fits the image frame. */
  variant?: "hero" | "section";
};

export function OrderLiveStatusView(props: Props) {
  const orderMilestone = props.milestone;
  const { status, venueName, createdAt, updatedAt } = props;
  const { width: winW } = useWindowDimensions();
  const steps = React.useMemo(() => buildSteps(venueName ?? ""), [venueName]);
  const nowMs = useTickMs();
  const variant = props.variant ?? "section";

  const timedStep = React.useMemo(
    () => resolveTimedFocusedStep(status, createdAt, updatedAt, nowMs, steps.length),
    [status, createdAt, updatedAt, nowMs, steps.length]
  );
  /** Never behind kitchen status; auto-advance when a phase timer elapses. */
  const focusedStep = Math.max(orderMilestone, timedStep);

  /** Measured FlatList width — each page slot matches this exactly for centering + snap. */
  const [pageW, setPageW] = React.useState(0);
  const pagePad = 16;

  const listRef = React.useRef<FlatList<LiveStatusStep>>(null);
  /** Which card the user is looking at (free swipe). */
  const [viewIndex, setViewIndex] = React.useState(focusedStep);
  const viewIndexRef = React.useRef(viewIndex);
  viewIndexRef.current = viewIndex;
  const hapticPageRef = React.useRef(viewIndex);
  const prevFocusedRef = React.useRef<number | null>(null);
  const listLaidOutRef = React.useRef(false);
  const isProgrammaticScrollRef = React.useRef(false);
  const safePageW = Math.max(1, pageW > 0 ? pageW : PixelRatio.roundToNearestPixel(winW));

  const scrollToPage = React.useCallback(
    (index: number, animated: boolean) => {
      const clamped = Math.max(0, Math.min(steps.length - 1, index));
      const offset = clamped * safePageW;
      isProgrammaticScrollRef.current = animated;
      hapticPageRef.current = clamped;
      setViewIndex(clamped);
      listRef.current?.scrollToOffset({ offset, animated });
      if (!animated) {
        isProgrammaticScrollRef.current = false;
        return;
      }
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 450);
    },
    [safePageW, steps.length]
  );

  const onScrollLive = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isProgrammaticScrollRef.current) return;
      const x = e.nativeEvent.contentOffset.x;
      const idx = resolvePageIndex(x, 0, safePageW, steps.length);
      if (idx !== hapticPageRef.current) {
        hapticPageRef.current = idx;
        void Haptics.selectionAsync();
      }
      setViewIndex((prev) => (prev === idx ? prev : idx));
    },
    [safePageW, steps.length]
  );

  const onScrollSettled = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
      }
      const { contentOffset, velocity } = e.nativeEvent;
      const nearest = resolvePageIndex(contentOffset.x, velocity?.x ?? 0, safePageW, steps.length);
      hapticPageRef.current = nearest;
      setViewIndex((prev) => (prev === nearest ? prev : nearest));
    },
    [safePageW, steps.length]
  );

  const onListLayout = React.useCallback((e: LayoutChangeEvent) => {
    const w = PixelRatio.roundToNearestPixel(e.nativeEvent.layout.width);
    if (w <= 0) return;
    setPageW((prev) => {
      if (prev === w) return prev;
      return w;
    });
  }, []);

  /** First layout: align to live step. After that: only scroll when the live step advances. */
  React.useEffect(() => {
    if (safePageW <= 1) return;
    if (!listLaidOutRef.current) {
      listLaidOutRef.current = true;
      prevFocusedRef.current = focusedStep;
      scrollToPage(focusedStep, false);
      return;
    }
    const prev = prevFocusedRef.current;
    if (prev != null && focusedStep > prev) {
      scrollToPage(focusedStep, true);
    }
    prevFocusedRef.current = focusedStep;
  }, [focusedStep, safePageW, scrollToPage]);

  /** Width changed (rotation): keep the same viewed card without fighting an in-progress swipe. */
  React.useEffect(() => {
    if (safePageW <= 1 || !listLaidOutRef.current) return;
    const offset = viewIndexRef.current * safePageW;
    listRef.current?.scrollToOffset({ offset, animated: false });
  }, [safePageW]);

  const renderItem = React.useCallback(
    ({ item, index: i }: ListRenderItemInfo<LiveStatusStep>) => {
      const isCurrentStep = i === focusedStep;
      const progress = stepProgressForCard(i, focusedStep, status, createdAt, updatedAt, nowMs);
      const stepRemMs = stepRemainingMsForCard(i, focusedStep, status, createdAt, updatedAt, nowMs);
      const stepTimeLabel = i < focusedStep ? null : formatStepRemainingShort(stepRemMs);
      return (
        <View style={[styles.page, { width: safePageW }]}>
          <View style={[styles.pageCard, { paddingHorizontal: pagePad }]}>
            <BlinkingLiveRing active={isCurrentStep}>
              <ClockBlock
                stepIndex={i}
                focusedStep={focusedStep}
                status={status}
                createdAt={createdAt}
                updatedAt={updatedAt}
                nowMs={nowMs}
              />
              <View style={styles.iconBadge}>
                <Image source={item.icon} style={styles.stepIcon} resizeMode="contain" accessibilityIgnoresInvertColors />
              </View>
              <Text style={[styles.stepTitle, isCurrentStep && styles.stepTitleLive]}>{item.title}</Text>
              <Text style={styles.stepSubtitle}>{item.subtitle}</Text>
              <LiveStatusEnergyLine
                progress={progress}
                active={isCurrentStep}
                stepTimeLabel={stepTimeLabel}
              />
            </BlinkingLiveRing>
          </View>
        </View>
      );
    },
    [createdAt, focusedStep, nowMs, pagePad, safePageW, status, updatedAt]
  );

  const keyExtractor = React.useCallback((it: LiveStatusStep) => it.key, []);

  return (
    <View style={[styles.wrap, variant === "hero" && styles.wrapHero]}>
      {variant === "section" ? (
        <>
          <View style={styles.headerRow}>
            <Text style={styles.headerEyebrow}>Live status</Text>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.hint}>
            Swipe sideways to see all steps. You are on step {focusedStep + 1} of {steps.length}.
          </Text>
        </>
      ) : null}
      <FlatList
        ref={listRef}
        data={steps}
        horizontal
        style={styles.listTransparent}
        keyExtractor={keyExtractor}
        extraData={{ safePageW, focusedStep, nowMs }}
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScrollLive}
        onLayout={onListLayout}
        onScrollEndDrag={onScrollSettled}
        onMomentumScrollEnd={onScrollSettled}
        getItemLayout={(_, i) => ({
          length: safePageW,
          offset: safePageW * i,
          index: i
        })}
        removeClippedSubviews={false}
        renderItem={renderItem}
        onScrollToIndexFailed={() => {}}
      />
      <View style={[styles.dotsRow, variant === "hero" && styles.dotsRowHero]}>
        {steps.map((s, i) => (
          <View key={s.key} style={[styles.pageDot, i === viewIndex && styles.pageDotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, backgroundColor: "transparent", alignSelf: "stretch", width: "100%" },
  wrapHero: {
    marginTop: 0,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "transparent",
    alignSelf: "stretch",
    width: "100%",
    flex: 1,
    justifyContent: "center"
  },
  listTransparent: { backgroundColor: "transparent", alignSelf: "stretch", width: "100%" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: R.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.45)"
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LIVE_GREEN,
    marginRight: 6
  },
  livePillText: {
    fontSize: 11,
    fontWeight: "900",
    color: LIVE_GREEN,
    letterSpacing: 0.8
  },
  hint: {
    fontSize: 12,
    fontWeight: "600",
    color: R.textSecondary,
    marginBottom: 14,
    lineHeight: 17
  },
  page: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    backgroundColor: "transparent",
    overflow: "visible"
  },
  pageCard: {
    width: "100%",
    alignSelf: "center",
    alignItems: "center"
  },
  liveCardShell: {
    width: "100%",
    maxWidth: "100%",
    borderRadius: 20,
    backgroundColor: "transparent",
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    alignSelf: "center",
    overflow: "visible"
  },
  liveCardShellActive: {
    backgroundColor: "transparent"
  },
  clockBlock: {
    alignItems: "center",
    marginBottom: 12,
    width: "100%"
  },
  clockBlockPlaceholder: {
    marginBottom: 12,
    width: "100%",
    minHeight: 40
  },
  remainingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    maxWidth: "100%",
    paddingHorizontal: 4
  },
  remainingPhraseRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: "100%"
  },
  approxIcon: {
    fontSize: 15,
    fontWeight: "700",
    color: R.textMuted,
    marginRight: 6,
    marginTop: 2
  },
  remainingValue: {
    fontSize: 28,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    letterSpacing: -0.5,
    color: R.textSecondary
  },
  remainingValueLive: {
    color: R.text
  },
  remainingMeta: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: -0.1
  },
  iconBadge: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    flexShrink: 0
  },
  stepIcon: { width: 64, height: 64, flexShrink: 0 },
  stepTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: R.text,
    textAlign: "center",
    letterSpacing: -0.3
  },
  stepTitleLive: {
    color: R.accentBlue,
    fontSize: 24,
    fontWeight: "900"
  },
  stepSubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    color: R.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 4,
    marginBottom: 14
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
    backgroundColor: "transparent"
  },
  dotsRowHero: { marginTop: 10 },
  pageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: R.border,
    marginHorizontal: 4
  },
  pageDotActive: {
    backgroundColor: LIVE_GREEN,
    width: 18
  }
});
