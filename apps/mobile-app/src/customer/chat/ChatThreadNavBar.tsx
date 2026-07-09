import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { CHAT_THREAD_NAV_HEIGHT, FLOAT_MARGIN_SIDE } from "../../shell/navBottomMetrics";
import { useAppTheme } from "../../theme/AppThemeContext";
import { ChatIconPhone } from "./ChatIconPhone";
import { ChatVenueStatusRow } from "./ChatVenueStatusRow";

type Props = {
  safeAreaTop: number;
  venueName: string;
  restaurantOnline?: boolean;
  showStatus?: boolean;
  onBack: () => void;
  onCallPress?: () => void;
};

export function ChatThreadNavBar({
  safeAreaTop,
  venueName,
  restaurantOnline = false,
  showStatus = false,
  onBack,
  onCallPress
}: Props) {
  const { colors: theme, isDark } = useAppTheme();
  const titleColor = theme.ordersNavPurpleBright;
  const phoneColor = theme.ordersNavPurpleBright;
  const pillBorder = isDark ? theme.border : theme.borderStrong;
  const androidGlass = isDark ? theme.bgElevated : theme.bg;
  const barShadow = theme.shadow;

  return (
    <View style={[styles.wrap, { paddingTop: safeAreaTop + 4 }]} pointerEvents="box-none">
      <View style={[styles.bar, { borderColor: pillBorder, shadowColor: barShadow }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={38} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: androidGlass, opacity: 0.94 }]} />
        )}
        <LinearGradient
          colors={
            isDark
              ? [theme.bgSubtle, theme.bgElevated]
              : [theme.menuGradient[0], theme.menuGradient[2]]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}
          pointerEvents="none"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={[styles.backChevron, { color: titleColor }]} allowFontScaling={false}>
            ‹
          </Text>
        </Pressable>

        <View style={styles.centerCol}>
          <Text style={[styles.venueName, { color: titleColor }]} numberOfLines={1}>
            {venueName.trim() || "Venue"}
          </Text>
          {showStatus ? <ChatVenueStatusRow restaurantOnline={restaurantOnline} /> : null}
        </View>

        {onCallPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${venueName.trim() || "venue"}`}
            onPress={onCallPress}
            hitSlop={10}
            style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
          >
            <ChatIconPhone color={phoneColor} size={26} />
          </Pressable>
        ) : (
          <View style={styles.callSpacer} />
        )}
      </View>
    </View>
  );
}

export function chatThreadListTopInset(safeAreaTop: number): number {
  return safeAreaTop + CHAT_THREAD_NAV_HEIGHT + 14;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 12,
    paddingHorizontal: FLOAT_MARGIN_SIDE
  },
  bar: {
    minHeight: CHAT_THREAD_NAV_HEIGHT,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10
      },
      android: { elevation: 4 }
    })
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  backChevron: {
    fontSize: 30,
    fontWeight: "300",
    lineHeight: 32,
    marginTop: -2
  },
  centerCol: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  venueName: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.25,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: "100%"
  },
  callBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  callSpacer: { width: 40, height: 40 },
  pressed: { opacity: 0.88 }
});
