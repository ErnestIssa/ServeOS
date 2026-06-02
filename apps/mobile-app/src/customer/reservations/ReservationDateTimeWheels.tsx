import React from "react";
import { StyleSheet, View } from "react-native";
import { TIME_OPTIONS } from "./reservationPresets";
import { buildQuickDateOptions, quickDateIdFromLabel } from "./reservationQuickDates";
import { VerticalSnapWheel, WHEEL_VIEW_HEIGHT, type WheelOption } from "./VerticalSnapWheel";
import { useAppTheme } from "../../theme/AppThemeContext";

export type ReservationWheelDateOption = {
  id: string;
  label: string;
  dateLabel: string;
  sublabel?: string;
};

type Props = {
  dateLabel: string;
  timeLabel: string;
  /** Server-filtered time labels (only pass available ones). */
  availableTimeLabels: readonly string[];
  /** Quick-date ids that still have at least one bookable slot (from slot-picker API). */
  bookableDateIds?: readonly string[];
  /** When editing, use API date rows (includes visit day outside d0–d9). */
  serverDateOptions?: readonly ReservationWheelDateOption[];
  onDateChange: (dateLabel: string, quickDateId: string) => void;
  onTimeChange: (timeLabel: string) => void;
  disabled?: boolean;
};

export function ReservationDateTimeWheels(props: Props) {
  const { colors: t, isDark } = useAppTheme();
  const dateOptions = React.useMemo(
    () =>
      props.serverDateOptions?.length
        ? props.serverDateOptions.map((d) => ({
            id: d.id,
            label: d.label,
            dateLabel: d.dateLabel,
            sublabel: d.sublabel
          }))
        : buildQuickDateOptions(10),
    [props.serverDateOptions]
  );

  const dateWheelOptions = React.useMemo<WheelOption[]>(() => {
    const bookable = props.bookableDateIds?.length
      ? new Set(props.bookableDateIds)
      : null;
    return dateOptions
      .filter((d) => !bookable || bookable.has(d.id))
      .map((d) => ({
        id: d.id,
        label: d.label,
        sublabel: d.sublabel
      }));
  }, [dateOptions, props.bookableDateIds]);

  const timeWheelOptions = React.useMemo<WheelOption[]>(() => {
    const set = new Set(props.availableTimeLabels);
    return TIME_OPTIONS.filter((opt) => set.has(opt.label)).map((opt) => ({
      id: opt.id,
      label: opt.label,
      sublabel: opt.sublabel
    }));
  }, [props.availableTimeLabels]);

  const dateIndex = React.useMemo(() => {
    const id = quickDateIdFromLabel(dateOptions, props.dateLabel);
    const i = dateWheelOptions.findIndex((o) => o.id === id);
    return i >= 0 ? i : 0;
  }, [dateOptions, dateWheelOptions, props.dateLabel]);

  const timeIndex = React.useMemo(() => {
    const i = timeWheelOptions.findIndex((o) => o.label === props.timeLabel);
    return i >= 0 ? i : 0;
  }, [timeWheelOptions, props.timeLabel]);

  const onDateIndex = React.useCallback(
    (i: number) => {
      const wheel = dateWheelOptions[i];
      const src = dateOptions.find((d) => d.id === wheel?.id);
      if (src && src.dateLabel !== props.dateLabel) props.onDateChange(src.dateLabel, src.id);
    },
    [dateOptions, dateWheelOptions, props.onDateChange]
  );

  const onTimeIndex = React.useCallback(
    (i: number) => {
      const opt = timeWheelOptions[i];
      if (opt) props.onTimeChange(opt.label);
    },
    [props.onTimeChange, timeWheelOptions]
  );

  return (
    <View style={styles.row}>
      <View style={[styles.col, styles.colWide]}>
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
      <View style={styles.col}>
        <VerticalSnapWheel
          accessibilityLabel="Time"
          options={timeWheelOptions.length > 0 ? timeWheelOptions : [{ id: "—", label: "—" }]}
          selectedIndex={timeWheelOptions.length > 0 ? timeIndex : 0}
          disabled={props.disabled || timeWheelOptions.length === 0}
          isDark={isDark}
          accentColor={t.ordersNavPurpleBright}
          textColor={t.textMuted}
          onIndexChange={onTimeIndex}
        />
      </View>
    </View>
  );
}

export const RESERVATION_WHEEL_ROW_HEIGHT = WHEEL_VIEW_HEIGHT + 8;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: RESERVATION_WHEEL_ROW_HEIGHT,
    paddingVertical: 4
  },
  col: {
    flex: 1,
    minWidth: 0,
    alignItems: "center"
  },
  colWide: {
    flex: 1.15
  }
});
