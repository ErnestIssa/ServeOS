import React from "react";
import { Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useAppTheme } from "../theme/AppThemeContext";
import { LiquidGlassChrome } from "./LiquidGlassChrome";
import { navDockGlassTokens } from "./navDockGlass";
import {
  FLOAT_MARGIN_SIDE,
  FLOAT_MARGIN_TOP,
  FLOATING_TOP_BAR_HEIGHT
} from "./navBottomMetrics";

export {
  FLOATING_TOP_BAR_HEIGHT,
  FLOAT_MARGIN_TOP
} from "./navBottomMetrics";

/** @deprecated Use FLOAT_MARGIN_TOP — kept for legacy layout math. */
export const FLOATING_TOP_GAP = FLOAT_MARGIN_TOP;
/** @deprecated Top dock no longer uses negative nudge. */
export const FLOATING_TOP_NUDGE = 0;

const STORE_ICON = require("../../assets/store.png");
const DOCK_RADIUS = 999;

type Props =
  | {
      variant?: "default";
      topInset: number;
      navFocusSV?: SharedValue<number>;
      leftLabel: string;
      leftSubLabel?: string;
      centerTitle: string;
      onLeftPress?: () => void;
      onSearch?: () => void;
      onExperienceSwitcher?: () => void;
    }
  | {
      variant: "customer";
      topInset: number;
      navFocusSV?: SharedValue<number>;
      searchPlaceholder?: string;
      searchValue: string;
      onSearchChange: (text: string) => void;
      onSearchSubmit?: () => void;
      searchSheetFullyExpanded?: boolean;
      onSearchExpandSheet?: () => void;
      onExperienceSwitcher?: () => void;
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

function StoreSwitcherButton({
  onPress,
  tintColor
}: {
  onPress?: () => void;
  tintColor: string;
}) {
  if (!onPress) return null;
  return (
    <Pressable
      onPress={onPress}
      style={styles.iconBtn}
      hitSlop={12}
      accessibilityLabel="Switch experience"
    >
      <Image source={STORE_ICON} style={[styles.storeIcon, { tintColor }]} resizeMode="contain" />
    </Pressable>
  );
}

type CustomerChromeProps = Extract<Props, { variant: "customer" }> & {
  iconColor: string;
  searchBorderColor: string;
  searchFieldBg: string;
  searchTextColor: string;
  searchPlaceholderColor: string;
};

function CustomerTopBarChrome({
  iconColor,
  searchBorderColor,
  searchFieldBg,
  searchTextColor,
  searchPlaceholderColor,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onSearchSubmit,
  searchSheetFullyExpanded,
  onSearchExpandSheet,
  onExperienceSwitcher
}: CustomerChromeProps) {
  const expandFirst = typeof onSearchExpandSheet === "function";
  const sheetReadyForTyping = !expandFirst || !!searchSheetFullyExpanded;

  return (
    <View style={[styles.row, styles.customerRow]}>
      <View style={[styles.searchFieldCustomer, { backgroundColor: searchFieldBg, borderColor: searchBorderColor }]}>
        <IconSearch color={iconColor} />
        <TextInput
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder ?? "Search"}
          placeholderTextColor={searchPlaceholderColor}
          style={[styles.searchInputCustomer, { color: searchTextColor }]}
          returnKeyType="search"
          onSubmitEditing={onSearchSubmit}
          accessibilityLabel="Search"
          pointerEvents={sheetReadyForTyping ? "auto" : "none"}
          showSoftInputOnFocus
          {...(Platform.OS === "ios" ? ({ clearButtonMode: "while-editing" as const } as const) : {})}
        />
        {expandFirst && !searchSheetFullyExpanded ? (
          <Pressable
            style={styles.searchFieldTapShield}
            accessibilityRole="button"
            accessibilityLabel="Open search sheet"
            onPress={() => {
              Keyboard.dismiss();
              onSearchExpandSheet?.();
            }}
          />
        ) : null}
      </View>
      <StoreSwitcherButton onPress={onExperienceSwitcher} tintColor={iconColor} />
    </View>
  );
}

type BusinessChromeProps = Exclude<Props, { variant: "customer" }> & {
  iconColor: string;
  titleColor: string;
  subColor: string;
};

