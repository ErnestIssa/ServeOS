import React from "react";
import { Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useAppTheme } from "../theme/AppThemeContext";
import { LiquidGlassChrome } from "./LiquidGlassChrome";
import { NAV_BOTTOM_DOCK_SHELL_BG, navDockGlassTokens } from "./navDockGlass";
import {
  FLOAT_MARGIN_SIDE,
  FLOAT_MARGIN_TOP,
  FLOAT_MARGIN_TOP_HOME,
  FLOATING_HOME_TOP_BAR_HEIGHT,
  FLOATING_HOME_VENUE_CHIP_SIZE,
  FLOATING_TOP_BAR_HEIGHT
} from "./navBottomMetrics";

export {
  FLOATING_TOP_BAR_HEIGHT,
  FLOAT_MARGIN_TOP,
  FLOATING_HOME_TOP_BAR_HEIGHT,
  FLOAT_MARGIN_TOP_HOME
} from "./navBottomMetrics";

/** @deprecated Use FLOAT_MARGIN_TOP — kept for legacy layout math. */
export const FLOATING_TOP_GAP = FLOAT_MARGIN_TOP;
/** @deprecated Top dock no longer uses negative nudge. */
export const FLOATING_TOP_NUDGE = 0;

const STORE_ICON = require("../../assets/store.png");
const DOCK_RADIUS = 999;
const SEARCH_CHIP_RADIUS = FLOATING_HOME_TOP_BAR_HEIGHT / 2;
const VENUE_CHIP_RADIUS = FLOATING_HOME_VENUE_CHIP_SIZE / 2;
const SEARCH_ICON_SIZE = 18;
const VENUE_ICON_SIZE = 18;

type Props =
  | {
      variant?: "default";
      topInset: number;
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
      searchOpenSV?: SharedValue<number>;
      searchPlaceholder?: string;
      searchValue: string;
      onSearchChange: (text: string) => void;
      onSearchSubmit?: () => void;
      /** Search sheet finished its open animation. */
      searchSheetReady?: boolean;
      /** User tapped the search field to start typing. */
      searchTypingActive?: boolean;
      searchModalOpen?: boolean;
      onSearchExpandSheet?: () => void;
      onSearchFocusRequest?: () => void;
      onSearchBlur?: () => void;
      onExperienceSwitcher?: () => void;
    };

function IconSearch({ color, size = SEARCH_ICON_SIZE }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M10 18a8 8 0 1 1 5.293-14.01A8 8 0 0 1 10 18Zm0-14a6 6 0 1 0 3.96 10.5A6 6 0 0 0 10 4Zm10.707 17.293-4.112-4.112a1 1 0 0 1 1.414-1.414l4.112 4.112a1 1 0 0 1-1.414 1.414Z"
      />
    </Svg>
  );
}

function StoreSwitcherButton({
  onPress,
  tintColor,
  size = FLOATING_HOME_VENUE_CHIP_SIZE
}: {
  onPress?: () => void;
  tintColor: string;
  size?: number;
}) {
  if (!onPress) return null;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.venuePressable, { width: size, height: size }]}
      hitSlop={8}
      accessibilityLabel="Switch experience"
    >
      <Image
        source={STORE_ICON}
        style={{ width: VENUE_ICON_SIZE, height: VENUE_ICON_SIZE, tintColor }}
        resizeMode="contain"
      />
    </Pressable>
  );
}

type CustomerChromeProps = Extract<Props, { variant: "customer" }> & {
  iconColor: string;
  searchTextColor: string;
  searchPlaceholderColor: string;
  searchOpenSV?: SharedValue<number>;
  glass: ReturnType<typeof navDockGlassTokens>;
};

const CUSTOMER_TOP_ROW_GAP = 8;

