import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useAppTheme } from "../theme/AppThemeContext";
import type { ExperienceOption } from "./experienceSwitcherUtils";

type Props = {
  visible: boolean;
  options: ExperienceOption[];
  currentLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (option: ExperienceOption) => void;
};

export function ExperienceSwitchConfirmModal(props: Props) {
  const { visible, options, currentLabel, busy, onCancel, onConfirm } = props;
  const { colors: t, isDark } = useAppTheme();
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const p = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      setSelectedKey(null);
      p.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    } else {
      p.value = 0;
    }
  }, [visible, p]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.94 + p.value * 0.06 }]
  }));

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, justifyContent: "center", alignItems: "center" },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isDark ? "rgba(0,0,0,0.72)" : "rgba(2,6,23,0.55)"
        },
        centerWrap: {
          width: "100%",
          paddingHorizontal: 22,
          maxWidth: 400
        },
        card: {
          borderRadius: 22,
          backgroundColor: t.bg,
          borderWidth: 1,
          borderColor: t.border,
          padding: 20,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.18,
              shadowRadius: 24
            },
            android: { elevation: 16 }
          })
        },
        badge: {
          alignSelf: "flex-start",
          fontSize: 11,
          fontWeight: "900",
          color: t.accentPurple,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom: 8
        },
        title: { fontSize: 20, fontWeight: "900", color: t.text, letterSpacing: -0.35 },
        body: { marginTop: 10, fontSize: 14, lineHeight: 20, color: t.textSecondary, fontWeight: "600" },
        emphasis: { fontWeight: "900", color: t.text },
        options: { marginTop: 16, gap: 8 },
        optionRow: {
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: t.border,
          backgroundColor: t.bgElevated,
          paddingVertical: 12,
          paddingHorizontal: 14,
          gap: 12
        },
        optionRowSelected: {
          borderColor: t.accentPurple,
          backgroundColor: isDark ? "rgba(167,139,250,0.12)" : "rgba(139,92,246,0.08)"
        },
        radio: {
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: t.border,
          alignItems: "center",
          justifyContent: "center"
        },
        radioSelected: { borderColor: t.accentPurple },
        radioDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: t.accentPurple
        },
        optionText: { flex: 1, minWidth: 0 },
        optionTitle: { fontSize: 15, fontWeight: "900", color: t.text },
        optionSub: { marginTop: 2, fontSize: 12, fontWeight: "600", color: t.textMuted },
        hint: {
          marginTop: 12,
          fontSize: 12,
          lineHeight: 17,
          fontWeight: "600",
          color: t.textMuted
        },
        actions: { marginTop: 18, flexDirection: "row", alignItems: "stretch", gap: 10 },
        cancelBtn: {
          flex: 1,
          borderRadius: 14,
          paddingVertical: 13,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.bgElevated,
          borderWidth: 1,
          borderColor: t.border
        },
        cancelText: { fontSize: 15, fontWeight: "800", color: t.text },
        confirmBtn: {
          flex: 1,
          borderRadius: 14,
          paddingVertical: 13,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.accentPurple
        },
        confirmBtnDisabled: { opacity: 0.42 },
        confirmText: { fontSize: 15, fontWeight: "900", color: "#fff" },
        pressed: { opacity: 0.88 }
      }),
    [isDark, t]
  );

  const selected = options.find((o) => o.key === selectedKey) ?? null;
  const canConfirm = Boolean(selected) && !busy;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel" />
        </Animated.View>

        <View style={styles.centerWrap} pointerEvents="box-none">
          <Animated.View style={[styles.card, cardStyle]} accessibilityRole="alert">
            <Text style={styles.badge}>Switch experience</Text>
            <Text style={styles.title}>Choose an experience</Text>
            <Text style={styles.body}>
              You are in <Text style={styles.emphasis}>{currentLabel}</Text>. Select where you want to go next, then
              confirm.
            </Text>

            <View style={styles.options}>
              {options.map((opt) => {
                const picked = selectedKey === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: picked }}
                    disabled={busy}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setSelectedKey(opt.key);
                    }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      picked && styles.optionRowSelected,
                      pressed && !busy && styles.pressed
                    ]}
                  >
                    <View style={[styles.radio, picked && styles.radioSelected]}>
                      {picked ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle} numberOfLines={1}>
                        {opt.title}
                      </Text>
                      <Text style={styles.optionSub} numberOfLines={1}>
                        {opt.subtitle}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {!selectedKey ? (
              <Text style={styles.hint}>Pick an option above before confirming.</Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                disabled={busy}
                style={({ pressed }) => [styles.cancelBtn, (pressed || busy) && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!selected || busy) return;
                  void Haptics.selectionAsync();
                  onConfirm(selected);
                }}
                disabled={!canConfirm}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  !canConfirm && styles.confirmBtnDisabled,
                  pressed && canConfirm && styles.pressed
                ]}
              >
                <Text style={styles.confirmText}>Confirm</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
