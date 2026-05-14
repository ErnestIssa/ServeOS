import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
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
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { patchCustomerPreferredRestaurant, type CustomerRestaurantRow } from "../api";
import { R } from "../theme";
import { VenueChangeRestartConfirmOverlay } from "./VenueChangeRestartConfirmModal";
import { formatOpeningHoursLines } from "./venueHoursDisplay";
import { isVenueOpenNow, useVenueClockTick } from "./venueOpenNow";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /** First name or friendly handle for copy in restart dialog. */
  userDisplayName: string;
  /** Current venue (may be loading with empty name until directory resolves). */
  active: { id: string; name: string; openingHours?: string | null };
  /** Full directory; alternatives = others when changing venue. */
  restaurants: CustomerRestaurantRow[];
  token: string;
  onVenueHydrated: (restaurantId: string) => Promise<void>;
  /** Demo / read-only: hide switch flow. */
  changeDisabled?: boolean;
};

export function CustomerVenueActionsModal(props: Props) {
  const { visible, onDismiss, userDisplayName, active, restaurants, token, onVenueHydrated, changeDisabled } = props;
  const clock = useVenueClockTick(30000);
  const p = useSharedValue(0);
  const [changeExpanded, setChangeExpanded] = React.useState(false);
  const [pendingSwitch, setPendingSwitch] = React.useState<{ id: string; name: string } | null>(null);
  const [confirmLoading, setConfirmLoading] = React.useState(false);

  React.useEffect(() => {
    p.value = withTiming(visible ? 1 : 0, { duration: visible ? 240 : 160, easing: Easing.out(Easing.cubic) });
  }, [visible, p]);

  React.useEffect(() => {
    if (!visible) {
      setChangeExpanded(false);
      setPendingSwitch(null);
      setConfirmLoading(false);
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 12 }, { scale: 0.98 + p.value * 0.02 }]
  }));

  const alternatives = React.useMemo(
    () => restaurants.filter((r) => r.id !== active.id),
    [restaurants, active.id]
  );

  const activeHourLines = formatOpeningHoursLines(active.openingHours);
  const activeOpen = isVenueOpenNow(active.openingHours, clock);
  const currentVenueLabel = active.name.trim() || "Your current restaurant";

  function requestSwitch(r: CustomerRestaurantRow) {
    if (changeDisabled || confirmLoading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingSwitch({ id: r.id, name: r.name.trim() || "Selected restaurant" });
  }

  function cancelRestart() {
    setPendingSwitch(null);
    void Haptics.selectionAsync();
  }

  async function confirmRestart() {
    if (!pendingSwitch || confirmLoading) return;
    setConfirmLoading(true);
    try {
      const patched = await patchCustomerPreferredRestaurant(token, pendingSwitch.id);
      if (!patched.ok) {
        setConfirmLoading(false);
        return;
      }
      await onVenueHydrated(patched.preferredRestaurantId);
      setPendingSwitch(null);
      onDismiss();
    } finally {
      setConfirmLoading(false);
    }
  }

  function toggleChange() {
    if (changeDisabled) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChangeExpanded((e) => !e);
    void Haptics.selectionAsync();
  }

  function handleRequestClose() {
    if (pendingSwitch) cancelRestart();
    else onDismiss();
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleRequestClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={pendingSwitch ? undefined : onDismiss}
            accessibilityRole="button"
            accessibilityLabel={pendingSwitch ? undefined : "Dismiss"}
          />
        </Animated.View>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View style={[styles.card, cardStyle]} accessibilityRole="alert">
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title} numberOfLines={2}>
                {currentVenueLabel}
              </Text>
              <Text style={[styles.statusTag, activeOpen ? styles.statusOpen : styles.statusClosed]}>
                {activeOpen ? "Open" : "Closed"}
              </Text>
              <Text style={styles.hoursLabel}>Opening hours</Text>
              <View style={styles.hoursBlock}>
                {activeHourLines.map((line, i) => (
                  <Text key={`${i}-${line}`} style={[styles.hoursLine, i > 0 && styles.hoursLineGap]}>
                    {line}
                  </Text>
                ))}
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>More actions</Text>
              <GhostActionRow label="Edit venue nickname" hint="Soon" onPress={() => void Haptics.selectionAsync()} />
              <GhostActionRow label="Mark as favorite" hint="Soon" onPress={() => void Haptics.selectionAsync()} />
              <GhostActionRow label="Notifications for this venue" hint="Soon" onPress={() => void Haptics.selectionAsync()} />

              <Pressable
                onPress={toggleChange}
                disabled={changeDisabled || alternatives.length === 0}
                style={({ pressed }) => [
                  styles.changeCta,
                  (changeDisabled || alternatives.length === 0) && styles.changeCtaDisabled,
                  pressed && !changeDisabled && styles.pressed
                ]}
              >
                <Text style={styles.changeCtaText}>Change restaurant</Text>
              </Pressable>

              {changeExpanded && alternatives.length > 0 ? (
                <View style={styles.altBlock}>
                  <Text style={styles.altHead}>Other venues</Text>
                  {alternatives.map((r) => {
                    const lines = formatOpeningHoursLines(r.openingHours);
                    const rowOpen = isVenueOpenNow(r.openingHours, clock);
                    return (
                      <Pressable
                        key={r.id}
                        disabled={!!pendingSwitch || confirmLoading}
                        onPress={() => requestSwitch(r)}
                        style={({ pressed }) => [styles.altRow, pressed && styles.pressed]}
                      >
                        <View style={styles.altRowText}>
                          <Text style={styles.altName}>{r.name}</Text>
                          <Text style={[styles.altOpenTag, rowOpen ? styles.statusOpen : styles.statusClosed]}>
                            {rowOpen ? "Open" : "Closed"}
                          </Text>
                          <View style={styles.altHoursBlock}>
                            {lines.map((line, i) => (
                              <Text key={`${r.id}-${i}-${line}`} style={[styles.altHoursLine, i > 0 && styles.altHoursGap]}>
                                {line}
                              </Text>
                            ))}
                          </View>
                        </View>
                        {pendingSwitch?.id === r.id && confirmLoading ? (
                          <ActivityIndicator color={R.accentPurple} />
                        ) : (
                          <Text style={styles.altChevron}>→</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <Pressable onPress={onDismiss} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>

        {pendingSwitch ? (
          <VenueChangeRestartConfirmOverlay
            userFirstName={userDisplayName}
            currentVenueName={currentVenueLabel}
            nextVenueName={pendingSwitch.name}
            onCancel={cancelRestart}
            onConfirm={confirmRestart}
            loading={confirmLoading}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function GhostActionRow(props: { label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [styles.ghostRow, pressed && styles.pressed]}>
      <View style={styles.ghostRowInner}>
        <Text style={styles.ghostLabel}>{props.label}</Text>
        <Text style={styles.ghostHint}>{props.hint}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.45)"
  },
  center: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16
  },
  card: {
    maxHeight: "88%",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)"
  },
  scroll: { maxHeight: "100%" },
  scrollContent: { padding: 16, paddingBottom: 20 },
  title: { fontSize: 20, fontWeight: "900", color: R.text, letterSpacing: -0.3 },
  statusTag: {
    marginTop: 8,
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden"
  },
  statusOpen: {
    color: "#047857",
    backgroundColor: "rgba(16, 185, 129, 0.16)"
  },
  statusClosed: {
    color: "#B91C1C",
    backgroundColor: "rgba(239, 68, 68, 0.14)"
  },
  hoursLabel: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: "800",
    color: R.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  hoursBlock: { marginTop: 6 },
  hoursLine: { fontSize: 14, lineHeight: 20, color: R.textSecondary, fontWeight: "600" },
  hoursLineGap: { marginTop: 4 },
  divider: {
    marginTop: 18,
    height: StyleSheet.hairlineWidth,
    backgroundColor: R.border
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "800",
    color: R.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  ghostRow: {
    borderRadius: 14,
    backgroundColor: "rgba(249,250,251,0.95)",
    borderWidth: 1,
    borderColor: R.border,
    marginBottom: 8
  },
  ghostRowInner: { paddingVertical: 12, paddingHorizontal: 14 },
  ghostLabel: { fontSize: 15, fontWeight: "700", color: R.text },
  ghostHint: { marginTop: 2, fontSize: 12, fontWeight: "600", color: R.textMuted },
  changeCta: {
    marginTop: 6,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: R.danger
  },
  changeCtaDisabled: { opacity: 0.38 },
  changeCtaText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  altBlock: { marginTop: 12 },
  altHead: {
    fontSize: 12,
    fontWeight: "800",
    color: R.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  altRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: R.border,
    backgroundColor: R.bgElevated,
    marginBottom: 8
  },
  altRowText: { flex: 1, minWidth: 0 },
  altName: { fontSize: 16, fontWeight: "800", color: R.text },
  altOpenTag: {
    marginTop: 4,
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden"
  },
  altHoursBlock: { marginTop: 4 },
  altHoursLine: { fontSize: 12, lineHeight: 17, fontWeight: "600", color: R.textSecondary },
  altHoursGap: { marginTop: 2 },
  altChevron: { fontSize: 18, fontWeight: "700", color: R.textMuted, marginLeft: 8 },
  closeBtn: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.92)"
  },
  closeText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  pressed: { opacity: 0.9 }
});
