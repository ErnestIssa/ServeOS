import { BlurView } from "expo-blur";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useAppTheme } from "../theme/AppThemeContext";
import { R } from "../theme";

export type AppErrorPresentation = {
  title?: string;
  message: string;
  detail?: string;
  retryLabel?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
};

function ErrorIcon({ size = 40 }: { size?: number }) {
  const { colors: t } = useAppTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(220,38,38,0.12)",
        borderWidth: 2,
        borderColor: "rgba(220,38,38,0.35)",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: "900", color: t.danger, marginTop: -1 }}>!</Text>
    </View>
  );
}

function useErrorCardStyles() {
  const { colors: t, isDark } = useAppTheme();
  return React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          maxWidth: 400,
          width: "100%",
          borderRadius: 22,
          borderWidth: 2,
          borderColor: isDark ? "rgba(248,113,113,0.45)" : "rgba(220,38,38,0.28)",
          backgroundColor: isDark ? "rgba(30,20,35,0.94)" : "rgba(255,255,255,0.96)",
          paddingHorizontal: 22,
          paddingVertical: 22,
          alignItems: "center",
          ...Platform.select({
            ios: {
              shadowColor: isDark ? "#000" : "#7F1D1D",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: isDark ? 0.35 : 0.12,
              shadowRadius: 24
            },
            android: { elevation: 8 },
            default: {}
          })
        },
        title: {
          marginTop: 14,
          fontSize: 18,
          fontWeight: "900",
          color: t.text,
          letterSpacing: -0.3,
          textAlign: "center"
        },
        message: {
          marginTop: 8,
          fontSize: 15,
          lineHeight: 22,
          fontWeight: "600",
          color: t.textSecondary,
          textAlign: "center"
        },
        detail: {
          marginTop: 10,
          fontSize: 12,
          lineHeight: 17,
          fontWeight: "600",
          color: t.textMuted,
          textAlign: "center",
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
        },
        actions: {
          marginTop: 18,
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 10,
          alignSelf: "stretch"
        },
        btnPrimary: {
          flexGrow: 1,
          minWidth: 120,
          borderRadius: R.radius.pill,
          backgroundColor: t.accentPurple,
          paddingVertical: 13,
          paddingHorizontal: 18,
          alignItems: "center"
        },
        btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
        btnGhost: {
          flexGrow: 1,
          minWidth: 100,
          borderRadius: R.radius.pill,
          paddingVertical: 13,
          paddingHorizontal: 18,
          borderWidth: 1.5,
          borderColor: t.border,
          alignItems: "center"
        },
        btnGhostText: { color: t.textSecondary, fontSize: 14, fontWeight: "800" },
        pressed: { opacity: 0.88 }
      }),
    [t, isDark]
  );
}

function ErrorCardBody({
  title = "Something went wrong",
  message,
  detail,
  retryLabel = "Try again",
  onRetry,
  onDismiss,
  dismissLabel = "Dismiss"
}: AppErrorPresentation) {
  const styles = useErrorCardStyles();
  return (
    <>
      <ErrorIcon />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {detail?.trim() ? <Text style={styles.detail}>{detail.trim()}</Text> : null}
      <View style={styles.actions}>
        {onRetry ? (
          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
            onPress={onRetry}
            accessibilityRole="button"
          >
            <Text style={styles.btnPrimaryText}>{retryLabel}</Text>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable
            style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
            onPress={onDismiss}
            accessibilityRole="button"
          >
            <Text style={styles.btnGhostText}>{dismissLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

/** Inline / screen-region error — centred in the parent content area. */
export function ScreenErrorState({
  title,
  message,
  detail,
  onRetry,
  retryLabel,
  onDismiss,
  dismissLabel,
  style
}: AppErrorPresentation & { style?: StyleProp<ViewStyle> }) {
  const styles = useErrorCardStyles();
  return (
    <View style={[screenStyles.wrap, style]} accessibilityRole="alert">
      <View style={styles.card}>
        <ErrorCardBody
          title={title}
          message={message}
          detail={detail}
          onRetry={onRetry}
          retryLabel={retryLabel}
          onDismiss={onDismiss}
          dismissLabel={dismissLabel}
        />
      </View>
    </View>
  );
}

/** Full-app fatal error page. */
export function AppErrorFullScreen({
  title = "ServeOS hit a problem",
  message,
  detail,
  onRetry,
  retryLabel,
  onDismiss,
  dismissLabel
}: AppErrorPresentation) {
  const { colors: t } = useAppTheme();
  const styles = useErrorCardStyles();
  return (
    <View style={fullStyles.root} accessibilityRole="alert">
      <View style={[fullStyles.badge, { borderColor: t.danger }]}>
        <Text style={[fullStyles.badgeText, { color: t.danger }]}>Error</Text>
      </View>
      <View style={[styles.card, fullStyles.card]}>
        <ErrorCardBody
          title={title}
          message={message}
          detail={detail}
          onRetry={onRetry}
          retryLabel={retryLabel}
          onDismiss={onDismiss}
          dismissLabel={dismissLabel}
        />
      </View>
    </View>
  );
}

type ModalProps = AppErrorPresentation & {
  visible: boolean;
};

/** Blurred modal for non-fatal errors on the current screen. */
export function AppErrorModal({
  visible,
  title,
  message,
  detail,
  onRetry,
  retryLabel,
  onDismiss,
  dismissLabel = "Close"
}: ModalProps) {
  const { isDark } = useAppTheme();
  const styles = useErrorCardStyles();
  const p = useSharedValue(0);

  React.useEffect(() => {
    p.value = withTiming(visible ? 1 : 0, { duration: visible ? 260 : 180, easing: Easing.out(Easing.cubic) });
  }, [visible, p]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 14 }, { scale: 0.96 + p.value * 0.04 }]
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[modalStyles.backdrop, backdropStyle]}>
        <BlurView intensity={isDark ? 48 : 56} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
        />
      </Animated.View>
      <View style={modalStyles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, modalStyles.card, cardStyle]} accessibilityRole="alert">
          <ErrorCardBody
            title={title ?? "Something went wrong"}
            message={message}
            detail={detail}
            onRetry={onRetry}
            retryLabel={retryLabel}
            onDismiss={onDismiss}
            dismissLabel={dismissLabel}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const screenStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: R.space.md,
    paddingVertical: R.space.lg,
    minHeight: 200
  }
});

const fullStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: R.space.md,
    paddingVertical: R.space.lg
  },
  badge: {
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: R.radius.pill,
    borderWidth: 1.5
  },
  badgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  card: { maxWidth: 420 }
});

const modalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.25)"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  card: { maxWidth: 400 }
});
