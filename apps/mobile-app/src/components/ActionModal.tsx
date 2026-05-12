import React from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { R } from "../theme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onDismiss: () => void;
};

export function ActionModal({
  visible,
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onDismiss
}: Props) {
  const p = useSharedValue(0);

  React.useEffect(() => {
    p.value = withTiming(visible ? 1 : 0, { duration: visible ? 220 : 160, easing: Easing.out(Easing.cubic) });
  }, [visible, p]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 10 }, { scale: 0.98 + p.value * 0.02 }]
  }));

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <View style={styles.center}>
        <Animated.View style={[styles.card, cardStyle]} accessibilityRole="alert">
          <View style={styles.head}>
            <View style={styles.redDot} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {secondaryLabel && onSecondary ? (
              <Pressable style={({ pressed }) => [styles.btnGhost, pressed && styles.btnPressed]} onPress={onSecondary}>
                <Text style={styles.btnGhostText}>{secondaryLabel}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]} onPress={onPrimary}>
              <Text style={styles.btnPrimaryText}>{primaryLabel}</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={({ pressed }) => [styles.dismissTap, pressed && styles.dismissPressed]}
            onPress={onDismiss}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.62)"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(254,202,202,0.95)",
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: "#0f172a", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.22, shadowRadius: 28 },
      android: { elevation: 16 }
    })
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" },
  title: { flex: 1, fontSize: 16, fontWeight: "900", color: R.text, letterSpacing: -0.2 },
  message: { marginTop: 10, fontSize: 14, lineHeight: 20, color: R.textSecondary, fontWeight: "600" },
  actions: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  btnPrimary: {
    flexGrow: 1,
    borderRadius: 14,
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  btnGhost: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    backgroundColor: "rgba(248,250,252,0.95)"
  },
  btnGhostText: { color: R.text, fontSize: 14, fontWeight: "800" },
  btnPressed: { opacity: 0.9 },
  dismissTap: { marginTop: 10, alignSelf: "center", paddingVertical: 8, paddingHorizontal: 10 },
  dismissPressed: { opacity: 0.85 },
  dismissText: { fontSize: 12, fontWeight: "800", color: "rgba(100,116,139,0.9)" }
});

