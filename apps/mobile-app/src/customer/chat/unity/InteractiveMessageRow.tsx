import Ionicons from "@expo/vector-icons/Ionicons";
import { type ReactNode, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { hapticMedium, hapticSuccess } from "./haptics";

type Props = {
  isOwn: boolean;
  children: ReactNode;
  onDoubleTap: () => void;
  onLongPress: () => void;
  onSwipeReply: () => void;
};

const SWIPE_THRESHOLD = 48;
const MAX_SWIPE = 80;

export function InteractiveMessageRow({
  isOwn,
  children,
  onDoubleTap,
  onLongPress,
  onSwipeReply
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const triggered = useRef(false);

  const towardCenter = (dx: number) => {
    if (isOwn) return Math.max(-dx, dx);
    return Math.max(dx, 0);
  };

  const replyOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      void hapticSuccess();
      onDoubleTap();
      return;
    }
    lastTap.current = now;
  };

  const onGestureEvent = (e: { nativeEvent: { translationX: number } }) => {
    const tc = towardCenter(e.nativeEvent.translationX);
    const clamped = Math.max(0, Math.min(tc, MAX_SWIPE));
    const signed = isOwn && e.nativeEvent.translationX > 0 ? clamped : isOwn ? -clamped : clamped;
    translateX.setValue(signed);
  };

  const onHandlerStateChange = (e: { nativeEvent: { state: number; translationX: number } }) => {
    const { state, translationX: dx } = e.nativeEvent;
    if (state === State.BEGAN) triggered.current = false;
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      if (!triggered.current && towardCenter(dx) >= SWIPE_THRESHOLD) {
        triggered.current = true;
        hapticMedium();
        onSwipeReply();
      }
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7
      }).start();
    }
  };

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.replyHint,
          isOwn ? styles.replyHintOwn : styles.replyHintOther,
          { opacity: replyOpacity }
        ]}
      >
        <Ionicons name="arrow-undo" size={18} color="#175F61" />
      </Animated.View>

      <PanGestureHandler
        activeOffsetX={[-12, 12]}
        failOffsetY={[-12, 12]}
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
          <Pressable
            onPress={handlePress}
            onLongPress={() => {
              hapticMedium();
              onLongPress();
            }}
            delayLongPress={380}
            style={styles.pressable}
          >
            {children}
          </Pressable>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    width: "100%"
  },
  row: { width: "100%" },
  pressable: { width: "100%" },
  replyHint: {
    position: "absolute",
    top: "50%",
    marginTop: -14,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1
  },
  replyHintOwn: { left: 4 },
  replyHintOther: { right: 4 }
});
