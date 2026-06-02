import * as Haptics from "expo-haptics";
import React from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { AuthUser } from "../../api";
import { useAppTheme } from "../../theme/AppThemeContext";
import { FrostedTopChrome } from "./profileScrollFrostedEdges";
import { AppControlCenterHome } from "./AppControlCenterHome";
import { ProfileHubSubpageOverlay } from "./ProfileHubSubpageOverlay";
import { ProfilePlaceholderScreen } from "./ProfilePlaceholderScreen";
import { SafetyScreen } from "./SafetyScreen";
import { SettingsDetailScreen, SettingsHomeScreen } from "./SettingsScreens";
import type { AppStackRoute } from "./profileHubRoutes";
import { appStackOverlayTitle, splitHubStack } from "./profileHubStackHelpers";
import { ProfileNavHighlightProvider, useProfileNavHighlight } from "./profileNavHighlight";
import { useProfileSubpageMotion } from "./useProfileSubpageMotion";

type Props = {
  topInset: number;
  bottomInset: number;
  user: AuthUser | null;
  authToken?: string | null;
  onCloseMenu: () => void;
  onChooseVenue: () => void;
};

function BackChevron({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M14.707 17.293a1 1 0 0 1-1.414 1.414l-6-6a1 1 0 0 1 0-1.414l6-6a1 1 0 0 1 1.414 1.414L9.414 12l5.293 5.293Z"
      />
    </Svg>
  );
}

type RenderCtx = {
  user: AuthUser | null;
  authToken?: string | null;
  bottomInset: number;
  topChromeHeight: number;
  onScrollAtTop: (atTop: boolean) => void;
  navigate: ReturnType<typeof useProfileNavHighlight>["navigate"];
  push: (next: AppStackRoute) => void;
  onChooseVenue: () => void;
};

function renderAppRoute(route: AppStackRoute, ctx: RenderCtx): React.ReactNode {
  switch (route.name) {
    case "home":
      return (
        <AppControlCenterHome
          user={ctx.user}
          authToken={ctx.authToken}
          topInset={0}
          bottomInset={ctx.bottomInset}
          chromeTopBleed={ctx.topChromeHeight}
          onScrollEdges={({ atTop }) => ctx.onScrollAtTop(atTop)}
          onNavigateHelp={() => ctx.navigate("app:chip:help", () => ctx.push({ name: "help" }))}
          onNavigateSafety={() => ctx.navigate("app:chip:safety", () => ctx.push({ name: "safety" }))}
          onNavigateAppSettings={() => ctx.navigate("app:chip:settings", () => ctx.push({ name: "settings" }))}
          onNavigateSection={(sectionTitle, subtitle, key) =>
            ctx.navigate(key, () => ctx.push({ name: "section", title: sectionTitle, subtitle }))
          }
          onChooseVenue={ctx.onChooseVenue}
        />
      );
    case "settings":
      return (
        <SettingsHomeScreen
          bottomInset={ctx.bottomInset}
          onOpenDetail={(key) => ctx.navigate(`app:settings:${key}`, () => ctx.push({ name: "settings_detail", key }))}
        />
      );
    case "settings_detail":
      return (
        <SettingsDetailScreen
          detailKey={route.key}
          user={ctx.user}
          authToken={ctx.authToken}
          bottomInset={ctx.bottomInset}
        />
      );
    case "help":
      return (
        <ProfilePlaceholderScreen title="Help" subtitle="FAQs and contact" topInset={0} bottomInset={ctx.bottomInset} />
      );
    case "safety":
      return <SafetyScreen authToken={ctx.authToken} bottomInset={ctx.bottomInset} />;
    case "section":
      return (
        <ProfilePlaceholderScreen
          title={route.title}
          subtitle={route.subtitle}
          topInset={0}
          bottomInset={ctx.bottomInset}
        />
      );
    default:
      return null;
  }
}

