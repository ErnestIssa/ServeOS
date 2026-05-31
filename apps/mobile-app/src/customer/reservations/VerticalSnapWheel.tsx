import * as Haptics from "expo-haptics";
import React from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { WheelChevronDown, WheelChevronUp } from "./wheelChevronIcons";

/** Main label band — aligned across all wheels at the selection line. */
const MAIN_SLOT = 28;
/** Tiny caption under main; only visible when row is centered. */
const SUB_SLOT = 11;
export const WHEEL_ITEM_HEIGHT = MAIN_SLOT + SUB_SLOT;

const CHEVRON_BAND = 16;
const CHEVRON_SIZE = 15;
const CHEVRON_DISABLED_OPACITY = 0.28;
const CHEVRON_ENABLED_OPACITY = 1;

/** One value row + fixed chevron bands above and below. */
export const WHEEL_VIEW_HEIGHT = CHEVRON_BAND + WHEEL_ITEM_HEIGHT + CHEVRON_BAND;

export type WheelOption = {
  id: string;
  label: string;
  sublabel?: string;
};

type Props = {
  options: readonly WheelOption[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  disabled?: boolean;
  accentColor: string;
  textColor: string;
  accessibilityLabel: string;
  isDark?: boolean;
  /** True while the user is dragging/snapping this wheel — parent sheet scroll should pause. */
  onDragActiveChange?: (active: boolean) => void;
};

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const FLING_VELOCITY_THRESHOLD = 0.55;

function clampIndex(i: number, max: number): number {
  return Math.max(0, Math.min(max, i));
}

function offsetForIndex(index: number): number {
  return index * WHEEL_ITEM_HEIGHT;
}

function settleIndexFromOffset(y: number, count: number, velocityY: number | undefined): number {
  const v = velocityY ?? 0;
  const scale = Platform.OS === "ios" ? 0.028 : 0.034;
  const projected = y + v * scale;
  return clampIndex(Math.round(projected / WHEEL_ITEM_HEIGHT), count - 1);
}

function centerIndexFromOffset(y: number, maxIndex: number): number {
  return clampIndex(Math.round(y / WHEEL_ITEM_HEIGHT), maxIndex);
}

function fireHapticsForIndexPassage(fromIdx: number, toIdx: number) {
  if (fromIdx === toIdx) return;
  void Haptics.selectionAsync();
}

const WheelRow = React.memo(function WheelRow({
  scrollY,
  index,
  label,
  sublabel,
  accentColor,
  textColor
}: {
  scrollY: Animated.Value;
  index: number;
  label: string;
  sublabel?: string;
  accentColor: string;
  textColor: string;
}) {
  const center = offsetForIndex(index);
  const rowOpacity = scrollY.interpolate({
    inputRange: [center - WHEEL_ITEM_HEIGHT * 0.42, center, center + WHEEL_ITEM_HEIGHT * 0.42],
    outputRange: [0, 1, 0],
    extrapolate: "clamp"
  });
  const subOpacity = rowOpacity;

  return (
    <Animated.View style={[styles.row, { opacity: rowOpacity }]}>
      <View style={styles.mainSlot}>
        <Text style={[styles.rowLabel, { color: accentColor }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Animated.View style={[styles.subSlot, { opacity: subOpacity }]}>
        {sublabel ? (
          <Text style={[styles.rowSub, { color: textColor }]} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
});

function VerticalSnapWheelInner(props: Props) {
  const count = props.options.length;
  const maxIndex = Math.max(0, count - 1);
  const scrollRef = React.useRef<ScrollView | null>(null);
  const scrollY = React.useRef(new Animated.Value(offsetForIndex(props.selectedIndex))).current;
  const draggingRef = React.useRef(false);
  const settlingRef = React.useRef(false);
  const settledOnDragEndRef = React.useRef(false);
  const dragSessionRef = React.useRef(0);
  const releaseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHapticIndex = React.useRef(props.selectedIndex);
  const lastCommittedIndex = React.useRef(props.selectedIndex);
  const [centerIndex, setCenterIndex] = React.useState(props.selectedIndex);

  const { selectedIndex, onIndexChange, disabled, isDark = false, onDragActiveChange } = props;

  const clearReleaseTimer = React.useCallback(() => {
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }, []);

  const endDragSession = React.useCallback(
    (force = false) => {
      if (!force && draggingRef.current) return;
      clearReleaseTimer();
      draggingRef.current = false;
      settlingRef.current = false;
      onDragActiveChange?.(false);
    },
    [clearReleaseTimer, onDragActiveChange]
  );

  const beginDragSession = React.useCallback(() => {
    dragSessionRef.current += 1;
    draggingRef.current = true;
    settlingRef.current = false;
    clearReleaseTimer();
    onDragActiveChange?.(true);
    const session = dragSessionRef.current;
    releaseTimerRef.current = setTimeout(() => {
      if (dragSessionRef.current !== session) return;
      endDragSession(true);
    }, 750);
  }, [clearReleaseTimer, endDragSession, onDragActiveChange]);

  React.useEffect(() => () => clearReleaseTimer(), [clearReleaseTimer]);
  const mutedColor = isDark ? "rgba(148,163,184,0.45)" : "rgba(100,116,139,0.4)";

  const canGoUp = centerIndex > 0;
  const canGoDown = centerIndex < maxIndex;

  const scrollToOffset = React.useCallback(
    (y: number, animated: boolean) => {
      scrollRef.current?.scrollTo({ y, animated });
      if (!animated) {
        scrollY.setValue(y);
      }
    },
    [scrollY]
  );

  const scrollToIndex = React.useCallback(
    (index: number, animated: boolean) => {
      const clamped = clampIndex(index, maxIndex);
      scrollToOffset(offsetForIndex(clamped), animated);
      lastHapticIndex.current = clamped;
      lastCommittedIndex.current = clamped;
      setCenterIndex(clamped);
    },
    [maxIndex, scrollToOffset]
  );

  /** Keep native offset + animated scrollY aligned with `selectedIndex` (restored drafts mount at y=0). */
  const syncToSelectedIndex = React.useCallback(() => {
    if (draggingRef.current || settlingRef.current) return;
    const next = clampIndex(selectedIndex, maxIndex);
    const y = offsetForIndex(next);
    scrollRef.current?.scrollTo({ y, animated: false });
    scrollY.setValue(y);
    lastHapticIndex.current = next;
    lastCommittedIndex.current = next;
    setCenterIndex(next);
  }, [maxIndex, scrollY, selectedIndex]);

  React.useEffect(() => {
    syncToSelectedIndex();
  }, [syncToSelectedIndex]);

  const onScrollOffset = React.useCallback(
    (y: number) => {
      const centerIdx = centerIndexFromOffset(y, maxIndex);
      setCenterIndex(centerIdx);
      if (centerIdx === lastHapticIndex.current) return;
      fireHapticsForIndexPassage(lastHapticIndex.current, centerIdx);
      lastHapticIndex.current = centerIdx;
    },
    [maxIndex]
  );

  const commitIndex = React.useCallback(
    (idx: number) => {
      const clamped = clampIndex(idx, maxIndex);
      lastCommittedIndex.current = clamped;
      lastHapticIndex.current = clamped;
      setCenterIndex(clamped);
      if (clamped !== selectedIndex) {
        onIndexChange(clamped);
      }
    },
    [maxIndex, onIndexChange, selectedIndex]
  );

  const settleAt = React.useCallback(
    (y: number, velocityY: number | undefined) => {
      settlingRef.current = true;
      const idx = settleIndexFromOffset(y, count, velocityY);
      scrollToOffset(offsetForIndex(idx), true);
      commitIndex(idx);
      clearReleaseTimer();
      const session = dragSessionRef.current;
      releaseTimerRef.current = setTimeout(() => {
        if (dragSessionRef.current !== session) return;
        endDragSession(true);
      }, 300);
    },
    [clearReleaseTimer, commitIndex, count, endDragSession, scrollToOffset]
  );

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScrollOffset(e.nativeEvent.contentOffset.y);
    }
  });

  const onScrollEndDrag = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const vy = e.nativeEvent.velocity?.y ?? 0;
      if (Math.abs(vy) < FLING_VELOCITY_THRESHOLD) {
        draggingRef.current = false;
        settledOnDragEndRef.current = true;
        settleAt(e.nativeEvent.contentOffset.y, vy);
      } else {
        settledOnDragEndRef.current = false;
      }
    },
    [settleAt]
  );

  const onMomentumScrollEnd = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      draggingRef.current = false;
      if (settledOnDragEndRef.current) {
        settledOnDragEndRef.current = false;
        endDragSession(true);
        return;
      }
      settleAt(e.nativeEvent.contentOffset.y, 0);
    },
    [endDragSession, settleAt]
  );

  const nudgeIndex = React.useCallback(
    (delta: -1 | 1) => {
      if (disabled) return;
      const next = clampIndex(centerIndex + delta, maxIndex);
      if (next === centerIndex) return;
      beginDragSession();
      scrollToIndex(next, true);
      commitIndex(next);
      clearReleaseTimer();
      const session = dragSessionRef.current;
      releaseTimerRef.current = setTimeout(() => {
        if (dragSessionRef.current !== session) return;
        endDragSession(true);
      }, 320);
    },
    [beginDragSession, centerIndex, clearReleaseTimer, commitIndex, disabled, endDragSession, maxIndex, scrollToIndex]
  );

  return (
    <View style={styles.frame} accessibilityLabel={props.accessibilityLabel} accessibilityRole="adjustable">
      <View style={styles.valueViewport}>
        <AnimatedScrollView
          ref={scrollRef}
          scrollEnabled={!disabled}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          snapToInterval={WHEEL_ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEventThrottle={1}
          onLayout={syncToSelectedIndex}
          onContentSizeChange={syncToSelectedIndex}
          onScroll={onScroll}
          onScrollBeginDrag={beginDragSession}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          contentContainerStyle={styles.scrollContent}
        >
          {props.options.map((opt, i) => (
            <WheelRow
              key={opt.id}
              scrollY={scrollY}
              index={i}
              label={opt.label}
              sublabel={opt.sublabel}
              accentColor={props.accentColor}
              textColor={props.textColor}
            />
          ))}
        </AnimatedScrollView>
      </View>

      <View style={styles.chromeOverlay} pointerEvents="box-none">
        <View style={styles.chevronBand}>
          <Pressable
            onPress={() => nudgeIndex(-1)}
            disabled={disabled || !canGoUp}
            hitSlop={8}
            style={({ pressed }) => [styles.chevronHit, pressed && canGoUp && styles.chevronPressed]}
            accessibilityRole="button"
            accessibilityLabel="Previous value"
            accessibilityState={{ disabled: disabled || !canGoUp }}
          >
            <View style={{ opacity: canGoUp ? CHEVRON_ENABLED_OPACITY : CHEVRON_DISABLED_OPACITY }}>
              <WheelChevronUp
                size={CHEVRON_SIZE}
                color={canGoUp ? props.accentColor : mutedColor}
              />
            </View>
          </Pressable>
        </View>

        <View style={styles.chromeSpacer} pointerEvents="none" />

        <View style={styles.chevronBand}>
          <Pressable
            onPress={() => nudgeIndex(1)}
            disabled={disabled || !canGoDown}
            hitSlop={8}
            style={({ pressed }) => [styles.chevronHit, pressed && canGoDown && styles.chevronPressed]}
            accessibilityRole="button"
            accessibilityLabel="Next value"
            accessibilityState={{ disabled: disabled || !canGoDown }}
          >
            <View style={{ opacity: canGoDown ? CHEVRON_ENABLED_OPACITY : CHEVRON_DISABLED_OPACITY }}>
              <WheelChevronDown
                size={CHEVRON_SIZE}
                color={canGoDown ? props.accentColor : mutedColor}
              />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export const VerticalSnapWheel = React.memo(VerticalSnapWheelInner);

const styles = StyleSheet.create({
  frame: {
    height: WHEEL_VIEW_HEIGHT,
    overflow: "hidden"
  },
  valueViewport: {
    height: WHEEL_ITEM_HEIGHT,
    marginTop: CHEVRON_BAND,
    overflow: "hidden"
  },
  scrollContent: {
    paddingVertical: 0
  },
  chromeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4
  },
  chevronBand: {
    height: CHEVRON_BAND,
    justifyContent: "center",
    alignItems: "center"
  },
  chromeSpacer: {
    flex: 1
  },
  chevronHit: {
    minWidth: 32,
    minHeight: CHEVRON_BAND,
    justifyContent: "center",
    alignItems: "center"
  },
  chevronPressed: {
    opacity: 0.65
  },
  row: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: "center",
    paddingHorizontal: 2
  },
  mainSlot: {
    height: MAIN_SLOT,
    width: "100%",
    justifyContent: "center",
    alignItems: "center"
  },
  subSlot: {
    height: SUB_SLOT,
    width: "100%",
    justifyContent: "flex-start",
    alignItems: "center"
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.35,
    textAlign: "center"
  },
  rowSub: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    opacity: 0.92
  }
});
