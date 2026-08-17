import { ReactNode, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { type HapticKind, triggerHaptic } from "./haptics";

type Props = Omit<PressableProps, "style"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: HapticKind;
  hapticOnPressIn?: boolean;
};

export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  haptic = "light",
  hapticOnPressIn = false,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: value < 1 ? 70 : 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        animateTo(scaleTo);
        if (hapticOnPressIn && haptic !== "none") triggerHaptic(haptic);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        onPress?.(e);
        if (!hapticOnPressIn && haptic !== "none") triggerHaptic(haptic);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
