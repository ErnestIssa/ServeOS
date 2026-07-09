import * as Haptics from "expo-haptics";
import React from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { ChatIconCamera } from "../ChatIconCamera";
import { useChatTheme } from "../useChatTheme";

export type AttachmentChoice = "photos" | "camera" | "document";

const ITEMS: Array<{ id: AttachmentChoice; label: string; glyph: string }> = [
  { id: "photos", label: "Photo", glyph: "🖼" },
  { id: "camera", label: "Camera", glyph: "📷" },
  { id: "document", label: "Document", glyph: "📄" }
];

const ANIM_MS = 320;
export const ATTACH_MENU_DISMISS_MS = ANIM_MS + 40;
const DIM_OPACITY = 0.28;

type Props = {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: AttachmentChoice) => void;
  onDismissed?: () => void;
};

export function AttachmentMenu({ visible, onClose, onChoose, onDismissed }: Props) {
  const { tokens, colors: t, isDark } = useChatTheme();
  const [mounted, setMounted] = React.useState(false);
  const progress = useSharedValue(0);
  const onDismissedRef = React.useRef(onDismissed);
  onDismissedRef.current = onDismissed;
  const wasVisibleRef = React.useRef(false);

  React.useEffect(() => {
    if (visible) {
      wasVisibleRef.current = true;
      setMounted(true);
      progress.value = withTiming(1, {
        duration: ANIM_MS,
        easing: Easing.out(Easing.cubic)
      });
      return;
    }
    if (!wasVisibleRef.current) return;
    wasVisibleRef.current = false;
    progress.value = withTiming(
      0,
      { duration: ANIM_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
          if (onDismissedRef.current) runOnJS(onDismissedRef.current)();
        }
      }
    );
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * DIM_OPACITY
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 280 }]
  }));

  function pick(choice: AttachmentChoice) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChoose(choice);
    onClose();
  }

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close attachments"
        >
          <Animated.View
            style={[styles.dim, { backgroundColor: t.text }, backdropStyle]}
            pointerEvents="none"
          />
        </Pressable>

        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? t.bgElevated : t.bg,
              borderColor: t.border,
              shadowColor: t.shadow
            },
            sheetStyle
          ]}
        >
          <View style={[styles.grab, { backgroundColor: t.borderStrong }]} />
          <Text style={[styles.title, { color: tokens.brand }]}>Attach</Text>
          <View style={styles.row}>
            {ITEMS.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => pick(item.id)}
                style={({ pressed }) => [
                  styles.tile,
                  { backgroundColor: tokens.brandSoft, borderColor: t.border },
                  pressed && styles.pressed
                ]}
              >
                {item.id === "camera" ? (
                  <ChatIconCamera color={tokens.brand} size={22} />
                ) : (
                  <Text style={[styles.glyph, { color: tokens.brand }]}>{item.glyph}</Text>
                )}
                <Text style={[styles.tileLabel, { color: t.text }]} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={[styles.cancelText, { color: t.textMuted }]}>Cancel</Text>
          </Pressable>
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
  dim: {
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
    paddingTop: 10,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8
      },
      android: { elevation: 8 }
    })
  },
  grab: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12
  },
  title: { fontSize: 17, fontWeight: "900", textAlign: "center", marginBottom: 14 },
  row: { flexDirection: "row", gap: 10, marginBottom: 4 },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6
  },
  glyph: { fontSize: 20, fontWeight: "800" },
  tileLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  cancel: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  cancelText: { fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.9 }
});
