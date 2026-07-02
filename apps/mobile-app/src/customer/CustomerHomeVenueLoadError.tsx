import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/AppThemeContext";
import { R } from "../theme";

type Props = {
  onSwitchVenue: () => void;
  /** Pin overlay below top chrome (safe area + floating search). */
  top: number;
  /** Reserve space above bottom tab bar. */
  bottom: number;
};

/**
 * Sticky home menu-layer overlay — centered venue error dialog.
 */
export function CustomerHomeVenueLoadError({ onSwitchVenue, top, bottom }: Props) {
  const { colors: t, isDark } = useAppTheme();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        host: {
          position: "absolute",
          left: 0,
          right: 0,
          top,
          bottom,
          zIndex: 12,
          elevation: 12,
          overflow: "hidden"
        },
        modalHost: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: R.space.md,
          paddingTop: 20,
          paddingBottom: 28
        },
        modalCard: {
          width: "100%",
          maxWidth: 332,
          borderRadius: 22,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)",
          backgroundColor: isDark ? "rgba(18,18,22,0.94)" : "rgba(255,255,255,0.96)",
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 18,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: 0.16,
              shadowRadius: 28
            },
            android: { elevation: 12 }
          })
        },
        title: {
          fontSize: 18,
          fontWeight: "900",
          color: t.text,
          letterSpacing: -0.3,
          textAlign: "center"
        },
        message: {
          marginTop: 10,
          fontSize: 13,
          lineHeight: 19,
          fontWeight: "600",
          color: t.textSecondary,
          textAlign: "center"
        },
        footer: {
          marginTop: 18,
          width: "100%",
          alignItems: "center"
        },
        action: {
          width: "100%",
          minHeight: 48,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          paddingVertical: 13,
          backgroundColor: t.accentPurple
        },
        actionText: {
          color: "#fff",
          fontSize: 15,
          fontWeight: "900",
          textAlign: "center"
        },
        pressed: { opacity: 0.9 }
      }),
    [isDark, t]
  );

  return (
    <View style={styles.host} pointerEvents="box-none" accessibilityRole="alert">
      <View style={styles.modalHost} pointerEvents="box-none">
        <View style={styles.modalCard} pointerEvents="auto">
          <Text style={styles.title}>Could not load this venue</Text>
          <Text style={styles.message}>
            This venue may no longer be available. Choose another venue to continue.
          </Text>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch venue"
              onPress={onSwitchVenue}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Text style={styles.actionText}>Switch venue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
