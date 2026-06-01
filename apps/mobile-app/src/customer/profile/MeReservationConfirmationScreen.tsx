import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { buildBookRecapParts } from "../reservations/reservationBookRecap";
import type { CustomerReservationApi } from "../reservations/reservationApi";
import { useAppTheme } from "../../theme/AppThemeContext";
import { ProfileScreenContainer } from "./ProfileUi";

type Props = {
  reservation: CustomerReservationApi;
  topInset: number;
  bottomInset: number;
};

export function MeReservationConfirmationScreen(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const { reservation } = props;
  const recapLine = React.useMemo(
    () => buildBookRecapParts(reservation.draft, 3).join(" · "),
    [reservation.draft]
  );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: t.space.md, paddingVertical: 24 },
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
        code: {
          fontSize: 32,
          fontWeight: "900",
          letterSpacing: 1.5,
          marginTop: 10,
          color: t.text
        },
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
        rowValue: { marginTop: 4, fontSize: 17, fontWeight: "800", color: t.text }
      }),
    [t, isDark]
  );

  return (
    <ProfileScreenContainer topInset={props.topInset} bottomInset={props.bottomInset}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.emoji}>✓</Text>
          <Text style={styles.code}>{reservation.confirmationCode}</Text>
          <Text style={styles.venue}>{reservation.restaurantName}</Text>
          {recapLine ? <Text style={styles.summary}>{recapLine}</Text> : null}
          <Text style={styles.status}>Confirmed</Text>
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
    </ProfileScreenContainer>
  );
}
