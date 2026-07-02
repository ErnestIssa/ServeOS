import { BlurView } from "expo-blur";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { type CustomerRestaurantRow } from "../api";
import { useAppTheme } from "../theme/AppThemeContext";
import { CustomerVenueDirectorySection } from "./CustomerVenueDirectorySection";

const MODAL_OPEN_MS = 520;
const MODAL_CLOSE_MS = 420;

type Props = {
  visible: boolean;
  onDismiss: () => void;
  userDisplayName: string;
  active: { id: string; name: string; openingHours?: string | null };
  restaurants: CustomerRestaurantRow[];
  directoryLoading?: boolean;
  token: string;
  onVenueHydrated: (restaurantId: string) => Promise<void>;
  changeDisabled?: boolean;
  onSwitchError?: (message: string) => void;
};

export function CustomerVenueActionsModal(props: Props) {
  const { visible, onDismiss, userDisplayName, active, restaurants, directoryLoading, token, onVenueHydrated, changeDisabled, onSwitchError } = props;
  const { colors: t } = useAppTheme();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = React.useState(visible);
  const [venueConfirmOverlay, setVenueConfirmOverlay] = React.useState<React.ReactNode>(null);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
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
          maxHeight: "88%",
          borderRadius: 22,
          backgroundColor: "rgba(255,255,255,0.96)",
          borderWidth: 1,
          borderColor: t.border
        },
        scroll: { maxHeight: "100%" },
        scrollContent: { padding: 16, paddingBottom: 20 },
        closeBtn: {
          marginTop: 8,
          borderRadius: 16,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(15,23,42,0.92)",
          borderWidth: 0,
          borderColor: t.border
        },
        closeText: { color: "#fff", fontSize: 14, fontWeight: "900" },
        pressed: { opacity: 0.9 }
      }),
    [t]
  );

  const finishClose = React.useCallback(() => {
    setMounted(false);
    setVenueConfirmOverlay(null);
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

  const requestDismiss = React.useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 48 }, { scale: 0.96 + progress.value * 0.04 }]
  }));

  async function handleVenueHydrated(restaurantId: string) {
    await onVenueHydrated(restaurantId);
    onDismiss();
  }

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={requestDismiss} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={requestDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
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
              <CustomerVenueDirectorySection
                userDisplayName={userDisplayName}
                active={active}
                restaurants={restaurants}
                directoryLoading={directoryLoading}
                token={token}
                onVenueHydrated={handleVenueHydrated}
                changeDisabled={changeDisabled}
                onSwitchError={onSwitchError}
                onConfirmOverlayChange={setVenueConfirmOverlay}
              />
              <Pressable onPress={requestDismiss} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>

        {venueConfirmOverlay ? (
          <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => setVenueConfirmOverlay(null)}>
            {venueConfirmOverlay}
          </Modal>
        ) : null}
      </View>
    </Modal>
  );
}
