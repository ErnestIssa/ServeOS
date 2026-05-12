import { BlurView } from "expo-blur";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { R } from "../theme";

type Props = {
  visible: boolean;
  title?: string;
  onDismiss: () => void;
};

export function NutritionInfoModal({ visible, title = "Order info", onDismiss }: Props) {
  const p = useSharedValue(0);

  React.useEffect(() => {
    p.value = withTiming(visible ? 1 : 0, { duration: visible ? 240 : 160, easing: Easing.out(Easing.cubic) });
  }, [visible, p]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 12 }, { scale: 0.98 + p.value * 0.02 }]
  }));

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss" />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, cardStyle]} accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>
            Nutrition totals, ingredients, and good-to-know info will appear here next. This modal is already wired to open
            only after the cart sheet expands fully.
          </Text>
          <Pressable onPress={onDismiss} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.45)"
  },
  center: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16
  },
  card: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    padding: 16
  },
  title: { fontSize: 18, fontWeight: "900", color: R.text, letterSpacing: -0.2 },
  body: { marginTop: 10, fontSize: 14, lineHeight: 20, color: R.textSecondary, fontWeight: "600" },
  closeBtn: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.92)"
  },
  closeText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  pressed: { opacity: 0.9 }
});

