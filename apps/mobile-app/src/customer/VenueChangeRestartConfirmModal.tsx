import { BlurView } from "expo-blur";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { R } from "../theme";

export type VenueChangeRestartConfirmOverlayProps = {
  userFirstName: string;
  currentVenueName: string;
  nextVenueName: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
};

/**
 * In-Modal overlay (not a separate Modal) so it always stacks above the venue sheet and rest of the app tree inside the same Modal.
 */
export function VenueChangeRestartConfirmOverlay(props: VenueChangeRestartConfirmOverlayProps) {
  const { userFirstName, currentVenueName, nextVenueName, onCancel, onConfirm, loading } = props;
  const p = useSharedValue(0);

  React.useEffect(() => {
    p.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [p]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.94 + p.value * 0.06 }]
  }));

  const first = userFirstName.trim() || "there";

  return (
    <View style={styles.root} pointerEvents="auto">
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Dismiss" />
      </Animated.View>

      <View style={styles.centerWrap} pointerEvents="box-none">
        <Animated.View style={[styles.card, cardStyle]} accessibilityRole="alert">
          <Text style={styles.badge}>Restart the app</Text>
          <Text style={styles.title}>Hi {first}, one quick step</Text>
          <Text style={styles.body}>
            You are about to leave{" "}
            <Text style={styles.emphasis}>{currentVenueName}</Text>
            {" "}and start ordering from{" "}
            <Text style={styles.emphasis}>{nextVenueName}</Text>
            . Menus and your basket stay with each restaurant, so we will restart the app after you confirm so everything matches
            your new choice.
          </Text>
          <Text style={styles.subtle}>If you are not ready yet, tap Cancel and nothing will change.</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={({ pressed }) => [styles.cancelBtn, (pressed || loading) && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void onConfirm()}
              disabled={loading}
              style={({ pressed }) => [styles.confirmBtn, (pressed || loading) && styles.pressed]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>Confirm and restart</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 100
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.55)"
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 22
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 2,
    borderColor: "rgba(239,68,68,0.55)",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 24
  },
  badge: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "900",
    color: R.danger,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8
  },
  title: { fontSize: 20, fontWeight: "900", color: R.text, letterSpacing: -0.35 },
  body: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: R.textSecondary,
    fontWeight: "600"
  },
  emphasis: { fontWeight: "900", color: R.text },
  subtle: { marginTop: 12, fontSize: 13, lineHeight: 19, color: R.textMuted, fontWeight: "600" },
  actions: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "stretch"
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: R.bgSubtle,
    borderWidth: 1,
    borderColor: R.border
  },
  cancelText: { fontSize: 15, fontWeight: "800", color: R.text },
  confirmBtn: {
    flex: 1,
    marginLeft: 10,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: R.danger
  },
  confirmText: { fontSize: 15, fontWeight: "900", color: "#fff" },
  pressed: { opacity: 0.88 }
});
