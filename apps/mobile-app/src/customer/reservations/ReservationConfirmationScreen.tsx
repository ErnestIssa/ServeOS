import * as Haptics from "expo-haptics";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ReservationManageModal } from "../profile/ReservationManageModal";
import { buildBookingConfirmationDetailRows } from "./bookingConfirmationDetails";
import {
  bookingScheduleErrorMessage,
  cancelCustomerReservation,
  patchCustomerReservation,
  type CustomerReservationApi
} from "./reservationApi";
import { ReservationBookingHelpLink } from "./ReservationBookingHelpLink";
import { ReservationBookStepShell } from "./ReservationBookStepShell";
import { immersiveShellPassThrough, type ReservationImmersiveShellProps } from "./reservationImmersiveShellProps";
import { useAppTheme } from "../../theme/AppThemeContext";
import type { ReservationDraft, ReservationFlowContext } from "./reservationTypes";

type Props = ReservationFlowContext &
  ReservationImmersiveShellProps & {
    draft: ReservationDraft;
    confirmationCode: string;
    reservation: CustomerReservationApi | null;
    authToken: string | null;
    onNeedHelp: () => void;
    onReservationUpdated: (reservation: CustomerReservationApi) => void;
    onReservationCancelled: () => void;
    onClose: () => void;
    manageLoading?: boolean;
    hasVenue: boolean;
  };

export function ReservationConfirmationScreen(props: Props) {
  const { colors: t } = useAppTheme();
  const { draft, confirmationCode, reservation } = props;
  const detailRows = React.useMemo(() => buildBookingConfirmationDetailRows(draft), [draft]);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [saveLoading, setSaveLoading] = React.useState(false);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        body: {
          alignItems: "center",
          paddingTop: 44,
          paddingBottom: 12
        },
        tick: {
          fontSize: 48,
          fontWeight: "800",
          color: t.success,
          lineHeight: 52
        },
        headline: {
          marginTop: 12,
          fontSize: 40,
          fontWeight: "700",
          letterSpacing: -0.6,
          lineHeight: 46,
          color: t.text,
          textAlign: "center"
        },
        code: {
          marginTop: 10,
          fontSize: 32,
          fontWeight: "900",
          letterSpacing: 1.5,
          color: t.text,
          textAlign: "center"
        },
        venue: {
          marginTop: 10,
          fontSize: 28,
          fontWeight: "900",
          letterSpacing: -0.5,
          color: t.text,
          textAlign: "center"
        },
        status: {
          marginTop: 14,
          fontSize: 13,
          fontWeight: "800",
          color: t.ordersNavPurpleBright,
          textAlign: "center"
        },
        detailBlock: {
          width: "100%",
          maxWidth: 420,
          marginTop: 28,
          alignSelf: "center"
        },
        rowLabel: {
          fontSize: 12,
          fontWeight: "800",
          letterSpacing: 0.35,
          textTransform: "uppercase",
          color: t.textMuted
        },
        rowValue: {
          marginTop: 6,
          fontSize: 17,
          fontWeight: "800",
          lineHeight: 24,
          color: t.text
        },
        rowGap: {
          marginTop: 20
        },
        manageBtn: {
          width: "100%",
          minHeight: 64,
          borderRadius: 20,
          borderWidth: 2,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          paddingVertical: 16,
          backgroundColor: t.accentBlue,
          borderColor: "#1D4ED8"
        },
        manageBtnPressed: {
          opacity: 0.88,
          transform: [{ scale: 0.98 }]
        },
        manageBtnLabel: {
          fontSize: 17,
          fontWeight: "900",
          color: "#FFFFFF",
          textAlign: "center"
        }
      }),
    [t]
  );

  async function handleCancel() {
    const token = props.authToken?.trim();
    const id = reservation?.id;
    if (!token || !id) {
      Alert.alert("Can't cancel", "This booking isn't available to cancel yet.");
      return;
    }
    setCancelLoading(true);
    try {
      const res = await cancelCustomerReservation(token, id);
      if (!res.ok) throw new Error("cancel_failed");
      setManageOpen(false);
      props.onReservationCancelled();
    } catch {
      Alert.alert("Couldn't cancel", "Please try again.");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleSaveEdit(patch: { dateLabel: string; quickDateId: string; timeLabel: string }) {
    const token = props.authToken?.trim();
    const id = reservation?.id;
    if (!token || !id) {
      return { ok: false as const, message: "Sign in to update your booking." };
    }
    setSaveLoading(true);
    try {
      const res = await patchCustomerReservation(token, id, patch);
      if (!res.ok) {
        return {
          ok: false as const,
          message: bookingScheduleErrorMessage(res.fields)
        };
      }
      props.onReservationUpdated(res.reservation);
      setManageOpen(false);
      return {
        ok: true as const,
        dateLabel: res.reservation.draft.dateLabel,
        timeLabel: res.reservation.draft.timeLabel
      };
    } catch {
      return { ok: false as const, message: "Something went wrong. Please try again." };
    } finally {
      setSaveLoading(false);
    }
  }

  const openManage = React.useCallback(() => {
    if (!reservation) {
      Alert.alert("Booking not ready", "Your reservation is still syncing. Try again in a moment.");
      return;
    }
    void Haptics.selectionAsync();
    setManageOpen(true);
  }, [reservation]);

  return (
    <>
      <ReservationBookStepShell
        {...immersiveShellPassThrough(props)}
        cardOverlayClose
        onClose={props.onClose}
        draft={draft}
        onDraftChange={() => {}}
        hasVenue={props.hasVenue}
        sectionTitle=""
        footerLabel="Manage Reservation"
        footerLoading={props.manageLoading}
        onFooterPress={openManage}
        footer={
          <Pressable
            style={({ pressed }) => [styles.manageBtn, pressed && styles.manageBtnPressed]}
            onPress={openManage}
            disabled={props.manageLoading}
            accessibilityRole="button"
            accessibilityLabel="Manage Reservation"
          >
            <Text style={styles.manageBtnLabel}>Manage Reservation</Text>
          </Pressable>
        }
      >
        <View style={styles.body}>
          <Text style={styles.tick}>✓</Text>
          <Text style={styles.headline}>You're booked</Text>
          <Text style={styles.code}>{confirmationCode}</Text>
          <Text style={styles.venue}>{props.restaurantName.trim() || "Your restaurant"}</Text>
          <Text style={styles.status}>Confirmed</Text>

          <View style={styles.detailBlock}>
            {detailRows.map((row, index) => (
              <View key={row.label} style={index > 0 ? styles.rowGap : undefined}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <ReservationBookingHelpLink onPress={props.onNeedHelp} />
        </View>
      </ReservationBookStepShell>

      <ReservationManageModal
        visible={manageOpen}
        authToken={props.authToken?.trim() ?? ""}
        reservation={reservation}
        onClose={() => setManageOpen(false)}
        onCancel={handleCancel}
        onSaveEdit={handleSaveEdit}
        cancelLoading={cancelLoading}
        saveLoading={saveLoading}
      />
    </>
  );
}