function CustomerHomeTopBar({
  iconColor,
  searchTextColor,
  searchPlaceholderColor,
  glass,
  searchOpenSV,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onSearchSubmit,
  searchSheetReady = false,
  searchTypingActive = false,
  searchModalOpen = false,
  onSearchExpandSheet,
  onSearchFocusRequest,
  onSearchBlur,
  onExperienceSwitcher
}: CustomerChromeProps) {
  const expandFirst = typeof onSearchExpandSheet === "function";
  const searchInputRef = React.useRef<TextInput>(null);
  const placeholder = searchPlaceholder ?? "Search";

  React.useEffect(() => {
    if (!searchTypingActive) {
      searchInputRef.current?.blur();
      Keyboard.dismiss();
      return;
    }
    const t = setTimeout(() => searchInputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [searchTypingActive]);

  const handleSearchTap = React.useCallback(() => {
    if (!searchModalOpen) {
      Keyboard.dismiss();
      onSearchExpandSheet?.();
      return;
    }
    if (searchSheetReady && !searchTypingActive) {
      onSearchFocusRequest?.();
    }
  }, [
    searchModalOpen,
    searchSheetReady,
    searchTypingActive,
    onSearchExpandSheet,
    onSearchFocusRequest
  ]);

  /** Top chrome stays static — identity transform (no scroll reaction). */
  const chipMotionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 }],
    opacity: 1
  }));

  const searchExpandStyle = useAnimatedStyle(() => {
    const open = searchOpenSV?.value ?? 0;
    const shadowOpacity = interpolate(open, [0, 1], [0.28, 0.14], Extrapolation.CLAMP);
    const elevation = interpolate(open, [0, 1], [10, 6], Extrapolation.CLAMP);
    return {
      shadowOpacity,
      elevation
    };
  });

  const venueChipHideStyle = useAnimatedStyle(() => {
    const open = searchOpenSV?.value ?? 0;
    return {
      width: interpolate(open, [0, 1], [FLOATING_HOME_VENUE_CHIP_SIZE, 0], Extrapolation.CLAMP),
      marginLeft: interpolate(open, [0, 1], [CUSTOMER_TOP_ROW_GAP, 0], Extrapolation.CLAMP),
      opacity: interpolate(open, [0, 0.55], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(open, [0, 1], [1, 0.82], Extrapolation.CLAMP) }]
    };
  });

  const venueChipStyle = useAnimatedStyle(() => ({
    zIndex: 6,
    overflow: "hidden" as const
  }));

  return (
    <View style={styles.customerTopHost}>
      <Animated.View style={[styles.searchChipShell, chipMotionStyle, searchExpandStyle]}>
        <LiquidGlassChrome
          tokens={glass}
          variant="shell"
          borderRadius={SEARCH_CHIP_RADIUS}
        />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.chipSolidFill, { borderRadius: SEARCH_CHIP_RADIUS }]}
        />
        <View style={styles.searchFieldBody} pointerEvents={searchTypingActive || !expandFirst ? "auto" : "none"}>
          <IconSearch color={iconColor} />
          {searchTypingActive || !expandFirst ? (
            <TextInput
              ref={searchInputRef}
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={placeholder}
              placeholderTextColor={searchPlaceholderColor}
              style={[styles.searchInputCustomer, { color: searchTextColor }]}
              returnKeyType="search"
              onSubmitEditing={onSearchSubmit}
              onBlur={onSearchBlur}
              accessibilityLabel="Search"
              showSoftInputOnFocus
              {...(Platform.OS === "ios" ? ({ clearButtonMode: "while-editing" as const } as const) : {})}
            />
          ) : (
            <Text
              style={[
                styles.searchInputCustomer,
                searchValue.trim() ? { color: searchTextColor } : { color: searchPlaceholderColor }
              ]}
              numberOfLines={1}
            >
              {searchValue.trim() || placeholder}
            </Text>
          )}
        </View>
        {expandFirst && !searchTypingActive ? (
          <Pressable
            style={styles.searchChipTapOverlay}
            accessibilityRole="button"
            accessibilityLabel={searchModalOpen && searchSheetReady ? "Start typing search" : "Open search"}
            onPress={handleSearchTap}
          />
        ) : null}
      </Animated.View>

      <Animated.View
        style={[styles.venueChipShell, chipMotionStyle, venueChipStyle, venueChipHideStyle]}
        pointerEvents={searchModalOpen ? "none" : "auto"}
      >
        <LiquidGlassChrome
          tokens={glass}
          variant="control"
          borderRadius={VENUE_CHIP_RADIUS}
        />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.chipSolidFill, { borderRadius: VENUE_CHIP_RADIUS }]}
        />
        <StoreSwitcherButton onPress={onExperienceSwitcher} tintColor="#FFFFFF" />
      </Animated.View>
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
          <IconSearch color={iconColor} size={22} />
        </Pressable>
        <Pressable
          onPress={onExperienceSwitcher}
          style={styles.iconBtn}
          hitSlop={10}
          accessibilityLabel="Switch experience"
        >
          <Image
            source={STORE_ICON}
            style={[styles.storeIconBusiness, { tintColor: iconColor }]}
            resizeMode="contain"
          />
        </Pressable>
      </View>
    </View>
  );
}

