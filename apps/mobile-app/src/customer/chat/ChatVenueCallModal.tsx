import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { useChatTheme } from "./useChatTheme";

const SHEET_OPEN_MS = 420;
const SHEET_CLOSE_MS = 320;

type Props = {
  visible: boolean;
  venueName: string;
  calling?: boolean;
  onClose: () => void;
  onCall: () => void;
};

export function ChatVenueCallModal({ visible, venueName, calling = false, onClose, onCall }: Props) {
  const { tokens, colors: t } = useChatTheme();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = React.useState(visible);
  const displayName = venueName.trim() || "this venue";

  const finishClose = React.useCallback(() => {
    setMounted(false);
  }, []);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: SHEET_OPEN_MS,
        easing: Easing.out(Easing.cubic)
      });
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(
      0,
      { duration: SHEET_CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      }
    );
  }, [visible, mounted, progress, finishClose]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 40 }]
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdropWrap, backdropStyle]} pointerEvents="none">
          <BlurView
            intensity={Platform.OS === "ios" ? 72 : 50}
            tint={Platform.OS === "ios" ? "systemChromeMaterialLight" : "light"}
            style={StyleSheet.absoluteFill}
            {...(Platform.OS === "android"
              ? ({ experimentalBlurMethod: "dimezisBlurView" } as const)
              : {})}
          />
          <View style={[styles.backdropDim, { backgroundColor: `${t.text}47` }]} pointerEvents="none" />
        </Animated.View>

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={calling ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          disabled={calling}
        />

        <Animated.View style={[styles.sheet, sheetStyle]} pointerEvents="box-none">
          <View
            style={[
              styles.sheetInner,
              {
                backgroundColor: t.bg,
                borderColor: t.border,
                shadowColor: t.shadow
              }
            ]}
          >
            <View style={[styles.grab, { backgroundColor: t.borderStrong }]} />
            <Text style={[styles.question, { color: t.text }]}>
              Do you want to call {displayName}?
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                disabled={calling}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => [
                  styles.btn,
                  styles.cancelBtn,
                  { borderColor: t.border, backgroundColor: t.bgSubtle },
                  pressed && !calling && styles.pressed,
                  calling && styles.disabled
                ]}
              >
                <Text style={[styles.cancelText, { color: t.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onCall();
                }}
                disabled={calling}
                accessibilityRole="button"
                accessibilityLabel={`Call ${displayName}`}
                style={({ pressed }) => [
                  styles.btn,
                  styles.callBtn,
                  { backgroundColor: tokens.brand, borderColor: tokens.brandDeep },
                  pressed && !calling && styles.pressed,
                  calling && styles.disabled
                ]}
              >
                {calling ? (
                  <ActivityIndicator color={tokens.mineText} size="small" />
                ) : (
                  <Text style={[styles.callText, { color: tokens.mineText }]}>Call</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdropWrap: {
    ...StyleSheet.absoluteFillObject
  },
  backdropDim: {
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24
  },
  sheetInner: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14
  },
  grab: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16
  },
  question: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 24,
    letterSpacing: -0.2,
    marginBottom: 18
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  cancelBtn: {},
  callBtn: {
    borderWidth: 2
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "700"
  },
  callText: {
    fontSize: 16,
    fontWeight: "800"
  },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.65 }
});
