import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { useAppTheme } from "../../theme/AppThemeContext";
import { R } from "../../theme";

export function useSkeletonTone() {
  const { isDark } = useAppTheme();
  return React.useMemo(
    () => ({
      soft: isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.06)",
      strong: isDark ? "rgba(255,255,255,0.11)" : "rgba(15,23,42,0.1)",
      fadeTop: isDark ? "rgba(11,18,32,0)" : "rgba(255,255,255,0)",
      fadeMid: isDark ? "rgba(11,18,32,0.55)" : "rgba(255,255,255,0.72)",
      fadeBottom: isDark ? "rgba(11,18,32,0.96)" : "rgba(255,255,255,0.98)"
    }),
    [isDark]
  );
}

export function SkeletonPulse({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const pulse = useSharedValue(0.58);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return <Animated.View style={[style, pulseStyle]}>{children}</Animated.View>;
}

export function SkeletonBone({
  tone,
  style
}: {
  tone: string;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.bone, { backgroundColor: tone }, style]} />;
}

/** Soft gradient mask so skeleton content fades out instead of ending abruptly. */
export function SkeletonFadeTail({ height = 120 }: { height?: number }) {
  const tone = useSkeletonTone();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[tone.fadeTop, tone.fadeMid, tone.fadeBottom]}
      locations={[0, 0.45, 1]}
      style={[styles.fadeTail, { height }]}
    />
  );
}

export function SkeletonBlock({
  lines = 3,
  style
}: {
  lines?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = useSkeletonTone();
  return (
    <SkeletonPulse style={style}>
      <View style={styles.block}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBone
            key={i}
            tone={i === 0 ? tone.strong : tone.soft}
            style={[styles.line, { width: i === lines - 1 ? "72%" : "100%" }]}
          />
        ))}
      </View>
    </SkeletonPulse>
  );
}

export function SkeletonListRows({ count = 4, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  const tone = useSkeletonTone();
  return (
    <SkeletonPulse style={style}>
      <View style={styles.list}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.listRow}>
            <SkeletonBone tone={tone.strong} style={styles.listAvatar} />
            <View style={styles.listBody}>
              <SkeletonBone tone={tone.strong} style={styles.listTitle} />
              <SkeletonBone tone={tone.soft} style={styles.listSub} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

export function SkeletonVenueRows({ count = 3, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  const tone = useSkeletonTone();
  return (
    <SkeletonPulse style={style}>
      <View style={styles.list}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.venueRow}>
            <View style={styles.venueText}>
              <SkeletonBone tone={tone.strong} style={styles.venueTitle} />
              <SkeletonBone tone={tone.soft} style={styles.venueTag} />
            </View>
            <SkeletonBone tone={tone.soft} style={styles.venueChev} />
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

export function SkeletonChatThread({ count = 5, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  const tone = useSkeletonTone();
  return (
    <SkeletonPulse style={style}>
      <View style={styles.chatWrap}>
        {Array.from({ length: count }).map((_, i) => {
          const mine = i % 3 === 1;
          return (
            <View key={i} style={[styles.chatRow, mine ? styles.chatRowMine : styles.chatRowOther]}>
              <SkeletonBone
                tone={mine ? tone.strong : tone.soft}
                style={[styles.chatBubble, mine ? styles.chatBubbleMine : styles.chatBubbleOther]}
              />
            </View>
          );
        })}
      </View>
    </SkeletonPulse>
  );
}

export function SkeletonOrderCards({ count = 3, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  const tone = useSkeletonTone();
  return (
    <SkeletonPulse style={style}>
      <View style={styles.list}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.orderCard}>
            <SkeletonBone tone={tone.strong} style={styles.orderTitle} />
            <SkeletonBone tone={tone.soft} style={styles.orderSub} />
            <View style={styles.orderFooter}>
              <SkeletonBone tone={tone.soft} style={styles.orderPill} />
              <SkeletonBone tone={tone.strong} style={styles.orderBtn} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

export function SkeletonScreenFill({
  children,
  style,
  fadeHeight = 140
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fadeHeight?: number;
}) {
  return (
    <View style={[styles.screenFill, style]}>
      {children}
      <SkeletonFadeTail height={fadeHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  bone: { borderRadius: 8 },
  fadeTail: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0
  },
  block: { gap: 10, paddingHorizontal: R.space.sm },
  line: { height: 13, borderRadius: 7 },
  list: { gap: 10, paddingHorizontal: R.space.sm },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4
  },
  listAvatar: { width: 44, height: 44, borderRadius: 14 },
  listBody: { flex: 1, gap: 8 },
  listTitle: { width: "58%", height: 13, borderRadius: 7 },
  listSub: { width: "42%", height: 10, borderRadius: 5 },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10
  },
  venueText: { flex: 1, gap: 6 },
  venueTitle: { width: "64%", height: 13, borderRadius: 7 },
  venueTag: { width: 52, height: 10, borderRadius: 5 },
  venueChev: { width: 12, height: 18, borderRadius: 4 },
  chatWrap: { gap: 12, paddingHorizontal: R.space.sm, paddingTop: 8 },
  chatRow: { flexDirection: "row" },
  chatRowMine: { justifyContent: "flex-end" },
  chatRowOther: { justifyContent: "flex-start" },
  chatBubble: { height: 42, borderRadius: 16 },
  chatBubbleMine: { width: "62%" },
  chatBubbleOther: { width: "54%" },
  orderCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8
  },
  orderTitle: { width: "48%", height: 14, borderRadius: 7 },
  orderSub: { width: "72%", height: 11, borderRadius: 6 },
  orderFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4
  },
  orderPill: { width: 72, height: 22, borderRadius: 11 },
  orderBtn: { width: 88, height: 32, borderRadius: 12 },
  screenFill: {
    flex: 1,
    minHeight: 280,
    overflow: "hidden",
    position: "relative"
  }
});

/** Small pulsing dot for background sync / revalidation. */
export function SkeletonSyncDot({ size = 8, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const tone = useSkeletonTone();
  return (
    <SkeletonPulse style={style}>
      <SkeletonBone tone={tone.strong} style={{ width: size, height: size, borderRadius: size / 2 }} />
    </SkeletonPulse>
  );
}
