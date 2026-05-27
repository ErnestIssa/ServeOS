import { BlurView } from "expo-blur";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useAppTheme } from "../theme/AppThemeContext";

type Props = {
  visible: boolean;
  title?: string;
  onDismiss: () => void;
};

export function NutritionInfoModal({ visible, title = "Order info", onDismiss }: Props) {
  const { colors: t, isDark } = useAppTheme();
  const p = useSharedValue(0);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isDark ? "rgba(0,0,0,0.65)" : "rgba(2,6,23,0.45)"
        },
        center: { flex: 1, justifyContent: "flex-end", padding: 16 },
        card: {
          borderRadius: 22,
          backgroundColor: t.bg,
          borderWidth: 1,
          borderColor: t.border,
          padding: 16
        },
        title: { fontSize: 18, fontWeight: "900", color: t.text, letterSpacing: -0.2 },
        body: { marginTop: 10, fontSize: 14, lineHeight: 20, color: t.textSecondary, fontWeight: "600" },
        closeBtn: {
          marginTop: 14,
          borderRadius: 16,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.accentPurple
        },
        closeText: { color: "#fff", fontSize: 14, fontWeight: "900" },
        pressed: { opacity: 0.9 }
      }),
    [t, isDark]
  );

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

