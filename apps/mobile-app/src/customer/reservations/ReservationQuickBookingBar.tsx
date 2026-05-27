import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { defaultBookingTimeLabel } from "./reservationDefaults";
import { GUEST_COUNTS, TIME_OPTIONS } from "./reservationPresets";
import { buildQuickDateOptions, quickDateIdFromLabel } from "./reservationQuickDates";
import { VerticalSnapWheel, WHEEL_VIEW_HEIGHT, type WheelOption } from "./VerticalSnapWheel";
import { useAppTheme } from "../../theme/AppThemeContext";

type Props = {
  guests: number;
  dateLabel: string;
  timeLabel: string;
  onGuestsChange: (guests: number) => void;
  onDateChange: (dateLabel: string) => void;
  onTimeChange: (timeLabel: string) => void;
  onReserve: () => void;
  disabled?: boolean;
};

/** Guest count for display/commit — never below 1. */
function safeGuestCount(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/** 1 → "1 Guest", 2+ → "2 Guests", 8+ → "8+ Guests". */
function guestWheelLabel(n: number): string {
  const safe = safeGuestCount(n);
  const num = safe >= 8 ? "8+" : String(safe);
  return safe === 1 ? `${num} Guest` : `${num} Guests`;
}

const GUEST_OPTIONS: WheelOption[] = GUEST_COUNTS.map((n) => ({
  id: n === 8 ? "8plus" : String(n),
  label: guestWheelLabel(n)
}));

function guestIndexFromValue(n: number): number {
  const safe = safeGuestCount(n);
  const exact = GUEST_COUNTS.indexOf(safe as (typeof GUEST_COUNTS)[number]);
  if (exact >= 0) return exact;
  let best = 0;
  for (let i = 0; i < GUEST_COUNTS.length; i++) {
    if (GUEST_COUNTS[i]! <= safe) best = i;
  }
  return best;
}

function timeIndexFromLabel(label: string): number {
  const i = TIME_OPTIONS.findIndex((t) => t.label === label);
  if (i >= 0) return i;
  const fallback = defaultBookingTimeLabel(null);
  return Math.max(0, TIME_OPTIONS.findIndex((t) => t.label === fallback));
}

function ReservationQuickBookingBarInner(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const dateOptions = React.useMemo(() => buildQuickDateOptions(10), []);
  const dateWheelOptions = React.useMemo<WheelOption[]>(
    () =>
      dateOptions.map((d) => ({
        id: d.id,
        label: d.label,
        sublabel: d.sublabel
      })),
    [dateOptions]
  );
  const timeOptions = React.useMemo<WheelOption[]>(
    () => TIME_OPTIONS.map((opt) => ({ id: opt.id, label: opt.label, sublabel: opt.sublabel })),
    []
  );

  const dateIndex = React.useMemo(() => {
    const id = quickDateIdFromLabel(dateOptions, props.dateLabel);
    const i = dateOptions.findIndex((o) => o.id === id);
    return i >= 0 ? i : 0;
  }, [dateOptions, props.dateLabel]);

  const guestIndex = guestIndexFromValue(props.guests);
  const timeIndex = timeIndexFromLabel(props.timeLabel);

  const tint = isDark ? "dark" : "light";
  const androidGlass = isDark ? "rgba(11,18,32,0.52)" : "rgba(248,250,252,0.52)";

  const onGuestsIndex = React.useCallback(
    (i: number) => {
      const n = safeGuestCount(GUEST_COUNTS[i] ?? 2);
      if (n !== safeGuestCount(props.guests)) props.onGuestsChange(n);
    },
    [props.guests, props.onGuestsChange]
  );

  const onDateIndex = React.useCallback(
    (i: number) => {
      const opt = dateOptions[i];
      if (opt && opt.dateLabel !== props.dateLabel) props.onDateChange(opt.dateLabel);
    },
    [dateOptions, props.dateLabel, props.onDateChange]
  );

  const onTimeIndex = React.useCallback(
    (i: number) => {
      const opt = TIME_OPTIONS[i];
      if (opt && opt.label !== props.timeLabel) props.onTimeChange(opt.label);
    },
    [props.timeLabel, props.onTimeChange]
  );

  return (
    <View style={styles.outer} collapsable={false}>
      <View
        style={[
          styles.card,
          {
            borderColor: t.ordersNavPurpleBright,
            shadowColor: isDark ? "#000" : "#4C1D95"
          }
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={30} tint={tint} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: androidGlass }]} />
        )}
        <LinearGradient
          colors={
            isDark
              ? ["rgba(11,18,32,0.20)", "rgba(11,18,32,0.00)"]
              : ["rgba(248,250,252,0.20)", "rgba(248,250,252,0.00)"]
          }
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.row} collapsable={false}>
          <View style={styles.wheelCol}>
            <VerticalSnapWheel
              accessibilityLabel="Guests"
              options={GUEST_OPTIONS}
              selectedIndex={guestIndex}
              disabled={props.disabled}
              isDark={isDark}
              accentColor={t.ordersNavPurpleBright}
              textColor={t.textMuted}
              onIndexChange={onGuestsIndex}
            />
          </View>

          <View style={[styles.wheelCol, styles.wheelColWide]}>
            <VerticalSnapWheel
              accessibilityLabel="Date"
              options={dateWheelOptions}
              selectedIndex={dateIndex}
              disabled={props.disabled}
              isDark={isDark}
              accentColor={t.ordersNavPurpleBright}
              textColor={t.textMuted}
              onIndexChange={onDateIndex}
            />
          </View>

          <View style={styles.wheelCol}>
            <VerticalSnapWheel
              accessibilityLabel="Time"
              options={timeOptions}
              selectedIndex={timeIndex}
              disabled={props.disabled}
              isDark={isDark}
              accentColor={t.ordersNavPurpleBright}
              textColor={t.textMuted}
              onIndexChange={onTimeIndex}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reserve"
            disabled={props.disabled}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              props.onReserve();
            }}
            style={({ pressed }) => [
              styles.reserveBtn,
              props.disabled && styles.reserveDisabled,
              pressed && styles.pressed
            ]}
          >
            <LinearGradient
              colors={[t.ordersNavPurpleBright, t.ordersNavPurple]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.reserveGradient}
            >
              <Text style={styles.reserveText}>Reserve</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export const ReservationQuickBookingBar = React.memo(ReservationQuickBookingBarInner);

const BAR_HEIGHT = WHEEL_VIEW_HEIGHT + 12;

const styles = StyleSheet.create({
  outer: {
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 2,
    zIndex: 10
  },
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20
      },
      android: { elevation: 10 },
      default: {}
    })
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
    minHeight: BAR_HEIGHT
  },
  wheelCol: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  wheelColWide: {
    flex: 1.15
  },
  reserveBtn: {
    width: 78,
    height: WHEEL_VIEW_HEIGHT,
    borderRadius: 14,
    overflow: "hidden",
    flexShrink: 0,
    marginLeft: 6
  },
  reserveDisabled: { opacity: 0.45 },
  reserveGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  reserveText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }]
  }
});
