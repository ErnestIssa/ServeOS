import * as Haptics from "expo-haptics";
import React from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useAppTheme } from "../theme/AppThemeContext";

const DISMISS_DRAG = 72;

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  cardStyle?: StyleProp<ViewStyle>;
  maxWidth?: number;
};

/**
 * Centered floating card: tap scrim or drag down on the card to dismiss.
 */
export function FloatingCardModal(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const translateY = React.useRef(new Animated.Value(0)).current;
  const scrimOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (props.visible) {
      translateY.setValue(0);
      scrimOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 280 }),
        Animated.timing(scrimOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
      ]).start();
    }
  }, [props.visible, scrimOpacity, translateY]);

  const runDismiss = React.useCallback(
    (after?: () => void) => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 36, duration: 160, useNativeDriver: true }),
        Animated.timing(scrimOpacity, { toValue: 0, duration: 160, useNativeDriver: true })
      ]).start(() => {
        translateY.setValue(0);
        after?.();
      });
    },
    [scrimOpacity, translateY]
  );

  const requestClose = React.useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runDismiss(props.onRequestClose);
  }, [props.onRequestClose, runDismiss]);

  const pan = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DRAG || g.vy > 0.85) {
          requestClose();
          return;
        }
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 320 }).start();
      }
    })
  ).current;

  if (!props.visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityLabel="Close modal"
          accessibilityRole="button"
        />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark ? "rgba(0,0,0,0.72)" : "rgba(15,23,42,0.5)",
              opacity: scrimOpacity
            }
          ]}
        />
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.floatWrap,
            {
              transform: [{ translateY }],
              opacity: scrimOpacity
            }
          ]}
        >
          <View {...pan.panHandlers} style={styles.panHost}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: t.bg,
                borderColor: t.border,
                maxWidth: props.maxWidth ?? 400
              },
              props.cardStyle
            ]}
          >
            <View style={[styles.handle, { backgroundColor: t.borderStrong }]} />
            {props.children}
          </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  floatWrap: { width: "100%", alignItems: "center" },
  panHost: { width: "100%", alignItems: "center" },
  card: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: 10,
    ...Platform.select({
      ios: { shadowColor: "#0f172a", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.2, shadowRadius: 28 },
      android: { elevation: 20 }
    })
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12
  }
});
