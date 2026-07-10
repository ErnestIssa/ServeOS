import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useAppTheme } from "../theme/AppThemeContext";

export type VenueChangeRestartConfirmOverlayProps = {
  nextVenueName: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  hapticOnConfirm?: boolean;
};

const BLUR_IOS = 22;
const BLUR_ANDROID = 18;

/** Full-screen frosted blur with a compact confirmation card in focus. */
export function VenueChangeRestartConfirmOverlay(props: VenueChangeRestartConfirmOverlayProps) {
  const { nextVenueName, onCancel, onConfirm, loading, hapticOnConfirm } = props;
  const { colors: t, isDark } = useAppTheme();
  const p = useSharedValue(0);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        root: { ...StyleSheet.absoluteFillObject, zIndex: 99999, elevation: 100 },
        blurLayer: { ...StyleSheet.absoluteFillObject },
        blurTint: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isDark ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)"
        },
        centerWrap: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 28
        },
        card: {
          width: "100%",
          maxWidth: 300,
          borderRadius: 20,
          backgroundColor: isDark ? "rgba(24,24,30,0.98)" : "rgba(255,255,255,0.98)",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.1)",
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 16,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 28
            },
            android: { elevation: 16 }
          })
        },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: t.text,
          letterSpacing: -0.3,
          textAlign: "center",
          lineHeight: 24
        },
        venueName: { fontWeight: "900", color: t.text },
        hint: {
          marginTop: 6,
          fontSize: 13,
          lineHeight: 18,
          fontWeight: "600",
          color: t.textMuted,
          textAlign: "center"
        },
        actions: { marginTop: 16, flexDirection: "row", alignItems: "stretch", gap: 8 },
        cancelBtn: {
          flex: 1,
          borderRadius: 12,
          paddingVertical: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.05)",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)"
        },
        cancelText: { fontSize: 14, fontWeight: "700", color: t.textSecondary },
        confirmBtn: {
          flex: 1,
          borderRadius: 12,
          paddingVertical: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.accentBlue
        },
        confirmText: { fontSize: 14, fontWeight: "800", color: "#fff" },
        pressed: { opacity: 0.86 }
      }),
    [t, isDark]
  );

  React.useEffect(() => {
    p.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [p]);

  const blurStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.96 + p.value * 0.04 }]
  }));

  const venue = nextVenueName.trim() || "this venue";

  const handleConfirm = React.useCallback(() => {
    if (hapticOnConfirm) void Haptics.selectionAsync();
    void onConfirm();
  }, [hapticOnConfirm, onConfirm]);

  const blurProps =
    Platform.OS === "android" ? ({ experimentalBlurMethod: "dimezisBlurView" } as const) : {};

  return (
    <View style={styles.root} pointerEvents="box-none" accessibilityViewIsModal>
      <Animated.View style={[styles.blurLayer, blurStyle]} pointerEvents="auto">
        <BlurView
          intensity={Platform.OS === "ios" ? BLUR_IOS : BLUR_ANDROID}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
          {...blurProps}
        />
        <View style={styles.blurTint} pointerEvents="none" />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Dismiss venue switch"
        />
      </Animated.View>

      <View style={styles.centerWrap} pointerEvents="box-none">
        <Animated.View style={[styles.card, cardStyle]} accessibilityRole="alert">
          <Text style={styles.title} numberOfLines={2}>
            Switch to <Text style={styles.venueName}>{venue}</Text>?
          </Text>
          <Text style={styles.hint}>Menu and cart will update.</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={({ pressed }) => [styles.cancelBtn, (pressed || loading) && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={loading}
              style={({ pressed }) => [styles.confirmBtn, (pressed || loading) && styles.pressed]}
            >
              <Text style={[styles.confirmText, loading && { opacity: 0.58 }]}>Switch</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
