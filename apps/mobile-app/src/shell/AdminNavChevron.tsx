import React from "react";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

type Props = {
  open: boolean;
  color?: string;
  size?: number;
};

export function AdminNavChevron({ open, color = "currentColor", size = 14 }: Props) {
  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? "180deg" : "0deg", { duration: 200 }) }]
  }));

  return (
    <Animated.View style={spin}>
      <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <Path d="M2.5 4.5L6 8l3.5-3.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
