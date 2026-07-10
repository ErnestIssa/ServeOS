import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { LiquidGlassChrome } from "../../shell/LiquidGlassChrome";
import { NAV_BOTTOM_DOCK_SHELL_BG, navDockGlassTokens } from "../../shell/navDockGlass";
import {
  CHAT_THREAD_NAV_HEIGHT,
  CHAT_THREAD_NAV_TOP_MARGIN,
  FLOAT_MARGIN_SIDE,
  chatThreadNavChromeBottom
} from "../../shell/navBottomMetrics";
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

const CHAT_NAV_RADIUS = CHAT_THREAD_NAV_HEIGHT / 2;

export function ChatThreadNavBar({
  safeAreaTop,
  venueName,
  restaurantOnline = false,
  showStatus = false,
  onBack,
  onCallPress
}: Props) {
  const { colors: theme, isDark } = useAppTheme();
  const glass = React.useMemo(() => navDockGlassTokens(isDark), [isDark]);
  const titleColor = theme.ordersNavPurpleBright;
  const phoneColor = theme.ordersNavPurpleBright;

  return (
    <View
      style={[styles.wrap, { paddingTop: safeAreaTop + CHAT_THREAD_NAV_TOP_MARGIN }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          {
            shadowColor: glass.shadowColor,
            shadowOpacity: glass.shadowOpacity
          }
        ]}
      >
        <LiquidGlassChrome tokens={glass} variant="shell" borderRadius={CHAT_NAV_RADIUS} />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.chipSolidFill, { borderRadius: CHAT_NAV_RADIUS }]}
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
  return chatThreadNavChromeBottom(safeAreaTop);
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 30,
    paddingHorizontal: FLOAT_MARGIN_SIDE
  },
  bar: {
    minHeight: CHAT_THREAD_NAV_HEIGHT,
    borderRadius: CHAT_NAV_RADIUS,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16
      },
      android: { elevation: 10 },
      default: {}
    })
  },
  chipSolidFill: {
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG
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