function CustomerProfileStackInner(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const { navigate, onReturnedToAppHome, onReturnedToAppSettings } = useProfileNavHighlight();
  const [stack, setStack] = React.useState<AppStackRoute[]>([{ name: "home" }]);

  const { base: baseRoute, overlay: overlayRoute } = splitHubStack(stack);
  const atRoot = stack.length <= 1;
  const overlayActive = overlayRoute != null;
  const title = overlayRoute ? appStackOverlayTitle(overlayRoute) : atRoot ? null : appStackOverlayTitle(baseRoute);
  const [topChromeHeight, setTopChromeHeight] = React.useState(0);
  const [scrollAtTop, setScrollAtTop] = React.useState(true);
  const topGlassOpacity = React.useRef(new Animated.Value(0)).current;
  const isAppHome = baseRoute.name === "home" && !overlayActive;
  const overlayExitInFlightRef = React.useRef(false);
  const { motionStyle, scrimStyle, runClose } = useProfileSubpageMotion(overlayActive);

  const push = React.useCallback((next: AppStackRoute) => {
    setStack((s) => [...s, next]);
  }, []);

  const pop = React.useCallback(() => {
    setStack((s) => {
      if (s.length <= 1) return s;
      const next = s.slice(0, -1);
      const top = next[next.length - 1];
      if (top?.name === "home") onReturnedToAppHome();
      else if (top?.name === "settings") onReturnedToAppSettings();
      return next;
    });
  }, [onReturnedToAppHome, onReturnedToAppSettings]);

  const closeOverlay = React.useCallback(() => {
    if (overlayExitInFlightRef.current || !overlayRoute) return;
    overlayExitInFlightRef.current = true;
    runClose(() => {
      overlayExitInFlightRef.current = false;
      pop();
    });
  }, [overlayRoute, pop, runClose]);

  const handleTopBack = React.useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (overlayActive) {
      closeOverlay();
      return;
    }
    if (atRoot) {
      props.onCloseMenu();
      return;
    }
    pop();
  }, [atRoot, closeOverlay, overlayActive, pop, props]);

  React.useEffect(() => {
    if (!props.user) setStack([{ name: "home" }]);
  }, [props.user?.id]);

  React.useEffect(() => {
    if (!isAppHome) {
      topGlassOpacity.setValue(0);
      return;
    }
    Animated.timing(topGlassOpacity, {
      toValue: scrollAtTop ? 0 : 1,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [scrollAtTop, isAppHome, topGlassOpacity]);

  const renderCtx = React.useMemo<RenderCtx>(
    () => ({
      user: props.user,
      authToken: props.authToken,
      bottomInset: props.bottomInset,
      topChromeHeight,
      onScrollAtTop: setScrollAtTop,
      navigate,
      push,
      onChooseVenue: props.onChooseVenue
    }),
    [navigate, props.authToken, props.bottomInset, props.onChooseVenue, props.user, push, topChromeHeight]
  );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        fill: { flex: 1, overflow: "visible" as const },
        topBar: { paddingHorizontal: t.space.sm, zIndex: 6, backgroundColor: "transparent" },
        topGlassHost: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 4,
          overflow: "hidden"
        },
        backBtn: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          paddingVertical: 6,
          paddingRight: 10,
          gap: 2
        },
        pressed: { opacity: 0.85 },
        backLabel: { fontSize: 15, fontWeight: "600", color: t.accentBlue },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: t.text,
          textAlign: "center",
          marginTop: 2,
          marginBottom: 4
        },
        content: { flex: 1, overflow: "hidden" as const }
      }),
    [t]
  );

  return (
    <View style={styles.fill}>
      {isAppHome && topChromeHeight > 0 ? (
        <View style={[styles.topGlassHost, { height: topChromeHeight }]} pointerEvents="none">
          <FrostedTopChrome
            anchor="stack"
            opacity={topGlassOpacity}
            baseHex={t.menuGradient[0]}
            isDark={isDark}
            topChromeHeight={topChromeHeight}
          />
        </View>
      ) : null}
      <View
        style={[styles.topBar, { paddingTop: props.topInset + 6 }]}
        onLayout={(e) => setTopChromeHeight(Math.ceil(e.nativeEvent.layout.height))}
      >
        <Pressable
          onPress={handleTopBack}
          accessibilityRole="button"
          accessibilityLabel={atRoot && !overlayActive ? "Close menu" : "Back"}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <BackChevron color={t.accentBlue} />
          <Text style={styles.backLabel}>{atRoot && !overlayActive ? "back" : "Back"}</Text>
        </Pressable>
        {title && (overlayActive || !atRoot) ? <Text style={styles.title}>{title}</Text> : null}
      </View>
      <View style={styles.content} pointerEvents={overlayActive ? "box-none" : "auto"}>
        {renderAppRoute(baseRoute, renderCtx)}
        {overlayRoute ? (
          <ProfileHubSubpageOverlay
            visible
            presentation="inline"
            title={null}
            topInset={0}
            motionStyle={motionStyle}
            scrimStyle={scrimStyle}
            onBack={closeOverlay}
            chromeless
          >
            {renderAppRoute(overlayRoute, renderCtx)}
          </ProfileHubSubpageOverlay>
        ) : null}
      </View>
    </View>
  );
}

export function CustomerProfileStack(props: Props) {
  return (
    <ProfileNavHighlightProvider>
      <CustomerProfileStackInner {...props} />
    </ProfileNavHighlightProvider>
  );
}
