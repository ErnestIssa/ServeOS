import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

export const FLOATING_TOP_BAR_HEIGHT = 56;
export const FLOATING_TOP_GAP = 10;
/** Thin outer stroke for the floating nav capsule (bold violet). */
const NAV_PURPLE_BORDER = "#7C3AED";

/** Matches current tab ambient page colors in a richer, capsule-friendly gradient. */
export type NavPageGradient = { crest: string; deep: string };

type Props =
  | {
      variant?: "default";
      topInset: number;
      scrollY: Animated.Value;
      navGradient: NavPageGradient;
      leftLabel: string;
      centerTitle: string;
      notificationCount?: number;
      onLeftPress?: () => void;
      onSearch?: () => void;
      onNotifications?: () => void;
      onMenu?: () => void;
    }
  | {
      variant: "customer";
      topInset: number;
      scrollY: Animated.Value;
      navGradient: NavPageGradient;
      searchPlaceholder?: string;
      searchValue: string;
      onSearchChange: (text: string) => void;
      onSearchSubmit?: () => void;
      onMenu?: () => void;
    };

function IconSearch({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M10 18a8 8 0 1 1 5.293-14.01A8 8 0 0 1 10 18Zm0-14a6 6 0 1 0 3.96 10.5A6 6 0 0 0 10 4Zm10.707 17.293-4.112-4.112a1 1 0 0 1 1.414-1.414l4.112 4.112a1 1 0 0 1-1.414 1.414Z"
      />
    </Svg>
  );
}

function IconBell({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12 22a2.25 2.25 0 0 0 2.235-2H9.765A2.25 2.25 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.708V3.25a2 2 0 0 0-4 0v1.042A7 7 0 0 0 5 11v5l-1.2 1.6a1 1 0 0 0 .8 1.4h14.8a1 1 0 0 0 .8-1.4L19 16Z"
      />
    </Svg>
  );
}

function IconMenu({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M4 7a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5Z"
      />
    </Svg>
  );
}

type CustomerChromeProps = Extract<Props, { variant: "customer" }> & { iconColor: string };

function CustomerTopBarChrome({
  iconColor,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onSearchSubmit,
  onMenu
}: CustomerChromeProps) {
  return (
    <View style={[styles.row, styles.customerRow]}>
      <View style={styles.searchFieldCustomer}>
        <IconSearch color="rgba(15,23,42,0.4)" />
        <TextInput
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder ?? "Search"}
          placeholderTextColor="rgba(15,23,42,0.42)"
          style={styles.searchInputCustomer}
          returnKeyType="search"
          onSubmitEditing={onSearchSubmit}
          accessibilityLabel="Search"
          {...(Platform.OS === "ios" ? ({ clearButtonMode: "while-editing" as const } as const) : {})}
        />
      </View>
      <Pressable onPress={onMenu} style={styles.iconBtn} hitSlop={12} accessibilityLabel="Menu">
        <IconMenu color={iconColor} />
      </Pressable>
    </View>
  );
}

type BusinessChromeProps = Exclude<Props, { variant: "customer" }> & { iconColor: string };

function BusinessTopBarChrome({
  iconColor,
  leftLabel,
  centerTitle,
  notificationCount = 0,
  onLeftPress,
  onSearch,
  onNotifications,
  onMenu
}: BusinessChromeProps) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onLeftPress} style={styles.left} hitSlop={10}>
        <Text style={styles.leftText} numberOfLines={1}>
          {leftLabel}
        </Text>
        <Text style={styles.chev}>▼</Text>
      </Pressable>

      <View style={styles.center} pointerEvents="none">
        <Text style={styles.title} numberOfLines={1}>
          {centerTitle}
        </Text>
      </View>

      <View style={styles.right}>
        <Pressable onPress={onSearch} style={styles.iconBtn} hitSlop={10} accessibilityLabel="Search">
          <IconSearch color={iconColor} />
        </Pressable>

        <Pressable
          onPress={onNotifications}
          style={styles.iconBtn}
          hitSlop={10}
          accessibilityLabel="Notifications"
        >
          <IconBell color={iconColor} />
          {notificationCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {notificationCount > 99 ? "99+" : String(notificationCount)}
              </Text>
            </View>
          ) : (
            <View style={styles.badgeDot} />
          )}
        </Pressable>

        <Pressable onPress={onMenu} style={styles.iconBtn} hitSlop={10} accessibilityLabel="Menu">
          <IconMenu color={iconColor} />
        </Pressable>
      </View>
    </View>
  );
}

export function FloatingTopBar(props: Props) {
  const topInset = props.topInset;
  const scrollY = props.scrollY;

  const hideY = scrollY.interpolate({
    inputRange: [0, 70],
    outputRange: [0, -(FLOATING_TOP_BAR_HEIGHT + FLOATING_TOP_GAP + topInset)],
    extrapolate: "clamp"
  });
  const hideOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: "clamp"
  });

  const iconColor = "rgba(255,255,255,0.92)";

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.anchor,
        {
          paddingTop: topInset + FLOATING_TOP_GAP,
          transform: [{ translateY: hideY }],
          opacity: hideOpacity
        }
      ]}
    >
      <View style={styles.outer}>
        <LinearGradient
          colors={[props.navGradient.crest, props.navGradient.deep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientShell}
        >
          <View style={styles.sheen} pointerEvents="none" />

          {props.variant === "customer" ? (
            <CustomerTopBarChrome iconColor={iconColor} {...props} />
          ) : (
            <BusinessTopBarChrome iconColor={iconColor} {...props} />
          )}
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    pointerEvents: "box-none"
  },
  outer: {
    marginHorizontal: 10,
    borderRadius: 22,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 24
      },
      android: { elevation: 16 },
      default: {}
    })
  },
  gradientShell: {
    minHeight: FLOATING_TOP_BAR_HEIGHT,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: NAV_PURPLE_BORDER,
    ...Platform.select({
      android: {
        borderWidth: 1,
        borderColor: NAV_PURPLE_BORDER
      },
      default: {}
    })
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22
  },
  row: {
    minHeight: FLOATING_TOP_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  leftText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "800"
  },
  chev: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    marginTop: 1
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  right: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  },
  badge: {
    position: "absolute",
    right: 6,
    top: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "rgba(15,23,42,0.92)",
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900"
  },
  badgeDot: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.26)"
  },
  customerRow: {
    gap: 10,
    paddingHorizontal: 10
  },
  /** Softer inset on bold nav gradient — airy, not saturated like the chrome. */
  searchFieldCustomer: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.42)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.55)"
  },
  searchInputCustomer: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a"
  }
});

