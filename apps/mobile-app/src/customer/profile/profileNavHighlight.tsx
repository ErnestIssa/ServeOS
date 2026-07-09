import React from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
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
  | "me:security"
  | "me:support"
  | `me:${string}`;

export type AppNavHighlightKey =
  | "app:chip:help"
  | "app:chip:safety"
  | "app:chip:settings"
  | `app:settings:${string}`
  | `app:${string}`;

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

const HIGHLIGHT_DELAY_MS = 120;

export function ProfileNavHighlightProvider(props: { children: React.ReactNode }) {
  const [highlightKey, setHighlightKey] = React.useState<ProfileNavHighlightKey | null>(null);
  const pendingRef = React.useRef<ProfileNavHighlightKey | null>(null);
  const clearTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const armHighlight = React.useCallback((key: ProfileNavHighlightKey) => {
    pendingRef.current = key;
  }, []);

  const flash = React.useCallback((key: ProfileNavHighlightKey) => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      setHighlightKey(key);
      clearTimer.current = setTimeout(() => setHighlightKey(null), 2200);
    }, HIGHLIGHT_DELAY_MS);
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
      if (flashTimer.current) clearTimeout(flashTimer.current);
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
  const { colors: t } = useAppTheme();
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!props.active) {
      pulse.setValue(0);
      return;
    }
    const anim = Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 680, useNativeDriver: true })
    ]);
    anim.start();
    return () => {
      pulse.stopAnimation();
      pulse.setValue(0);
    };
  }, [props.active, pulse]);

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  const fillOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.2]
  });

  return (
    <View style={[styles.wrap, props.style]}>
      {props.children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.highlightFill,
          { backgroundColor: t.accentPurple, opacity: fillOpacity }
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.highlightRing, { borderColor: t.accentPurple, opacity: ringOpacity }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "hidden"
  },
  highlightFill: {
    ...StyleSheet.absoluteFillObject
  },
  highlightRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2
  }
});
