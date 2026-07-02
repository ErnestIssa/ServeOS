import React from "react";
import { useWindowDimensions } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import {
  screenTransitionDirection,
  type ScreenTransitionState
} from "./directionalScreenTransition";
import { runScreenTransitionProgress } from "./TabTransitionPanel";

export function useDirectionalTabNavigation(
  activeTab: string,
  setActiveTab: (tab: string) => void,
  tabOrder: readonly string[]
) {
  const { width } = useWindowDimensions();
  const progress = useSharedValue(1);
  const [transition, setTransition] = React.useState<ScreenTransitionState | null>(null);
  const activeRef = React.useRef(activeTab);
  activeRef.current = activeTab;

  const finishTransition = React.useCallback(() => {
    setTransition(null);
  }, []);

  const navigateTab = React.useCallback(
    (next: string) => {
      if (next === activeRef.current) return;
      const direction = screenTransitionDirection(activeRef.current, next, tabOrder);
      if (direction === 0) {
        setActiveTab(next);
        return;
      }
      setTransition({ from: activeRef.current, to: next, direction });
      setActiveTab(next);
      runScreenTransitionProgress(progress, finishTransition);
    },
    [finishTransition, progress, setActiveTab, tabOrder]
  );

  return { navigateTab, transition, progress, width, activeTab };
}
