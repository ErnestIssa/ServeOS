import * as Haptics from "expo-haptics";
import React from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useAppTheme } from "../../theme/AppThemeContext";

type Props = {
  visible: boolean;
  presentation?: "inline" | "modal";
  title?: string | null;
  topInset: number;
  motionStyle: StyleProp<ViewStyle>;
  scrimStyle: StyleProp<ViewStyle>;
  onBack: () => void;
  chromeless?: boolean;
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
  if (!props.visible) return null;

  const showChrome = !props.chromeless;

  return (
    <View
      style={props.presentation === "modal" ? styles.hostModal : styles.host}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[styles.scrim, props.scrimStyle]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.panel,
          { backgroundColor: isDark ? t.bg : t.menuGradient[0] },
          props.motionStyle
        ]}
      >
        {showChrome ? (
          <View style={[styles.topBar, { paddingTop: props.topInset + 6 }]}>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                props.onBack();
              }}
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
    </View>
  );
}

const SUBPAGE_OPEN_MS = 320;
const SUBPAGE_CLOSE_MS = 300;

export function useProfileSubpageMotion(active: boolean) {
  const screenW = Dimensions.get("window").width;
  const slideX = React.useRef(new Animated.Value(screenW)).current;
  const scrim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!active) {
      slideX.setValue(screenW);
      scrim.setValue(0);
      return;
    }
    slideX.setValue(screenW);
    scrim.setValue(0);
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: 0,
        duration: SUBPAGE_OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(scrim, {
        toValue: 1,
        duration: SUBPAGE_OPEN_MS - 40,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }, [active, screenW, scrim, slideX]);

  const runClose = React.useCallback(
    (onDone: () => void) => {
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: screenW,
          duration: SUBPAGE_CLOSE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(scrim, {
          toValue: 0,
          duration: SUBPAGE_CLOSE_MS - 40,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        if (!finished) return;
        onDone();
      });
    },
    [screenW, scrim, slideX]
  );

  const motionStyle = React.useMemo(
    () => ({
      flex: 1,
      transform: [{ translateX: slideX }]
    }),
    [slideX]
  );

  const scrimStyle = React.useMemo(
    () => ({
      opacity: scrim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.22]
      })
    }),
    [scrim]
  );

  return { motionStyle, scrimStyle, runClose };
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
    ...Platform.select({
      android: { elevation: 12 }
    })
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
