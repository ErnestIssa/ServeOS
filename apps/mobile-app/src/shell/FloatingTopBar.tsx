import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Animated, Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

export const FLOATING_TOP_BAR_HEIGHT = 56;
export const FLOATING_TOP_GAP = 0;
/** Negative lifts the chrome into the safe-area (closer to physical top edge). */
export const FLOATING_TOP_NUDGE = -8;
/** Thin outer stroke for the floating nav capsule (bold violet). */
const NAV_PURPLE_BORDER = "#7C3AED";

const STORE_ICON = require("../../assets/store.png");

/** Matches current tab ambient page colors in a richer, capsule-friendly gradient. */
export type NavPageGradient = { crest: string; deep: string };

type Props =
  | {
      variant?: "default";
      topInset: number;
      scrollY: Animated.Value;
      navGradient: NavPageGradient;
      leftLabel: string;
      leftSubLabel?: string;
      centerTitle: string;
      onLeftPress?: () => void;
      onSearch?: () => void;
      onExperienceSwitcher?: () => void;
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
      /** When `onSearchExpandSheet` is set, taps open the nav sheet until this is true (full detent). */
      searchSheetFullyExpanded?: boolean;
      /** First taps on the search field call this (no keyboard); typing works once the sheet is fully open. */
      onSearchExpandSheet?: () => void;
      onExperienceSwitcher?: () => void;
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

function StoreSwitcherButton({ onPress }: { onPress?: () => void }) {
  if (!onPress) return null;
  return (
    <Pressable
      onPress={onPress}
      style={styles.iconBtn}
      hitSlop={12}
      accessibilityLabel="Switch experience"
    >
      <Image source={STORE_ICON} style={styles.storeIcon} resizeMode="contain" />
    </Pressable>
  );
}

type CustomerChromeProps = Extract<Props, { variant: "customer" }> & { iconColor: string };

function CustomerTopBarChrome({
  iconColor,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onSearchSubmit,
  searchSheetFullyExpanded,
  onSearchExpandSheet,
  onExperienceSwitcher,
  onMenu
}: CustomerChromeProps) {
  const expandFirst = typeof onSearchExpandSheet === "function";
  const sheetReadyForTyping = !expandFirst || !!searchSheetFullyExpanded;

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
      <StoreSwitcherButton onPress={onExperienceSwitcher} />
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
  leftSubLabel,
  centerTitle,
  onLeftPress,
  onSearch,
  onExperienceSwitcher,
  onMenu
}: BusinessChromeProps) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onLeftPress} style={styles.left} hitSlop={10}>
        <View style={styles.leftTextCol}>
          <View style={styles.leftTitleRow}>
            <Text style={styles.leftText} numberOfLines={1}>
              {leftLabel}
            </Text>
            <Text style={styles.chev}>▼</Text>
          </View>
          {leftSubLabel ? (
            <Text style={styles.leftSubText} numberOfLines={1}>
              {leftSubLabel}
            </Text>
          ) : null}
        </View>
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

        <StoreSwitcherButton onPress={onExperienceSwitcher} />

        <Pressable onPress={onMenu} style={styles.iconBtn} hitSlop={10} accessibilityLabel="Menu">
          <IconMenu color={iconColor} />
        </Pressable>
      </View>
    </View>
  );
}

export function FloatingTopBar(props: Props) {
  const topInset = props.topInset;
  const hideY = 0;
  const hideOpacity = 1;
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
            <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.customerChromeDismissTap}>
              <CustomerTopBarChrome iconColor={iconColor} {...props} />
            </Pressable>
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
    top: FLOATING_TOP_NUDGE,
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
  customerChromeDismissTap: {
    alignSelf: "stretch",
    minHeight: FLOATING_TOP_BAR_HEIGHT
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
    alignItems: "center"
  },
  leftTextCol: { flex: 1, minWidth: 0 },
  leftTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  leftText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1
  },
  leftSubText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1
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
  storeIcon: {
    width: 22,
    height: 22,
    tintColor: "rgba(255,255,255,0.92)"
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
    backgroundColor: "rgba(255,255,255,0.42)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.55)",
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
    fontWeight: "700",
    color: "#0f172a"
  }
});
