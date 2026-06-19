import React from "react";
import type { ScrollViewProps } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { useAnimatedScrollHandler } from "react-native-reanimated";
import { useNavSheetScrollContext } from "./NavSheetScrollContext";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

type Props = ScrollViewProps & {
  children: React.ReactNode;
};

/**
 * ScrollView for nav expand sheet content — tracks scroll offset so the sheet pan
 * can take over when the user pulls at the top or bottom of the scroll area.
 */
export function NavSheetScrollView(props: Props) {
  const { children, onScroll, scrollEventThrottle = 16, ...rest } = props;
  const ctx = useNavSheetScrollContext();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      if (ctx) {
        ctx.scrollYSV.value = e.contentOffset.y;
        const atEnd =
          e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 12;
        ctx.scrollAtEndSV.value = atEnd ? 1 : 0;
      }
    }
  });

  const body = (
    <AnimatedScrollView
      {...rest}
      onScroll={scrollHandler}
      scrollEventThrottle={scrollEventThrottle}
    >
      {children}
    </AnimatedScrollView>
  );

  if (!ctx) return body;

  return <GestureDetector gesture={ctx.nativeScrollGesture}>{body}</GestureDetector>;
}
