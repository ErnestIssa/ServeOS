import * as Haptics from "expo-haptics";
import React from "react";
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { R } from "../theme";

const LIVE_GREEN = "#22C55E";

export type LiveStatusStep = {
  key: string;
  title: string;
  subtitle: string;
  icon: ImageSourcePropType;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatHms(totalMs: number): string {
  const s = Math.max(0, Math.floor(totalMs / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

function parseMs(iso?: string | null): number | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function useOrderCountdownDeadlineMs(status: string, createdAt?: string | null, updatedAt?: string | null): number {
  return React.useMemo(() => {
    const created = parseMs(createdAt) ?? Date.now();
    const updated = parseMs(updatedAt) ?? created;
    if (status === "READY") {
      return updated + 25 * 60 * 1000;
    }
    return created + 45 * 60 * 1000;
  }, [status, createdAt, updatedAt]);
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

function LiveLineLoader(props: { progress: number; active: boolean }) {
  const { progress, active } = props;
  const [barW, setBarW] = React.useState(0);
  const arrowPulse = useSharedValue(0);
  React.useEffect(() => {
    if (!active) {
      arrowPulse.value = 0;
      return;
    }
    arrowPulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [active, arrowPulse]);

  const arrowStyle = useAnimatedStyle(() => {
    if (!active) return { opacity: 0.55, transform: [{ translateY: 0 }] };
    const y = interpolate(arrowPulse.value, [0, 1], [0, -3], Extrapolation.CLAMP);
    return { opacity: 0.95, transform: [{ translateY: y }] };
  }, [active]);

  const p = clamp01(progress);
  const fillW = Math.max(0, Math.min(barW, barW * p));
  const arrowX = Math.max(0, Math.min(barW, fillW));

  return (
    <View
      style={styles.lineLoaderWrap}
      accessibilityLabel="Live progress"
      onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
    >
      <View style={styles.lineTrack} />
      <View style={[styles.lineFill, { width: fillW }]} />
      <Animated.View style={[styles.lineArrow, { left: arrowX }, arrowStyle]}>
        <Text style={styles.lineArrowGlyph}>→</Text>
      </Animated.View>
    </View>
  );
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
      return {
        borderColor: R.border,
        borderWidth: 2,
        shadowOpacity: 0
      };
    }
    const glow = interpolate(pulse.value, [0.35, 1], [0.65, 1], Extrapolation.CLAMP);
    return {
      borderColor: LIVE_GREEN,
      borderWidth: 3,
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
  milestone: number;
  status: string;
  deadlineMs: number;
  nowMs: number;
}) {
  const { stepIndex, milestone, status, deadlineMs, nowMs } = props;
  if (stepIndex < milestone) {
    return (
      <View style={styles.clockBlock}>
        <Text style={styles.clockLabel}>Step complete</Text>
        <Text style={styles.clockMuted}>—</Text>
      </View>
    );
  }
  const remaining = deadlineMs - nowMs;
  const text = formatHms(remaining);
  let label = "Est. to ready";
  if (stepIndex === milestone) {
    label = status === "READY" && milestone === 2 ? "Pickup window" : "Time remaining";
  }

  return (
    <View style={styles.clockBlock}>
      <Text style={styles.clockLabel}>{label}</Text>
      <Text style={[styles.clockDigits, stepIndex === milestone && styles.clockDigitsLive]}>{text}</Text>
    </View>
  );
}

function buildSteps(): LiveStatusStep[] {
  return [
    {
      key: "received",
      title: "Order received",
      subtitle: "The kitchen has your order in the queue.",
      icon: ORDER_STATUS_ICON_ORDER_RECEIVED
    },
    {
      key: "prep",
      title: "In preparation",
      subtitle: "Chefs are preparing your items fresh.",
      icon: ORDER_STATUS_ICON_MEAL_PREPARATION
    },
    {
      key: "ready",
      title: "Ready for pickup",
      subtitle: "Head to the counter or pickup shelf when you arrive.",
      icon: ORDER_STATUS_ICON_ORDER_READY
    }
  ];
}

type Props = {
  milestone: number;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** In hero mode, hide header/hint so it fits the image frame. */
  variant?: "hero" | "section";
};

export function OrderLiveStatusView(props: Props) {
  const { milestone, status, createdAt, updatedAt } = props;
  const { width: winW } = useWindowDimensions();
  const steps = React.useMemo(() => buildSteps(), []);
  const deadlineMs = useOrderCountdownDeadlineMs(status, createdAt, updatedAt);
  const nowMs = useTickMs();
  const variant = props.variant ?? "section";

  /** Measured viewport width so each page == visible list width (paging lines up with centering). */
  const [pageW, setPageW] = React.useState(winW);
  const pagePad = 18;

  const listRef = React.useRef<FlatList<LiveStatusStep>>(null);
  const [pageIndex, setPageIndex] = React.useState(milestone);

  React.useEffect(() => {
    setPageIndex(milestone);
  }, [milestone, status]);

  const safePageW = Math.max(1, pageW);

  React.useEffect(() => {
    const off = milestone * safePageW;
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: off, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, [milestone, safePageW]);

  const onMomentumEnd = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const clamped = Math.max(0, Math.min(steps.length - 1, Math.round(x / safePageW)));
      setPageIndex((prev) => {
        if (clamped !== prev) void Haptics.selectionAsync();
        return clamped;
      });
    },
    [safePageW, steps.length]
  );

  React.useEffect(() => {
    setPageW(winW);
  }, [winW]);

  const onListLayout = React.useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w <= 0) return;
    setPageW((prev) => (w === prev ? prev : w));
  }, []);

  const renderItem = React.useCallback(
    ({ item, index: i }: ListRenderItemInfo<LiveStatusStep>) => {
      const active = i === milestone;
      const totalWindowMs = status === "READY" && milestone === 2 ? 25 * 60 * 1000 : 45 * 60 * 1000;
      const remaining = Math.max(0, deadlineMs - nowMs);
      const liveProgress = totalWindowMs > 0 ? clamp01(1 - remaining / totalWindowMs) : 0;
      const progress = i < milestone ? 1 : i > milestone ? 0 : liveProgress;
      return (
        <View style={[styles.page, { width: safePageW, paddingHorizontal: pagePad }]}>
          <View style={styles.pageCard}>
            <BlinkingLiveRing active={active}>
              <ClockBlock
                stepIndex={i}
                milestone={milestone}
                status={status}
                deadlineMs={deadlineMs}
                nowMs={nowMs}
              />
              <View style={styles.iconBadge}>
                <Image source={item.icon} style={styles.stepIcon} resizeMode="contain" accessibilityIgnoresInvertColors />
              </View>
              <Text style={styles.stepTitle}>{item.title}</Text>
              <Text style={styles.stepSubtitle}>{item.subtitle}</Text>
              <LiveLineLoader progress={progress} active={active} />
            </BlinkingLiveRing>
          </View>
        </View>
      );
    },
    [deadlineMs, milestone, nowMs, pagePad, safePageW, status]
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
            Swipe sideways to see all steps. You are on step {milestone + 1} of {steps.length}.
          </Text>
        </>
      ) : null}
      <FlatList
        ref={listRef}
        data={steps}
        horizontal
        pagingEnabled
        style={styles.listTransparent}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onLayout={onListLayout}
        onMomentumScrollEnd={onMomentumEnd}
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
          <View key={s.key} style={[styles.pageDot, i === pageIndex && styles.pageDotActive]} />
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
    width: "100%"
  },
  listTransparent: { backgroundColor: "transparent", alignSelf: "stretch" },
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
    backgroundColor: "transparent"
  },
  pageCard: {
    width: "100%",
    maxWidth: "100%",
    alignSelf: "center"
  },
  liveCardShell: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "transparent",
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
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
  clockLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: R.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4
  },
  clockDigits: {
    fontSize: 28,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    letterSpacing: 1,
    color: R.textSecondary
  },
  clockDigitsLive: {
    color: R.text
  },
  clockMuted: {
    fontSize: 22,
    fontWeight: "800",
    color: R.textMuted
  },
  iconBadge: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.45)",
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
  lineLoaderWrap: {
    width: "100%",
    height: 18,
    justifyContent: "center",
    position: "relative"
  },
  lineTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 999,
    backgroundColor: R.border
  },
  lineFill: {
    position: "absolute",
    left: 0,
    height: 6,
    borderRadius: 999,
    backgroundColor: R.accentBlue
  },
  lineArrow: {
    position: "absolute",
    top: -2,
    transform: [{ translateX: -8 }]
  },
  lineArrowGlyph: { fontSize: 14, fontWeight: "900", color: R.accentBlue },
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
