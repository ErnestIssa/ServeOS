import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useAppTheme } from "../../theme/AppThemeContext";
import { useProfileSubpageSwipeMotion } from "./profileSubpageSwipeMotion";

type Props = {
  visible: boolean;
  /** Active top layer with swipe chrome, or frozen layer kept mounted under the stack. */
  layerMode?: "active" | "frozen";
  zIndex?: number;
  presentation?: "inline" | "modal";
  title?: string | null;
  topInset: number;
  chromeless?: boolean;
  canSwipeBack?: boolean;
  canSwipeForward?: boolean;
  /** When false, back pops nested stack without dismissing the whole panel. */
  dismissOnBack?: boolean;
  onBackComplete: () => void;
  onNestedBack?: () => void;
  onSwipeForward?: () => void;
  children: React.ReactNode;
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

export function ProfileHubSubpageOverlay(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const layerMode = props.layerMode ?? "active";
  const isFrozen = layerMode === "frozen";
  const dismissOnBack = props.dismissOnBack !== false;
  const onNestedBack = props.onNestedBack ?? props.onBackComplete;

  const { pan, panelStyle, scrimStyle, requestBack } = useProfileSubpageSwipeMotion({
    active: props.visible && !isFrozen,
    canGoBack: props.canSwipeBack ?? true,
    canGoForward: props.canSwipeForward ?? false,
    dismissOnBack,
    onBackComplete: props.onBackComplete,
    onNestedBack,
    onForward: props.onSwipeForward ?? (() => {})
  });

  if (!props.visible) return null;

  if (isFrozen) {
    return (
      <View
        style={[
          props.presentation === "modal" ? styles.hostModal : styles.hostFrozen,
          props.zIndex != null ? { zIndex: props.zIndex } : null
        ]}
        pointerEvents="none"
      >
        <View style={[styles.frozenPanel, { backgroundColor: isDark ? t.bg : t.menuGradient[0] }]}>
          {!props.chromeless ? (
            <View style={[styles.topBar, { paddingTop: props.topInset + 6 }]} pointerEvents="none">
              <View style={styles.backBtnGhost}>
                <BackChevron color={t.accentBlue} />
                <Text style={[styles.backLabel, { color: t.accentBlue }]}>Back</Text>
              </View>
              {props.title ? (
                <Text style={[styles.title, { color: t.text }]}>{props.title}</Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.body}>{props.children}</View>
        </View>
      </View>
    );
  }

  const showChrome = !props.chromeless;

  return (
    <View
      style={[
        props.presentation === "modal" ? styles.hostModal : styles.host,
        props.zIndex != null ? { zIndex: props.zIndex } : null
      ]}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.scrim, scrimStyle]} pointerEvents="none" />

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.panel,
            { backgroundColor: isDark ? t.bg : t.menuGradient[0] },
            panelStyle
          ]}
        >
          {showChrome ? (
            <View style={[styles.topBar, { paddingTop: props.topInset + 6 }]}>
              <Pressable
                onPress={requestBack}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={12}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              >
                <BackChevron color={t.accentBlue} />
                <Text style={[styles.backLabel, { color: t.accentBlue }]}>Back</Text>
              </Pressable>
              {props.title ? (
                <Text style={[styles.title, { color: t.text }]}>{props.title}</Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.body}>{props.children}</View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
    ...Platform.select({
      android: { elevation: 12 }
    })
  },
  hostFrozen: {
    ...StyleSheet.absoluteFillObject
  },
  hostModal: {
    flex: 1,
    zIndex: 12
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0f172a"
  },
  panel: {
    flex: 1,
    width: "100%",
    height: "100%",
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 16
      },
      android: { elevation: 8 }
    })
  },
  frozenPanel: {
    flex: 1,
    width: "100%",
    height: "100%"
  },
  topBar: {
    paddingHorizontal: 12,
    zIndex: 2,
    minHeight: 36
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingRight: 10,
    gap: 2
  },
  backBtnGhost: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingRight: 10,
    gap: 2,
    opacity: 0
  },
  pressed: { opacity: 0.85 },
  backLabel: { fontSize: 15, fontWeight: "600" },
  title: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
    marginBottom: 4
  },
  body: { flex: 1 }
});
