import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
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
import { SkeletonBlock, SkeletonScreenFill } from "../../components/skeleton/SkeletonUi";
import { useAppTheme } from "../../theme/AppThemeContext";
import { CHAT } from "../chat/chatTheme";
import { ReservationBookingRef } from "./ReservationBookingRef";
import {
  ReservationDateTimeWheels,
  type ReservationDateTimeWheelsHandle,
  type ReservationWheelSelection
} from "../reservations/ReservationDateTimeWheels";
import { normalizeEditSlotPicker } from "../reservations/editSlotPickerNormalize";
import { fetchReservationSlotPicker, type CustomerReservationApi } from "../reservations/reservationApi";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SHEET_OPEN_MS = 520;
const SHEET_CLOSE_MS = 420;

type Panel = "menu" | "edit";

type Props = {
  visible: boolean;
  authToken: string;
  reservation: CustomerReservationApi | null;
  onClose: () => void;
  onCancel: () => Promise<void>;
  onSaveEdit: (patch: {
    dateLabel: string;
    quickDateId: string;
    timeLabel: string;
  }) => Promise<{ ok: true; dateLabel: string; timeLabel: string } | { ok: false; message: string }>;
  cancelLoading?: boolean;
  saveLoading?: boolean;
};

export function ReservationManageModal({
  visible,
  authToken,
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
  const wheelsRef = React.useRef<ReservationDateTimeWheelsHandle>(null);
  const [initialWheelSelection, setInitialWheelSelection] =
    React.useState<ReservationWheelSelection | null>(null);
  const [availableTimeLabels, setAvailableTimeLabels] = React.useState<string[]>([]);
  const [bookableDateIds, setBookableDateIds] = React.useState<string[]>([]);
  const [serverDateOptions, setServerDateOptions] = React.useState<
    { id: string; label: string; dateLabel: string; sublabel?: string }[]
  >([]);
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [pickerReady, setPickerReady] = React.useState(false);
  const [wheelEpoch, setWheelEpoch] = React.useState(0);
  const pickerReadyRef = React.useRef(false);
  const timesByDateIdRef = React.useRef<Record<string, string[]>>({});

  const reservationId = reservation?.id ?? null;
  const restaurantId = reservation?.restaurantId ?? null;

  const onDatePreview = React.useCallback((nextQuickDateId: string) => {
    const times = timesByDateIdRef.current[nextQuickDateId] ?? [];
    setAvailableTimeLabels(times.length > 0 ? times : []);
  }, []);

  const loadEditPicker = React.useCallback(async () => {
    if (!authToken || !restaurantId || !reservationId) return;
    setSlotsLoading(true);
    setPickerReady(false);
    pickerReadyRef.current = false;
    try {
      const res = await fetchReservationSlotPicker(authToken, restaurantId, { reservationId });
      if (!res.ok) {
        setAvailableTimeLabels([]);
        setBookableDateIds([]);
        setServerDateOptions([]);
        timesByDateIdRef.current = {};
        return;
      }
      const norm = normalizeEditSlotPicker(res);
      if (!norm.hasChoices) {
        timesByDateIdRef.current = {};
        setBookableDateIds([]);
        setServerDateOptions([]);
        setAvailableTimeLabels([]);
        setInitialWheelSelection(null);
        return;
      }
      timesByDateIdRef.current = norm.timesByDateId;
      setInitialWheelSelection({
        dateLabel: norm.dateLabel,
        quickDateId: norm.quickDateId,
        timeLabel: norm.timeLabel
      });
      setServerDateOptions(norm.dateOptions);
      setAvailableTimeLabels(norm.timesByDateId[norm.quickDateId] ?? []);
      setBookableDateIds(norm.bookableDateIds);
      setWheelEpoch((n) => n + 1);
      pickerReadyRef.current = true;
      setPickerReady(true);
    } catch {
      setAvailableTimeLabels([]);
      setBookableDateIds([]);
      setServerDateOptions([]);
      timesByDateIdRef.current = {};
      pickerReadyRef.current = false;
      setPickerReady(false);
    } finally {
      setSlotsLoading(false);
    }
  }, [authToken, restaurantId, reservationId]);

  React.useEffect(() => {
    setPanel("menu");
  }, [reservationId]);

  React.useEffect(() => {
    if (!visible || panel !== "edit" || !reservation) return;
    void loadEditPicker();
  }, [visible, panel, reservation?.id, loadEditPicker, reservation]);

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
    if (next !== "edit") {
      pickerReadyRef.current = false;
      timesByDateIdRef.current = {};
      setInitialWheelSelection(null);
      setPickerReady(false);
    }
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
    const picked = wheelsRef.current?.getSelection();
    if (!picked) {
      Alert.alert("Couldn't save", "Choose a date and time, then try again.");
      return;
    }
    const result = await onSaveEdit(picked);
    if (result.ok) {
      Alert.alert(
        "Booking updated",
        `Your visit is now ${result.dateLabel} at ${result.timeLabel}.`
      );
      requestClose();
      return;
    }
    Alert.alert("Couldn't update", result.message);
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
                <ReservationBookingRef
                  confirmationCode={reservation.confirmationCode}
                  labelColor={t.textMuted}
                  codeColor={t.textSecondary}
                  style={styles.refWrap}
                />
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
                    <Text style={[styles.dangerBtnText, cancelLoading && { opacity: 0.58 }]}>Cancel booking</Text>
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
                <Text style={[styles.currentVisit, { color: t.textSecondary }]}>
                  Currently booked: {reservation.draft.dateLabel} · {reservation.draft.timeLabel}
                </Text>
                <Text style={[styles.editHint, { color: t.textMuted }]}>
                  Scroll to preview other slots — only Save changes confirms your choice
                </Text>

                {!pickerReady && slotsLoading ? (
                  <SkeletonScreenFill style={{ minHeight: 220, marginVertical: 8 }}>
                    <SkeletonBlock lines={2} style={{ marginBottom: 16 }} />
                    <SkeletonBlock lines={4} />
                  </SkeletonScreenFill>
                ) : bookableDateIds.length === 0 || availableTimeLabels.length === 0 ? (
                  <Text style={[styles.noSlots, { color: t.textSecondary }]}>
                    No bookable dates right now. Try again closer to your visit or contact the venue.
                  </Text>
                ) : (
                  <>
                    {initialWheelSelection && availableTimeLabels.length > 0 ? (
                      <ReservationDateTimeWheels
                        ref={wheelsRef}
                        key={`picker-${wheelEpoch}`}
                        draftMode
                        seedKey={wheelEpoch}
                        initialSelection={initialWheelSelection}
                        dateLabel={initialWheelSelection.dateLabel}
                        timeLabel={initialWheelSelection.timeLabel}
                        availableTimeLabels={availableTimeLabels}
                        bookableDateIds={bookableDateIds}
                        serverDateOptions={serverDateOptions}
                        timesByDateId={timesByDateIdRef.current}
                        onDatePreview={(_dl, qid) => onDatePreview(qid)}
                        onDateChange={() => {}}
                        onTimeChange={() => {}}
                        disabled={saveLoading}
                      />
                    ) : null}
                  </>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                    styles.saveBtn,
                    (slotsLoading || !pickerReady || bookableDateIds.length === 0) && styles.btnDisabled
                  ]}
                  onPress={() => void handleSaveEdit()}
                  disabled={
                    saveLoading ||
                    slotsLoading ||
                    !pickerReady ||
                    bookableDateIds.length === 0 ||
                    availableTimeLabels.length === 0
                  }
                >
                  <Text style={[styles.primaryBtnText, saveLoading && { opacity: 0.58 }]}>Save changes</Text>
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
    maxHeight: "88%",
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
  refWrap: {
    marginTop: 6,
    marginBottom: 16
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
  currentVisit: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6
  },
  editHint: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8
  },
  slotsLoader: { marginVertical: 24 },
  noSlots: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginVertical: 20,
    lineHeight: 20
  },
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
  saveBtn: { marginTop: 12 },
  btnDisabled: { opacity: 0.45 },
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