export function FloatingTopBar(props: Props) {
  const { isDark, colors: theme } = useAppTheme();
  const glass = React.useMemo(() => navDockGlassTokens(isDark), [isDark]);
  const isCustomer = props.variant === "customer";
  const dockTop = props.topInset + (isCustomer ? FLOAT_MARGIN_TOP_HOME : FLOAT_MARGIN_TOP);
  const staffBarHeight = isCustomer ? FLOATING_HOME_TOP_BAR_HEIGHT : FLOATING_TOP_BAR_HEIGHT;

  const iconColor = theme.navIconIdle;
  const titleColor = theme.text;
  const subColor = theme.textMuted;
  const searchTextColor = "#FFFFFF";
  const searchPlaceholderColor = "rgba(255, 255, 255, 0.52)";

  if (isCustomer) {
    const {
      searchOpenSV,
      searchValue,
      onSearchChange,
      searchPlaceholder,
      onSearchSubmit,
      searchSheetReady,
      searchTypingActive,
      searchModalOpen,
      onSearchExpandSheet,
      onSearchFocusRequest,
      onSearchBlur,
      onExperienceSwitcher
    } = props;

    return (
      <View pointerEvents="box-none" style={styles.screenAnchor}>
        <View
          style={[
            styles.customerTopAnchor,
            {
              top: dockTop,
              left: FLOAT_MARGIN_SIDE,
              right: FLOAT_MARGIN_SIDE
            }
          ]}
        >
          <View style={styles.customerDismissTap}>
            <CustomerHomeTopBar
              iconColor={iconColor}
              searchTextColor={searchTextColor}
              searchPlaceholderColor={searchPlaceholderColor}
              glass={glass}
              variant="customer"
              topInset={props.topInset}
              searchOpenSV={searchOpenSV}
              searchValue={searchValue}
              onSearchChange={onSearchChange}
              searchPlaceholder={searchPlaceholder}
              onSearchSubmit={onSearchSubmit}
              searchSheetReady={searchSheetReady}
              searchTypingActive={searchTypingActive}
              searchModalOpen={searchModalOpen}
              onSearchExpandSheet={onSearchExpandSheet}
              onSearchFocusRequest={onSearchFocusRequest}
              onSearchBlur={onSearchBlur}
              onExperienceSwitcher={onExperienceSwitcher}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.screenAnchor}>
      <View
        style={[
          styles.chromeShell,
          {
            top: dockTop,
            left: FLOAT_MARGIN_SIDE,
            right: FLOAT_MARGIN_SIDE,
            height: staffBarHeight,
            shadowColor: glass.shadowColor,
            shadowOpacity: glass.shadowOpacity
          }
        ]}
      >
        <LiquidGlassChrome
          tokens={glass}
          variant="shell"
          borderRadius={DOCK_RADIUS}
        />

        <View style={styles.chromeBody}>
          <BusinessTopBarChrome
            iconColor={iconColor}
            titleColor={titleColor}
            subColor={subColor}
            {...props}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenAnchor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    pointerEvents: "box-none"
  },
  customerTopAnchor: {
    position: "absolute",
    zIndex: 30,
    pointerEvents: "box-none"
  },
  customerDismissTap: {
    width: "100%"
  },
  customerTopHost: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: FLOATING_HOME_TOP_BAR_HEIGHT
  },
  searchChipShell: {
    flex: 1,
    minWidth: 0,
    height: FLOATING_HOME_TOP_BAR_HEIGHT,
    borderRadius: SEARCH_CHIP_RADIUS,
    overflow: "hidden",
    zIndex: 3,
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16
      },
      android: { elevation: 10 },
      default: {}
    })
  },
  venueChipShell: {
    height: FLOATING_HOME_VENUE_CHIP_SIZE,
    borderRadius: VENUE_CHIP_RADIUS,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16
      },
      android: { elevation: 10 },
      default: {}
    })
  },
  chipSolidFill: {
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG
  },
  searchFieldBody: {
    flex: 1,
    minHeight: FLOATING_HOME_TOP_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG,
    position: "relative"
  },
  searchInputCustomer: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Platform.OS === "ios" ? 0 : 0,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    includeFontPadding: false
  },
  searchChipTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8
  },
  venuePressable: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NAV_BOTTOM_DOCK_SHELL_BG
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
  storeIconBusiness: {
    width: 22,
    height: 22
  }
});
