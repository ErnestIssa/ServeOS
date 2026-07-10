import { BlurView } from "expo-blur";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { fetchCustomerVenueHoursPeers, type CustomerVenueHoursPeer } from "../api";
import { SkeletonVenueRows } from "../components/skeleton/SkeletonUi";
import { useAppTheme } from "../theme/AppThemeContext";
import { formatOpeningHoursLines } from "./venueHoursDisplay";
import { isVenueOpenNow, useVenueClockTick } from "./venueOpenNow";

const MODAL_OPEN_MS = 420;
const MODAL_CLOSE_MS = 320;

type Props = {
  visible: boolean;
  onDismiss: () => void;
  token: string;
  restaurantId: string;
  /** Shown immediately while peers load. */
  fallbackName: string;
  fallbackOpeningHours?: string | null;
};

function VenueHoursBlock({
  venue,
  emphasized = false
}: {
  venue: CustomerVenueHoursPeer;
  emphasized?: boolean;
}) {
  const { colors: t } = useAppTheme();
  const clock = useVenueClockTick(30000);
  const lines = formatOpeningHoursLines(venue.openingHours);
  const openNow = isVenueOpenNow(venue.openingHours, clock);

  return (
    <View style={[styles.block, emphasized && styles.blockEmphasized, { borderColor: t.border, backgroundColor: t.bgElevated }]}>
      <Text style={[emphasized ? styles.venueTitle : styles.peerTitle, { color: t.text }]} numberOfLines={2}>
        {venue.name.trim() || "Venue"}
      </Text>
      {openNow !== null ? (
        <Text style={[styles.statusTag, openNow ? styles.statusOpen : styles.statusClosed]}>
          {openNow ? "Open" : "Closed"}
        </Text>
      ) : null}
      {lines.length > 0 ? (
        <>
          <Text style={[styles.hoursLabel, { color: t.textMuted }]}>Opening hours</Text>
          <View style={styles.hoursBlock}>
            {lines.map((line, i) => (
              <Text key={`${venue.id}-${i}-${line}`} style={[styles.hoursLine, { color: t.textSecondary }, i > 0 && styles.hoursGap]}>
                {line}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <Text style={[styles.hoursEmpty, { color: t.textMuted }]}>Hours not published yet.</Text>
      )}
    </View>
  );
}

export function CustomerVenueActionsModal({
  visible,
  onDismiss,
  token,
  restaurantId,
  fallbackName,
  fallbackOpeningHours
}: Props) {
  const { colors: t } = useAppTheme();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = React.useState(visible);
  const [loading, setLoading] = React.useState(false);
  const [current, setCurrent] = React.useState<CustomerVenueHoursPeer | null>(null);
  const [peers, setPeers] = React.useState<CustomerVenueHoursPeer[]>([]);

  const finishClose = React.useCallback(() => {
    setMounted(false);
    setCurrent(null);
    setPeers([]);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: MODAL_OPEN_MS,
        easing: Easing.out(Easing.cubic)
      });
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(
      0,
      { duration: MODAL_CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      }
    );
  }, [visible, mounted, progress, finishClose]);

  React.useEffect(() => {
    if (!visible || !restaurantId.trim()) return;
    let cancelled = false;
    setLoading(true);
    setCurrent({
      id: restaurantId,
      name: fallbackName,
      openingHours: fallbackOpeningHours ?? null
    });
    setPeers([]);
    void (async () => {
      try {
        const res = await fetchCustomerVenueHoursPeers(token, restaurantId);
        if (cancelled) return;
        if (res.ok) {
          setCurrent(res.current);
          setPeers(res.peers);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, restaurantId, token, fallbackName, fallbackOpeningHours]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 40 }]
  }));

  if (!mounted) return null;

  const displayCurrent = current ?? {
    id: restaurantId,
    name: fallbackName,
    openingHours: fallbackOpeningHours ?? null
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            style={[styles.card, cardStyle, { backgroundColor: t.bg, borderColor: t.border, shadowColor: t.shadow }]}
          >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.sheetTitle, { color: t.text }]}>Opening hours</Text>
              <VenueHoursBlock venue={displayCurrent} emphasized />

              {loading && peers.length === 0 ? (
                <SkeletonVenueRows count={2} style={{ marginTop: 12 }} />
              ) : null}

              {peers.length > 0 ? (
                <>
                  <Text style={[styles.peersHeading, { color: t.textMuted }]}>Other locations</Text>
                  {peers.map((peer) => (
                    <VenueHoursBlock key={peer.id} venue={peer} />
                  ))}
                </>
              ) : null}
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
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
    maxHeight: "82%",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14
  },
  scroll: { maxHeight: "100%" },
  scrollContent: { padding: 16, paddingBottom: 20 },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.25,
    marginBottom: 14
  },
  block: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10
  },
  blockEmphasized: {
    borderWidth: 1.5
  },
  venueTitle: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.25
  },
  peerTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2
  },
  statusTag: {
    marginTop: 8,
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
    overflow: "hidden"
  },
  statusOpen: { color: "#047857", backgroundColor: "rgba(16, 185, 129, 0.16)" },
  statusClosed: { color: "#B91C1C", backgroundColor: "rgba(239, 68, 68, 0.14)" },
  hoursLabel: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  hoursBlock: { marginTop: 6 },
  hoursLine: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  hoursGap: { marginTop: 4 },
  hoursEmpty: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600"
  },
  peersHeading: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  }
});
