import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import {
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
import { formatOpeningHoursLines } from "../venueHoursDisplay";
import { isVenueOpenNow, useVenueClockTick } from "../venueOpenNow";
import { CHAT } from "./chatTheme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SHEET_OPEN_MS = 520;
const SHEET_CLOSE_MS = 420;

type Panel = "menu" | "opening_hours";

type Props = {
  visible: boolean;
  onClose: () => void;
  venueName: string;
  openingHours?: string | null;
  onAddItems: () => void;
  initialPanel?: Panel;
};

export function ChatVenueInfoModal({
  visible,
  onClose,
  venueName,
  openingHours,
  onAddItems,
  initialPanel = "menu"
}: Props) {
  const progress = useSharedValue(0);
  const [mounted, setMounted] = React.useState(visible);
  const [panel, setPanel] = React.useState<Panel>("menu");
  const clock = useVenueClockTick(30000);

  const displayName = venueName.trim() || "This venue";
  const hourLines = React.useMemo(() => formatOpeningHoursLines(openingHours), [openingHours]);
  const openNow = isVenueOpenNow(openingHours, clock);

  const finishClose = React.useCallback(() => {
    setMounted(false);
    setPanel("menu");
  }, []);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      setPanel(initialPanel);
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
  }, [visible, mounted, progress, finishClose, initialPanel]);

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

  if (!mounted) return null;

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
          accessibilityLabel="Dismiss"
        />

        <Animated.View style={[styles.sheet, sheetStyle]} pointerEvents="box-none">
          <View style={styles.sheetInner}>
            <View style={styles.grab} />

            {panel === "menu" ? (
              <>
                <Text style={styles.title}>Restaurant help</Text>
                <Text style={styles.subtitle}>Quick actions while you chat</Text>
                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                    onPress={() => animatePanel("opening_hours")}
                  >
                    <Text style={styles.primaryBtnText}>Opening Hours</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      requestClose();
                      onAddItems();
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Add items</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {panel === "opening_hours" ? (
              <View style={styles.detailPanel}>
                <Text style={styles.title}>Opening hours</Text>
                <Text style={styles.detailVenue}>{displayName}</Text>
                <Text style={[styles.statusTag, openNow ? styles.statusOpen : styles.statusClosed]}>
                  {openNow ? "Open now" : "Closed now"}
                </Text>
                <ScrollView style={styles.hoursScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.detailCard}>
                    {hourLines.map((line, i) => (
                      <Text key={`${i}-${line}`} style={[styles.hoursLine, i > 0 && styles.hoursLineGap]}>
                        {line}
                      </Text>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.28)"
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24
  },
  sheetInner: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: R.border,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: "78%",
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
    fontSize: 18,
    fontWeight: "800",
    color: R.text,
    textAlign: "center",
    letterSpacing: -0.25
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 18,
    fontSize: 13,
    fontWeight: "600",
    color: R.textMuted,
    textAlign: "center"
  },
  actions: {
    width: "100%",
    gap: 10
  },
  detailPanel: {
    width: "100%",
    minHeight: 120
  },
  detailVenue: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "700",
    color: R.textMuted,
    textAlign: "center"
  },
  detailCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: R.border,
    backgroundColor: "rgba(249,250,251,0.95)",
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  statusTag: {
    alignSelf: "center",
    marginBottom: 12,
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
  hoursScroll: {
    maxHeight: 200,
    marginBottom: 4
  },
  hoursLine: {
    fontSize: 15,
    lineHeight: 22,
    color: R.textSecondary,
    fontWeight: "600",
    textAlign: "center"
  },
  hoursLineGap: { marginTop: 6 },
  primaryBtn: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: R.radius.pill,
    backgroundColor: CHAT.brand,
    borderWidth: 2,
    borderColor: "#5B21B6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B21B6",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.15
  },
  pressed: { opacity: 0.9 }
});