function BusinessTopBarChrome({
  iconColor,
  titleColor,
  subColor,
  leftLabel,
  leftSubLabel,
  centerTitle,
  onLeftPress,
  onSearch,
  onExperienceSwitcher
}: BusinessChromeProps) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onLeftPress} style={styles.left} hitSlop={10}>
        <View style={styles.leftTextCol}>
          <View style={styles.leftTitleRow}>
            <Text style={[styles.leftText, { color: titleColor }]} numberOfLines={1}>
              {leftLabel}
            </Text>
            <Text style={[styles.chev, { color: subColor }]}>▼</Text>
          </View>
          {leftSubLabel ? (
            <Text style={[styles.leftSubText, { color: subColor }]} numberOfLines={1}>
              {leftSubLabel}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {centerTitle}
        </Text>
      </View>

      <View style={styles.right}>
        <Pressable onPress={onSearch} style={styles.iconBtn} hitSlop={10} accessibilityLabel="Search">
          <IconSearch color={iconColor} />
        </Pressable>
        <StoreSwitcherButton onPress={onExperienceSwitcher} tintColor={iconColor} />
      </View>
    </View>
  );
}

export function FloatingTopBar(props: Props) {
  const { isDark, colors: theme } = useAppTheme();
  const glass = React.useMemo(() => navDockGlassTokens(isDark), [isDark]);
  const fallbackFocusSV = useSharedValue(1);
  const navFocusSV = props.navFocusSV ?? fallbackFocusSV;
  const dockTop = props.topInset + FLOAT_MARGIN_TOP;

  const dockShellStyle = useAnimatedStyle(() => {
    const focus = navFocusSV.value;
    const scale = interpolate(focus, [0, 1], [0.94, 1], Extrapolation.CLAMP);
    const opacity = interpolate(focus, [0, 1], [0.8, 1], Extrapolation.CLAMP);
    const height = interpolate(
      focus,
      [0, 1],
      [FLOATING_TOP_BAR_HEIGHT - 6, FLOATING_TOP_BAR_HEIGHT],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
      opacity,
      height
    };
  });

  const iconColor = theme.navIconIdle;
  const titleColor = theme.text;
  const subColor = theme.textMuted;
  const searchBorderColor = glass.shellBorder;
  const searchFieldBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)";
  const searchTextColor = theme.text;
  const searchPlaceholderColor = theme.textMuted;

  return (
    <View pointerEvents="box-none" style={styles.screenAnchor}>
      <Animated.View
        style={[
          styles.chromeShell,
          dockShellStyle,
          {
            top: dockTop,
            left: FLOAT_MARGIN_SIDE,
            right: FLOAT_MARGIN_SIDE,
            shadowColor: glass.shadowColor,
            shadowOpacity: glass.shadowOpacity
          }
        ]}
      >
        <LiquidGlassChrome
          tokens={glass}
          variant="shell"
          borderRadius={DOCK_RADIUS}
          focusSV={navFocusSV}
        />

        <View style={styles.chromeBody}>
          {props.variant === "customer" ? (
            <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.customerChromeDismissTap}>
              <CustomerTopBarChrome
                iconColor={iconColor}
                searchBorderColor={searchBorderColor}
                searchFieldBg={searchFieldBg}
                searchTextColor={searchTextColor}
                searchPlaceholderColor={searchPlaceholderColor}
                {...props}
              />
            </Pressable>
          ) : (
            <BusinessTopBarChrome
              iconColor={iconColor}
              titleColor={titleColor}
              subColor={subColor}
              {...props}
            />
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenAnchor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    pointerEvents: "box-none"
  },
  chromeShell: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: DOCK_RADIUS,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 24
      },
      android: { elevation: 16 },
      default: {}
    })
  },
  chromeBody: {
    flex: 1,
    minHeight: FLOATING_TOP_BAR_HEIGHT
  },
  customerChromeDismissTap: {
    flex: 1,
    minHeight: FLOATING_TOP_BAR_HEIGHT,
    justifyContent: "center"
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
    alignItems: "center"
  },
  leftTextCol: { flex: 1, minWidth: 0 },
  leftTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  leftText: {
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1
  },
  leftSubText: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1
  },
  chev: {
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
  storeIcon: {
    width: 22,
    height: 22
  },
  customerRow: {
    gap: 10,
    paddingHorizontal: 10
  },
  searchFieldCustomer: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    position: "relative",
    overflow: "hidden"
  },
  searchFieldTapShield: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4
  },
  searchInputCustomer: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    fontWeight: "700"
  }
});
