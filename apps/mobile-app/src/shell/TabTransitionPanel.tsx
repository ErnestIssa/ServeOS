import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  withTiming,
  Easing
} from "react-native-reanimated";
import type { ScreenTransitionState } from "./directionalScreenTransition";

type Props = {
  tabKey: string;
  activeTab: string;
  tabOrder: readonly string[];
  transition: ScreenTransitionState | null;
  progress: SharedValue<number>;
  width: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

function idleOffsetForTab(tabKey: string, activeTab: string, tabOrder: readonly string[], width: number) {
  "worklet";
  const tabIndex = tabOrder.indexOf(tabKey);
  const activeIndex = tabOrder.indexOf(activeTab);
  if (tabIndex < 0 || activeIndex < 0 || tabKey === activeTab) return 0;
  return tabIndex < activeIndex ? -width : width;
}

export function TabTransitionPanel({
  tabKey,
  activeTab,
  tabOrder,
  transition,
  progress,
  width,
  style,
  children
}: Props) {
  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;

    if (!transition) {
      const isActive = tabKey === activeTab;
      const idleX = idleOffsetForTab(tabKey, activeTab, tabOrder, width);
      return {
        opacity: isActive ? 1 : 0,
        transform: [{ translateX: isActive ? 0 : idleX }],
        zIndex: isActive ? 1 : 0
      };
    }

    const d = transition.direction;

    if (tabKey === transition.to) {
      return {
        opacity: 1,
        transform: [{ translateX: (1 - p) * d * width }],
        zIndex: 2
      };
    }

    if (tabKey === transition.from) {
      return {
        opacity: 1 - p * 0.14,
        transform: [{ translateX: -p * d * width }],
        zIndex: 1
      };
    }

    const idleX = idleOffsetForTab(tabKey, transition.to, tabOrder, width);
    return {
      opacity: 0,
      transform: [{ translateX: idleX }],
      zIndex: 0
    };
  });

  const pointerEvents =
    !transition && tabKey !== activeTab
      ? "none"
      : transition && tabKey !== transition.from && tabKey !== transition.to
        ? "none"
        : "auto";

  return (
    <Animated.View
      style={[styles.panel, style, animatedStyle]}
      pointerEvents={pointerEvents}
      collapsable={false}
    >
      {children}
    </Animated.View>
  );
}

export function runScreenTransitionProgress(progress: SharedValue<number>, onDone: () => void) {
  progress.value = 0;
  progress.value = withTiming(
    1,
    { duration: 340, easing: Easing.out(Easing.cubic) },
    (finished) => {
      if (finished) runOnJS(onDone)();
    }
  );
}

const styles = StyleSheet.create({
  panel: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden"
  }
});
