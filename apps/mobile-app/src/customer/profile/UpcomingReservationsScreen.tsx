import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import {
  cancelCustomerReservation,
  fetchUpcomingReservations,
  patchCustomerReservation,
  scheduleFieldErrorMessage,
  type CustomerReservationApi
} from "../reservations/reservationApi";
import { ReservationBookingRef } from "./ReservationBookingRef";
import { ReservationCountdownRing } from "./ReservationCountdownRing";
import { ReservationManageModal } from "./ReservationManageModal";

type Props = {
  authToken: string;
  topInset: number;
  bottomInset: number;
  onOpenBookingDetails: (reservation: CustomerReservationApi) => void;
  /** Keeps booking details route in sync after manage-booking actions. */
  onReservationUpdated?: (reservation: CustomerReservationApi) => void;
};

function ReservationPage({
  reservation,
  pageWidth,
  styles,
  codeColor
}: {
  reservation: CustomerReservationApi;
  pageWidth: number;
  styles: ReturnType<typeof StyleSheet.create>;
  codeColor: string;
}) {
  return (
    <View style={[styles.page, { width: pageWidth }]}>
      <Text style={styles.venue}>{reservation.restaurantName}</Text>
      <Text style={styles.meta}>
        {reservation.draft.guests} guest{reservation.draft.guests === 1 ? "" : "s"} · {reservation.draft.dateLabel} ·{" "}
        {reservation.draft.timeLabel}
      </Text>

      <ReservationCountdownRing
        startsAt={reservation.startsAt}
        createdAt={reservation.createdAt}
        size={300}
      />

      <ReservationBookingRef confirmationCode={reservation.confirmationCode} codeColor={codeColor} />
    </View>
  );
}

export function UpcomingReservationsScreen(props: Props) {
  const { colors: t } = useAppTheme();
  const { width: windowW } = useWindowDimensions();
  const [loading, setLoading] = React.useState(true);
  const [reservations, setReservations] = React.useState<CustomerReservationApi[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [pageWidth, setPageWidth] = React.useState(Math.max(320, windowW));
  const [manageOpen, setManageOpen] = React.useState(false);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [saveLoading, setSaveLoading] = React.useState(false);
  const listRef = React.useRef<FlatList<CustomerReservationApi>>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUpcomingReservations(props.authToken);
      if (res.ok) {
        setReservations(res.reservations);
        setActiveIndex((prev) => Math.min(prev, Math.max(0, res.reservations.length - 1)));
      } else {
        setReservations([]);
        setActiveIndex(0);
      }
    } catch {
      setReservations([]);
      setActiveIndex(0);
    } finally {
      setLoading(false);
    }
  }, [props.authToken]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  /** Swiped to another booking — close manage so actions always target the visible reservation. */
  React.useEffect(() => {
    setManageOpen(false);
  }, [activeIndex]);

  const active = reservations[activeIndex] ?? null;
  const hasMultiple = reservations.length > 1;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        shell: {
          flex: 1,
          paddingHorizontal: t.space.sm
        },
        flex: { flex: 1 },
        center: {
          flex: 1,
          alignItems: "center",
          paddingHorizontal: t.space.md,
          paddingBottom: 24
        },
        centerInner: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          width: "100%"
        },
        carouselHost: {
          flex: 1
        },
        carouselContent: {
          flexGrow: 1,
          justifyContent: "center"
        },
        page: {
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: t.space.md,
          paddingVertical: 8
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
          marginBottom: 20
        },
        footer: {
          width: "100%",
          maxWidth: 420,
          alignSelf: "center",
          paddingTop: 8
        },
        btnRow: {
          flexDirection: "row",
          gap: 12,
          marginTop: 14,
          width: "100%"
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
        dotsRow: {
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          marginBottom: 4
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: `${t.textMuted}44`
        },
        dotActive: {
          width: 22,
          backgroundColor: t.ordersNavPurpleBright
        }
      }),
    [t]
  );

  const onScrollSettled = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / Math.max(pageWidth, 1));
      const clamped = Math.max(0, Math.min(reservations.length - 1, idx));
      if (clamped !== activeIndex) {
        setActiveIndex(clamped);
        void Haptics.selectionAsync();
      }
    },
    [activeIndex, pageWidth, reservations.length]
  );

  async function handleCancel() {
    if (!active) return;
    setCancelLoading(true);
    try {
      const res = await cancelCustomerReservation(props.authToken, active.id);
      if (!res.ok) throw new Error("cancel_failed");
      setManageOpen(false);
      props.onReservationUpdated?.(res.reservation);
      await reload();
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleSaveEdit(patch: { dateLabel: string; quickDateId: string; timeLabel: string }) {
    if (!active) return { ok: false as const, message: "No booking selected." };
    setSaveLoading(true);
    try {
      const res = await patchCustomerReservation(props.authToken, active.id, patch);
      if (!res.ok) {
        return { ok: false as const, message: scheduleFieldErrorMessage(res.fields) };
      }
      props.onReservationUpdated?.(res.reservation);
      await reload();
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

  return (
    <>
      <View
        style={[
          styles.shell,
          { paddingTop: props.topInset > 0 ? props.topInset : 8, paddingBottom: props.bottomInset + 24 }
        ]}
      >
        {loading ? (
          <View style={styles.center}>
            <View style={styles.centerInner}>
              <ActivityIndicator size="large" color={t.ordersNavPurpleBright} />
            </View>
          </View>
        ) : !active ? (
          <View style={styles.center}>
            <View style={styles.centerInner}>
              <Text style={styles.emptyTitle}>No upcoming reservations</Text>
              <Text style={styles.emptyBody}>Book a table from the Book tab and it will show up here.</Text>
            </View>
          </View>
        ) : (
          <View
            style={styles.flex}
            onLayout={(e) => {
              const w = Math.ceil(e.nativeEvent.layout.width);
              if (w > 0 && w !== pageWidth) setPageWidth(w);
            }}
          >
            <FlatList
              ref={listRef}
              data={reservations}
              horizontal
              pagingEnabled
              bounces={hasMultiple}
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              scrollEventThrottle={16}
              keyExtractor={(item) => item.id}
              getItemLayout={(_, index) => ({
                length: pageWidth,
                offset: pageWidth * index,
                index
              })}
              onMomentumScrollEnd={onScrollSettled}
              onScrollEndDrag={onScrollSettled}
              contentContainerStyle={styles.carouselContent}
              renderItem={({ item }) => (
                <ReservationPage
                  reservation={item}
                  pageWidth={pageWidth}
                  styles={styles}
                  codeColor={t.ordersNavPurpleBright}
                />
              )}
              style={styles.carouselHost}
            />

            <View style={styles.footer}>
              {hasMultiple ? (
                <View style={styles.dotsRow}>
                  {reservations.map((r, i) => (
                    <Pressable
                      key={r.id}
                      onPress={() => {
                        listRef.current?.scrollToIndex({ index: i, animated: true });
                        setActiveIndex(i);
                        void Haptics.selectionAsync();
                      }}
                      style={[styles.dot, i === activeIndex && styles.dotActive]}
                      accessibilityRole="button"
                      accessibilityLabel={`Booking ${i + 1}`}
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
          </View>
        )}
      </View>

      <ReservationManageModal
        visible={manageOpen}
        authToken={props.authToken}
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
