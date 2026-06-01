import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { R } from "../../theme";
import { useAppTheme } from "../../theme/AppThemeContext";
import { CHAT } from "../chat/chatTheme";
import type { CustomerReservationApi } from "../reservations/reservationApi";
import { TIME_OPTIONS } from "../reservations/reservationPresets";
import { buildQuickDateOptions, quickDateIdFromLabel } from "../reservations/reservationQuickDates";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SHEET_OPEN_MS = 520;
const SHEET_CLOSE_MS = 420;

type Panel = "menu" | "edit";

type Props = {
  visible: boolean;
  reservation: CustomerReservationApi | null;
  onClose: () => void;
  onCancel: () => Promise<void>;
  onSaveEdit: (patch: { dateLabel: string; quickDateId: string; timeLabel: string }) => Promise<void>;
  cancelLoading?: boolean;
  saveLoading?: boolean;
};

export function ReservationManageModal({
  visible,
  reservation,
  onClose,
  onCancel,
  onSaveEdit,
  cancelLoading,
  saveLoading
}: Props) {
  const { colors: t } = useAppTheme();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = React.useState(visible);
  const [panel, setPanel] = React.useState<Panel>("menu");
  const dateOptions = React.useMemo(() => buildQuickDateOptions(10), []);
  const [dateLabel, setDateLabel] = React.useState("");
  const [quickDateId, setQuickDateId] = React.useState<string | null>(null);
  const [timeLabel, setTimeLabel] = React.useState("");

  React.useEffect(() => {
    if (!reservation) return;
    setDateLabel(reservation.draft.dateLabel);
    setQuickDateId(reservation.draft.quickDateId ?? quickDateIdFromLabel(dateOptions, reservation.draft.dateLabel));
    setTimeLabel(reservation.draft.timeLabel);
  }, [reservation, dateOptions]);

  const finishClose = React.useCallback(() => {
    setMounted(false);
    setPanel("menu");
  }, []);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      setPanel("menu");
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

  const requestClose = React.useCallback(() => {
    onClose();
  }, [onClose]);

  function animatePanel(next: Panel) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPanel(next);
    void Haptics.selectionAsync();
  }

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 48 }]
  }));

  if (!mounted || !reservation) return null;

  const venueName = reservation.restaurantName.trim() || "Your venue";

  async function handleCancelPress() {
    Alert.alert("Cancel booking?", "This cannot be undone.", [
      { text: "Keep booking", style: "cancel" },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await onCancel();
              requestClose();
            } catch {
              Alert.alert("Couldn't cancel", "Please try again.");
            }
          })();
        }
      }
    ]);
  }

  async function handleSaveEdit() {
    if (!quickDateId) return;
    try {
      await onSaveEdit({ dateLabel, quickDateId, timeLabel });
      requestClose();
    } catch {
      Alert.alert("Couldn't save", "Please check your date and time and try again.");
    }
  }

  return (
    <Modal transparent visible animationType="none" onRequestClose={requestClose} statusBarTranslucent>
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
          <View style={styles.backdropDim} pointerEvents="none" />
        </Animated.View>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />

        <Animated.View style={[styles.sheet, sheetStyle]} pointerEvents="box-none">
          <View style={styles.sheetInner}>
            <View style={styles.grab} />

            {panel === "menu" ? (
              <>
                <Text style={styles.title}>Manage booking</Text>
                <Text style={styles.subtitle}>{venueName}</Text>
                <Text style={[styles.ref, { color: t.textMuted }]}>{reservation.confirmationCode}</Text>
                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                    onPress={() => animatePanel("edit")}
                  >
                    <Text style={styles.primaryBtnText}>Change date or time</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]}
                    onPress={() => void handleCancelPress()}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.dangerBtnText}>Cancel booking</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}

            {panel === "edit" ? (
              <View style={styles.detailPanel}>
                <Pressable
                  onPress={() => animatePanel("menu")}
                  style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Back to menu"
                >
                  <Text style={styles.backChevron}>‹</Text>
                  <Text style={styles.backLabel}>Back</Text>
                </Pressable>
                <Text style={styles.title}>Change date or time</Text>
                <ScrollView style={styles.editScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.sectionLabel}>Date</Text>
                  <View style={styles.chipRow}>
                    {dateOptions.map((opt) => {
                      const selected = quickDateId === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => {
                            setQuickDateId(opt.id);
                            setDateLabel(opt.dateLabel);
                            void Haptics.selectionAsync();
                          }}
                          style={({ pressed }) => [
                            styles.chip,
                            selected && styles.chipSelected,
                            pressed && styles.pressed
                          ]}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={[styles.sectionLabel, styles.sectionGap]}>Time</Text>
                  <View style={styles.chipRow}>
                    {TIME_OPTIONS.map((opt) => {
                      const selected = timeLabel === opt.label;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => {
                            setTimeLabel(opt.label);
                            void Haptics.selectionAsync();
                          }}
                          style={({ pressed }) => [
                            styles.chip,
                            selected && styles.chipSelected,
                            pressed && styles.pressed
                          ]}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
                <Pressable
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, styles.saveBtn]}
                  onPress={() => void handleSaveEdit()}
                  disabled={saveLoading}
                >
                  {saveLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save changes</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                requestClose();
              }}
            >
              <Text style={styles.cancelBtnText}>{panel === "menu" ? "Close" : "Cancel"}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdropWrap: { ...StyleSheet.absoluteFillObject },
  backdropDim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2,6,23,0.28)" },
  sheet: { position: "absolute", left: 12, right: 12, bottom: 24 },
  sheetInner: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: R.border,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: "82%",
    shadowColor: "#000",
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
    backgroundColor: R.borderStrong,
    marginBottom: 14
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: R.text,
    textAlign: "center",
    letterSpacing: -0.25
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: R.textMuted,
    textAlign: "center"
  },
  ref: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center"
  },
  actions: { width: "100%", gap: 10 },
  detailPanel: { width: "100%", minHeight: 120 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 10,
    paddingVertical: 4,
    paddingRight: 8
  },
  backChevron: { fontSize: 22, fontWeight: "800", color: CHAT.brand, marginRight: 2, lineHeight: 24 },
  backLabel: { fontSize: 15, fontWeight: "700", color: CHAT.brand },
  editScroll: { maxHeight: 280, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: R.textMuted, marginBottom: 8 },
  sectionGap: { marginTop: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: R.border,
    backgroundColor: "rgba(249,250,251,0.95)"
  },
  chipSelected: {
    borderColor: CHAT.brand,
    backgroundColor: "rgba(139, 92, 246, 0.12)"
  },
  chipText: { fontSize: 14, fontWeight: "700", color: R.textSecondary },
  chipTextSelected: { color: CHAT.brand },
  primaryBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: R.radius.pill,
    backgroundColor: CHAT.brand,
    borderWidth: 2,
    borderColor: "#5B21B6",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  dangerBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: R.radius.pill,
    backgroundColor: "#DC2626",
    borderWidth: 2,
    borderColor: "#991B1B",
    alignItems: "center",
    justifyContent: "center"
  },
  dangerBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  saveBtn: { marginTop: 4 },
  cancelBtn: {
    marginTop: 14,
    width: "100%",
    paddingVertical: 14,
    borderRadius: R.radius.pill,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 2,
    borderColor: "rgba(139, 92, 246, 0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  cancelBtnText: { fontSize: 16, fontWeight: "700", color: CHAT.brand },
  pressed: { opacity: 0.9 }
});
