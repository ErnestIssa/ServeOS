import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { FLOATING_TOP_BAR_HEIGHT, FLOATING_TOP_GAP, FLOATING_TOP_NUDGE } from "../../shell/FloatingTopBar";
import { useAppTheme } from "../../theme/AppThemeContext";
import { R } from "../../theme";
import type { CustomerChatVenueStatus } from "../customerChatApi";
import { ChatVenueStatusRow } from "./ChatVenueStatusRow";

/** Must match `scrollTopPad` in App.tsx: `R.space.sm + safeTop + FLOATING_TOP_BAR_HEIGHT + this`. */
const SCROLL_GAP_BELOW_TOP_NAV = 18;

/** Highest compact title Y: 2px under the floating search capsule. */
function compactTitleTop(scrollTopPad: number): number {
  const safeTop = scrollTopPad - R.space.sm - FLOATING_TOP_BAR_HEIGHT - SCROLL_GAP_BELOW_TOP_NAV;
  return FLOATING_TOP_NUDGE + safeTop + FLOATING_TOP_GAP + FLOATING_TOP_BAR_HEIGHT + 4;
}

/** Body height below safe-area inset (large title + status row). */
export const CHAT_HEADER_EXPANDED_BODY = 78;

export const CHAT_COLLAPSE_DISTANCE = 84;

export function chatListTopInset(scrollTopPad: number): number {
  return scrollTopPad + CHAT_HEADER_EXPANDED_BODY;
}

type Props = {
  scrollY: Animated.Value;
  topInset: number;
  showStatus: boolean;
  openingHours: string | null | undefined;
  venueStatus?: CustomerChatVenueStatus | null;
  onInfoPress?: () => void;
};

/**
 * Large “Chat” + venue status at rest; compacts into a nav-style title on scroll
 * (same interpolation curve family as Book / ReservationImmersiveHero).
 */
export function ChatCollapsingHeader(props: Props) {
  const { scrollY, topInset, showStatus, openingHours, venueStatus, onInfoPress } = props;
  const { colors: theme, isDark } = useAppTheme();
  const titleColor = theme.ordersNavPurpleBright;
  const blurTint = isDark ? "dark" : "light";
  const androidGlass = isDark ? "rgba(11,18,32,0.78)" : "rgba(255,255,255,0.82)";
  const pillBorder = isDark ? "rgba(124,58,237,0.45)" : "rgba(124,58,237,0.28)";

  const collapse = scrollY.interpolate({
    inputRange: [0, CHAT_COLLAPSE_DISTANCE],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });

  const largeOpacity = collapse.interpolate({
    inputRange: [0, 0.68, 1],
    outputRange: [1, 0.18, 0],
    extrapolate: "clamp"
  });
  const compactOpacity = collapse.interpolate({
    inputRange: [0, 0.26, 1],
    outputRange: [0, 0.6, 1],
    extrapolate: "clamp"
  });
  const statusOpacity = collapse.interpolate({
    inputRange: [0, 0.32, 0.62],
    outputRange: [1, 0.35, 0],
    extrapolate: "clamp"
  });
  const statusTranslateY = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
    extrapolate: "clamp"
  });
  const statusScale = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.94],
    extrapolate: "clamp"
  });
  const largeTranslateY = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -14],
    extrapolate: "clamp"
  });
  const largeScale = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.88],
    extrapolate: "clamp"
  });
  const headlineSize = scrollY.interpolate({
    inputRange: [0, CHAT_COLLAPSE_DISTANCE],
    outputRange: [28, 17],
    extrapolate: "clamp"
  });
  const compactScale = collapse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
    extrapolate: "clamp"
  });
  /** Glass pill appears once the title has nearly settled in the compact slot. */
  const compactGlassOpacity = collapse.interpolate({
    inputRange: [0.52, 0.78, 1],
    outputRange: [0, 0.92, 1],
    extrapolate: "clamp"
  });

  const compactTop = compactTitleTop(topInset);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        style={[
          styles.compactNav,
          {
            top: compactTop,
            opacity: compactOpacity,
            transform: [{ scale: compactScale }]
          }
        ]}
      >
        <View style={[styles.compactPill, { borderColor: pillBorder }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: compactGlassOpacity }]} pointerEvents="none">
            {Platform.OS === "ios" ? (
              <BlurView intensity={36} tint={blurTint} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: androidGlass }]} />
            )}
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(124,58,237,0.14)", "rgba(11,18,32,0.06)"]
                  : ["rgba(255,255,255,0.55)", "rgba(248,250,252,0.12)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </Animated.View>
          <Text style={[styles.compactTitle, { color: titleColor }]} numberOfLines={1}>
            Chat
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.expanded,
          {
            paddingTop: topInset + 6,
            opacity: largeOpacity,
            transform: [{ translateY: largeTranslateY }, { scale: largeScale }]
          }
        ]}
      >
        <Animated.Text
          style={[styles.headline, { color: titleColor, fontSize: headlineSize }]}
          numberOfLines={1}
        >
          Chat
        </Animated.Text>
        {showStatus ? (
          <Animated.View
            style={{
              opacity: statusOpacity,
              transform: [{ translateY: statusTranslateY }, { scale: statusScale }]
            }}
            pointerEvents="box-none"
          >
            <ChatVenueStatusRow
              openingHours={openingHours}
              venueStatus={venueStatus}
              onInfoPress={onInfoPress}
            />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 12,
    paddingHorizontal: R.space.sm
  },
  compactNav: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  compactPill: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#4C1D95",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10
      },
      android: { elevation: 4 },
      default: {}
    })
  },
  compactTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.25,
    lineHeight: 20,
    textAlign: "center"
  },
  expanded: {
    paddingBottom: 6,
    minHeight: CHAT_HEADER_EXPANDED_BODY - 4,
    justifyContent: "flex-end",
    zIndex: 2
  },
  headline: {
    fontWeight: "800",
    letterSpacing: -0.35
  }
});
