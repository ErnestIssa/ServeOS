import React from "react";
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";

export type MeNavHighlightKey =
  | "me:reservations"
  | "me:active_orders"
  | "me:order_history"
  | "me:review"
  | "me:favorites"
  | "me:payments"
  | "me:addresses"
  | "me:rewards"
  | "me:preferences"
  | "me:notifications"
  | "me:support";

export type AppNavHighlightKey =
  | "app:chip:help"
  | "app:chip:safety"
  | "app:chip:settings"
  | "app:role"
  | "app:venues"
  | "app:dashboard"
  | "app:staff_tools"
  | "app:resources"
  | "app:safety_privacy"
  | "app:connected"
  | "app:integrations"
  | "app:sessions"
  | "app:developer"
  | "app:about"
  | `app:settings:${string}`;

export type ProfileNavHighlightKey = MeNavHighlightKey | AppNavHighlightKey;

type Ctx = {
  highlightKey: ProfileNavHighlightKey | null;
  armHighlight: (key: ProfileNavHighlightKey) => void;
  navigate: (key: ProfileNavHighlightKey, go: () => void) => void;
  /** Drop armed highlight without flashing (e.g. Review overlay closed). */
  clearPendingHighlight: () => void;
  onReturnedToMeHome: () => void;
  onReturnedToAppHome: () => void;
  onReturnedToAppSettings: () => void;
};

const ProfileNavHighlightContext = React.createContext<Ctx | null>(null);

export function ProfileNavHighlightProvider(props: { children: React.ReactNode }) {
  const [highlightKey, setHighlightKey] = React.useState<ProfileNavHighlightKey | null>(null);
  const pendingRef = React.useRef<ProfileNavHighlightKey | null>(null);
  const clearTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const armHighlight = React.useCallback((key: ProfileNavHighlightKey) => {
    pendingRef.current = key;
  }, []);

  const flash = React.useCallback((key: ProfileNavHighlightKey) => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setHighlightKey(key);
    clearTimer.current = setTimeout(() => setHighlightKey(null), 2200);
  }, []);

  const navigate = React.useCallback(
    (key: ProfileNavHighlightKey, go: () => void) => {
      armHighlight(key);
      go();
    },
    [armHighlight]
  );

  const clearPendingHighlight = React.useCallback(() => {
    pendingRef.current = null;
  }, []);

  const onReturnedToMeHome = React.useCallback(() => {
    const key = pendingRef.current;
    if (!key || !key.startsWith("me:")) return;
    pendingRef.current = null;
    flash(key);
  }, [flash]);

  const onReturnedToAppHome = React.useCallback(() => {
    const key = pendingRef.current;
    if (!key || !key.startsWith("app:") || key.startsWith("app:settings:")) return;
    pendingRef.current = null;
    flash(key);
  }, [flash]);

  const onReturnedToAppSettings = React.useCallback(() => {
    const key = pendingRef.current;
    if (!key?.startsWith("app:settings:")) return;
    pendingRef.current = null;
    flash(key);
  }, [flash]);

  React.useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    []
  );

  const value = React.useMemo(
    () => ({
      highlightKey,
      armHighlight,
      navigate,
      clearPendingHighlight,
      onReturnedToMeHome,
      onReturnedToAppHome,
      onReturnedToAppSettings
    }),
    [
      highlightKey,
      armHighlight,
      navigate,
      clearPendingHighlight,
      onReturnedToMeHome,
      onReturnedToAppHome,
      onReturnedToAppSettings
    ]
  );

  return <ProfileNavHighlightContext.Provider value={value}>{props.children}</ProfileNavHighlightContext.Provider>;
}

export function useProfileNavHighlight(): Ctx {
  const ctx = React.useContext(ProfileNavHighlightContext);
  if (!ctx) throw new Error("useProfileNavHighlight requires ProfileNavHighlightProvider");
  return ctx;
}

export function NavHighlightWrap(props: {
  active: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: t, isDark } = useAppTheme();
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!props.active) {
      pulse.setValue(0);
      return;
    }
    const anim = Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 680, useNativeDriver: false })
    ]);
    anim.start();
    return () => {
      pulse.stopAnimation();
      pulse.setValue(0);
    };
  }, [props.active, pulse]);

  const bg = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", isDark ? "rgba(167, 139, 250, 0.28)" : "rgba(139, 92, 246, 0.2)"]
  });

  const border = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", t.accentPurple]
  });

  return (
    <Animated.View
      style={[
        styles.wrap,
        props.style,
        props.active && { backgroundColor: bg, borderColor: border, borderWidth: 2 }
      ]}
    >
      {props.children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, borderWidth: 0, borderColor: "transparent" }
});
