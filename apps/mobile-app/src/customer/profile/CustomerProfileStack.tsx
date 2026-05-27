import * as Haptics from "expo-haptics";
import React from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { AuthUser } from "../../api";
import { useAppTheme } from "../../theme/AppThemeContext";
import { FrostedTopChrome } from "./profileScrollFrostedEdges";
import { AppControlCenterHome } from "./AppControlCenterHome";
import { ProfilePlaceholderScreen } from "./ProfilePlaceholderScreen";
import { SafetyScreen } from "./SafetyScreen";
import { SettingsDetailScreen, SettingsHomeScreen } from "./SettingsScreens";
import type { AppStackRoute } from "./profileHubRoutes";
import { ProfileNavHighlightProvider, useProfileNavHighlight } from "./profileNavHighlight";

type Props = {
  topInset: number;
  bottomInset: number;
  user: AuthUser | null;
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

function routeTitle(route: AppStackRoute): string | null {
  switch (route.name) {
    case "home":
      return null;
    case "settings":
      return "App settings";
    case "settings_detail": {
      const titles: Record<string, string> = {
        manage_account: "Manage account",
        privacy: "Privacy",
        address: "Delivery address",
        accessibility: "Accessibility",
        night_mode: "Night mode",
        shortcuts: "Shortcuts",
        communication: "Communication",
        navigation: "Navigation",
        sounds_voice: "Sounds & voice"
      };
      return titles[route.key] ?? "App settings";
    }
    case "help":
      return "Help";
    case "safety":
      return "Safety & privacy";
    case "section":
      return route.title;
    default:
      return null;
  }
}

function CustomerProfileStackInner(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const { navigate, onReturnedToAppHome, onReturnedToAppSettings } = useProfileNavHighlight();
  const [stack, setStack] = React.useState<AppStackRoute[]>([{ name: "home" }]);

  const route = stack[stack.length - 1]!;
  const atRoot = stack.length <= 1;
  const title = routeTitle(route);
  const [topChromeHeight, setTopChromeHeight] = React.useState(0);
  const [scrollAtTop, setScrollAtTop] = React.useState(true);
  const topGlassOpacity = React.useRef(new Animated.Value(0)).current;
  const isAppHome = route.name === "home";

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

  const handleTopBack = React.useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (atRoot) {
      props.onCloseMenu();
      return;
    }
    pop();
  }, [atRoot, pop, props]);

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

  const content = (() => {
    switch (route.name) {
      case "home":
        return (
          <AppControlCenterHome
            user={props.user}
            topInset={0}
            bottomInset={props.bottomInset}
            chromeTopBleed={topChromeHeight}
            onScrollEdges={({ atTop }) => setScrollAtTop(atTop)}
            onNavigateHelp={() => navigate("app:chip:help", () => push({ name: "help" }))}
            onNavigateSafety={() => navigate("app:chip:safety", () => push({ name: "safety" }))}
            onNavigateAppSettings={() => navigate("app:chip:settings", () => push({ name: "settings" }))}
            onNavigateSection={(sectionTitle, subtitle, key) =>
              navigate(key, () => push({ name: "section", title: sectionTitle, subtitle }))
            }
            onChooseVenue={props.onChooseVenue}
          />
        );
      case "settings":
        return (
          <SettingsHomeScreen
            bottomInset={props.bottomInset}
            onOpenDetail={(key) => navigate(`app:settings:${key}`, () => push({ name: "settings_detail", key }))}
          />
        );
      case "settings_detail":
        return <SettingsDetailScreen detailKey={route.key} user={props.user} bottomInset={props.bottomInset} />;
      case "help":
        return (
          <ProfilePlaceholderScreen title="Help" subtitle="FAQs and contact" topInset={0} bottomInset={props.bottomInset} />
        );
      case "safety":
        return <SafetyScreen bottomInset={props.bottomInset} />;
      case "section":
        return (
          <ProfilePlaceholderScreen
            title={route.title}
            subtitle={route.subtitle}
            topInset={0}
            bottomInset={props.bottomInset}
          />
        );
      default:
        return null;
    }
  })();

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
        content: { flex: 1, overflow: "visible" as const }
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
          accessibilityLabel={atRoot ? "Close menu" : "Back"}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <BackChevron color={t.accentBlue} />
          <Text style={styles.backLabel}>{atRoot ? "back" : "Back"}</Text>
        </Pressable>
        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>
      <View style={styles.content}>{content}</View>
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
