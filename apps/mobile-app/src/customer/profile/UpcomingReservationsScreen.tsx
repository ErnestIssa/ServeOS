import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import {
  cancelCustomerReservation,
  fetchUpcomingReservations,
  patchCustomerReservation,
  type CustomerReservationApi
} from "../reservations/reservationApi";
import { ProfileScreenContainer } from "./ProfileUi";
import { ReservationCountdownRing } from "./ReservationCountdownRing";
import { ReservationManageModal } from "./ReservationManageModal";

type Props = {
  authToken: string;
  topInset: number;
  bottomInset: number;
  onOpenBookingDetails: (reservation: CustomerReservationApi) => void;
};

export function UpcomingReservationsScreen(props: Props) {
  const { colors: t } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [reservations, setReservations] = React.useState<CustomerReservationApi[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [saveLoading, setSaveLoading] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUpcomingReservations(props.authToken);
      if (res.ok) {
        setReservations(res.reservations);
        setActiveIndex(0);
      } else {
        setReservations([]);
      }
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [props.authToken]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const active = reservations[activeIndex] ?? null;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        center: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: t.space.md,
          paddingBottom: 24
        },
        venue: {
          fontSize: 28,
          fontWeight: "900",
          color: t.text,
          textAlign: "center",
          marginBottom: 8,
          letterSpacing: -0.5
        },
        meta: {
          fontSize: 16,
          fontWeight: "700",
          color: t.textSecondary,
          textAlign: "center",
          marginBottom: 28
        },
        code: {
          marginTop: 20,
          fontSize: 15,
          fontWeight: "800",
          letterSpacing: 1.2,
          color: t.ordersNavPurpleBright
        },
        btnRow: {
          flexDirection: "row",
          gap: 12,
          marginTop: 36,
          width: "100%",
          maxWidth: 420
        },
        btn: {
          flex: 1,
          minHeight: 64,
          borderRadius: 20,
          borderWidth: 2,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
          paddingVertical: 16
        },
        btnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
        btnDetails: {
          backgroundColor: t.ordersNavPurpleBright,
          borderColor: "#5B21B6"
        },
        btnManage: {
          backgroundColor: t.accentBlue,
          borderColor: "#1D4ED8"
        },
        btnLabel: {
          fontSize: 17,
          fontWeight: "900",
          color: "#FFFFFF",
          textAlign: "center"
        },
        emptyTitle: {
          fontSize: 22,
          fontWeight: "900",
          color: t.text,
          textAlign: "center"
        },
        emptyBody: {
          marginTop: 10,
          fontSize: 15,
          fontWeight: "600",
          color: t.textMuted,
          textAlign: "center",
          lineHeight: 22
        },
        pager: {
          flexDirection: "row",
          gap: 8,
          marginTop: 20
        },
        dot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: `${t.ordersNavPurpleBright}44`
        },
        dotActive: { backgroundColor: t.ordersNavPurpleBright, width: 24 }
      }),
    [t]
  );

  async function handleCancel() {
    if (!active) return;
    setCancelLoading(true);
    try {
      const res = await cancelCustomerReservation(props.authToken, active.id);
      if (!res.ok) throw new Error("cancel_failed");
      await reload();
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleSaveEdit(patch: { dateLabel: string; quickDateId: string; timeLabel: string }) {
    if (!active) return;
    setSaveLoading(true);
    try {
      const res = await patchCustomerReservation(props.authToken, active.id, patch);
      if (!res.ok) {
        Alert.alert("Couldn't update", "Please pick a valid date and time.");
        throw new Error("patch_failed");
      }
      setReservations((prev) => prev.map((r) => (r.id === active.id ? res.reservation : r)));
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <>
      <ProfileScreenContainer topInset={props.topInset} bottomInset={props.bottomInset}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={t.ordersNavPurpleBright} />
          </View>
        ) : !active ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No upcoming reservations</Text>
            <Text style={styles.emptyBody}>Book a table from the Book tab and it will show up here.</Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.venue}>{active.restaurantName}</Text>
            <Text style={styles.meta}>
              {active.draft.guests} guest{active.draft.guests === 1 ? "" : "s"} · {active.draft.dateLabel} ·{" "}
              {active.draft.timeLabel}
            </Text>

            <ReservationCountdownRing
              startsAt={active.startsAt}
              windowStartAt={active.createdAt}
              size={300}
            />

            <Text style={styles.code}>{active.confirmationCode}</Text>

            {reservations.length > 1 ? (
              <View style={styles.pager}>
                {reservations.map((r, i) => (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      setActiveIndex(i);
                      void Haptics.selectionAsync();
                    }}
                    style={[styles.dot, i === activeIndex && styles.dotActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Reservation ${i + 1}`}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.btnRow}>
              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnManage, pressed && styles.btnPressed]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setManageOpen(true);
                }}
              >
                <Text style={styles.btnLabel}>Manage booking</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnDetails, pressed && styles.btnPressed]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  props.onOpenBookingDetails(active);
                }}
              >
                <Text style={styles.btnLabel}>Booking details</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ProfileScreenContainer>

      <ReservationManageModal
        visible={manageOpen}
        reservation={active}
        onClose={() => setManageOpen(false)}
        onCancel={handleCancel}
        onSaveEdit={handleSaveEdit}
        cancelLoading={cancelLoading}
        saveLoading={saveLoading}
      />
    </>
  );
}
