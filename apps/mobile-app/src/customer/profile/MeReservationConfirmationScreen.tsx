import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { buildBookRecapParts } from "../reservations/reservationBookRecap";
import {
  fetchCustomerReservation,
  type CustomerReservationApi
} from "../reservations/reservationApi";
import { useAppTheme } from "../../theme/AppThemeContext";
import { ReservationBookingRef } from "./ReservationBookingRef";
import { ProfileScreenContainer } from "./ProfileUi";

type Props = {
  authToken: string;
  reservationId: string;
  /** Optional snapshot while the server record loads. */
  initialReservation?: CustomerReservationApi;
  topInset: number;
  bottomInset: number;
};

export function MeReservationConfirmationScreen(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const [reservation, setReservation] = React.useState<CustomerReservationApi | null>(
    props.initialReservation ?? null
  );
  const [loading, setLoading] = React.useState(!props.initialReservation);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCustomerReservation(props.authToken, props.reservationId);
      if (res.ok) setReservation(res.reservation);
      else setReservation(null);
    } catch {
      setReservation(null);
    } finally {
      setLoading(false);
    }
  }, [props.authToken, props.reservationId]);

  React.useEffect(() => {
    if (props.initialReservation) setReservation(props.initialReservation);
    void reload();
  }, [reload, props.reservationId, props.initialReservation?.updatedAt]);

  const recapLine = React.useMemo(
    () => (reservation ? buildBookRecapParts(reservation.draft, 3).join(" · ") : ""),
    [reservation]
  );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: t.space.md, paddingVertical: 24 },
        center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
        card: {
          borderRadius: 24,
          borderWidth: 2,
          minHeight: 140,
          paddingHorizontal: 20,
          paddingVertical: 28,
          alignItems: "center",
          justifyContent: "center",
          borderColor: t.ordersNavPurpleBright,
          backgroundColor: isDark ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.94)"
        },
        emoji: { fontSize: 48, fontWeight: "800", color: t.success },
        venue: {
          marginTop: 12,
          fontSize: 22,
          fontWeight: "900",
          color: t.text,
          textAlign: "center"
        },
        summary: {
          marginTop: 10,
          fontSize: 15,
          fontWeight: "600",
          color: t.textSecondary,
          textAlign: "center",
          lineHeight: 22
        },
        status: {
          marginTop: 18,
          fontSize: 13,
          fontWeight: "800",
          color: t.ordersNavPurpleBright,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: `${t.ordersNavPurpleBright}22`
        },
        section: {
          marginTop: 28,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.bgElevated,
          padding: 16
        },
        rowLabel: { fontSize: 12, fontWeight: "800", color: t.textMuted, textTransform: "uppercase" },
        rowValue: { marginTop: 4, fontSize: 17, fontWeight: "800", color: t.text },
        empty: { fontSize: 16, fontWeight: "700", color: t.textMuted, textAlign: "center" }
      }),
    [t, isDark]
  );

  return (
    <ProfileScreenContainer topInset={props.topInset} bottomInset={props.bottomInset}>
      {loading && !reservation ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.ordersNavPurpleBright} />
        </View>
      ) : !reservation ? (
        <View style={styles.center}>
          <Text style={styles.empty}>This booking could not be loaded.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.emoji}>✓</Text>
            <ReservationBookingRef
              confirmationCode={reservation.confirmationCode}
              codeColor={t.text}
              style={{ marginTop: 10, marginBottom: 0 }}
              codeStyle={{ fontSize: 32, letterSpacing: 1.5 }}
            />
            <Text style={styles.venue}>{reservation.restaurantName}</Text>
            {recapLine ? <Text style={styles.summary}>{recapLine}</Text> : null}
            <Text style={styles.status}>
              {reservation.status === "CANCELLED" ? "Cancelled" : "Confirmed"}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.rowLabel}>Visit</Text>
            <Text style={styles.rowValue}>
              {reservation.draft.dateLabel} · {reservation.draft.timeLabel}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.rowLabel}>Party size</Text>
            <Text style={styles.rowValue}>
              {reservation.draft.guests} guest{reservation.draft.guests === 1 ? "" : "s"}
            </Text>
          </View>

          {reservation.draft.slotLabel ? (
            <View style={styles.section}>
              <Text style={styles.rowLabel}>Table</Text>
              <Text style={styles.rowValue}>{reservation.draft.slotLabel}</Text>
            </View>
          ) : null}

          {reservation.draft.restaurantNote?.trim() ? (
            <View style={styles.section}>
              <Text style={styles.rowLabel}>Note for venue</Text>
              <Text style={styles.rowValue}>{reservation.draft.restaurantNote.trim()}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </ProfileScreenContainer>
  );
}
