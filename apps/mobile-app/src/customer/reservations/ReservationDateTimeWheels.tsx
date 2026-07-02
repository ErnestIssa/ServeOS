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

export type ReservationWheelSelection = {
  dateLabel: string;
  quickDateId: string;
  timeLabel: string;
};

export type ReservationDateTimeWheelsHandle = {
  getSelection: () => ReservationWheelSelection | null;
};

type Props = {
  dateLabel: string;
  timeLabel: string;
  availableTimeLabels: readonly string[];
  bookableDateIds?: readonly string[];
  serverDateOptions?: readonly ReservationWheelDateOption[];
  onDateChange: (dateLabel: string, quickDateId: string) => void;
  onTimeChange: (timeLabel: string) => void;
  disabled?: boolean;
  /**
   * Edit flow: wheels keep their own index while scrolling.
   * Parent reads `getSelection()` only on Save — scroll is not a commitment.
   */
  draftMode?: boolean;
  initialSelection?: ReservationWheelSelection | null;
  seedKey?: number;
  /** Draft mode: swap time column options when date wheel moves (no commit). */
  onDatePreview?: (dateLabel: string, quickDateId: string) => void;
  /** Draft mode: paired times per date id (every listed date has ≥1 time). */
  timesByDateId?: Readonly<Record<string, readonly string[]>>;
};

function indexForDate(
  dateOptions: readonly { id: string; dateLabel: string }[],
  dateWheelOptions: readonly WheelOption[],
  dateLabel: string,
  quickDateId: string
) {
  const id = quickDateId || quickDateIdFromLabel(dateOptions, dateLabel);
  const i = dateWheelOptions.findIndex((o) => o.id === id);
  return i >= 0 ? i : 0;
}

function indexForTime(timeWheelOptions: readonly WheelOption[], timeLabel: string) {
  const i = timeWheelOptions.findIndex((o) => o.label === timeLabel);
  return i >= 0 ? i : 0;
}

function selectionFromIndices(
  dateOptions: readonly { id: string; dateLabel: string }[],
  dateWheelOptions: readonly WheelOption[],
  timeWheelOptions: readonly WheelOption[],
  dateIdx: number,
  timeIdx: number
): ReservationWheelSelection | null {
  const wheel = dateWheelOptions[dateIdx];
  const src = dateOptions.find((d) => d.id === wheel?.id);
  const time = timeWheelOptions[timeIdx];
  if (!src || !time?.label || time.label === "—") return null;
  return { dateLabel: src.dateLabel, quickDateId: src.id, timeLabel: time.label };
}

const ReservationDateTimeWheelsInner = React.forwardRef<ReservationDateTimeWheelsHandle, Props>(
  function ReservationDateTimeWheelsInner(props, ref) {
    const { colors: t } = useAppTheme();
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
      const bookable = props.bookableDateIds?.length ? new Set(props.bookableDateIds) : null;
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

    const [dateIdx, setDateIdx] = React.useState(0);
    const [timeIdx, setTimeIdx] = React.useState(0);

    React.useEffect(() => {
      if (!props.draftMode || !props.initialSelection) return;
      const dIdx = indexForDate(
        dateOptions,
        dateWheelOptions,
        props.initialSelection.dateLabel,
        props.initialSelection.quickDateId
      );
      setDateIdx(dIdx);
      const times =
        props.timesByDateId?.[props.initialSelection.quickDateId] ?? props.availableTimeLabels;
      const tIdx = indexForTime(
        TIME_OPTIONS.filter((opt) => times.includes(opt.label)).map((opt) => ({
          id: opt.id,
          label: opt.label
        })),
        props.initialSelection.timeLabel
      );
      setTimeIdx(tIdx);
    }, [
      props.seedKey,
      props.draftMode,
      props.initialSelection,
      props.availableTimeLabels,
      props.timesByDateId,
      dateOptions,
      dateWheelOptions
    ]);

    React.useEffect(() => {
      if (!props.draftMode) return;
      if (timeWheelOptions.length === 0) return;
      setTimeIdx((prev) => Math.min(prev, Math.max(0, timeWheelOptions.length - 1)));
    }, [props.draftMode, timeWheelOptions.length, props.availableTimeLabels]);

    React.useImperativeHandle(
      ref,
      () => ({
        getSelection: () => selectionFromIndices(dateOptions, dateWheelOptions, timeWheelOptions, dateIdx, timeIdx)
      }),
      [dateIdx, timeIdx, dateOptions, dateWheelOptions, timeWheelOptions]
    );

    const controlledDateIndex = React.useMemo(() => {
      const id = quickDateIdFromLabel(dateOptions, props.dateLabel);
      const i = dateWheelOptions.findIndex((o) => o.id === id);
      return i >= 0 ? i : 0;
    }, [dateOptions, dateWheelOptions, props.dateLabel]);

    const controlledTimeIndex = React.useMemo(
      () => indexForTime(timeWheelOptions, props.timeLabel),
      [timeWheelOptions, props.timeLabel]
    );

    const onDateIndex = React.useCallback(
      (i: number) => {
        const wheel = dateWheelOptions[i];
        const src = dateOptions.find((d) => d.id === wheel?.id);
        if (!src) return;
        if (props.draftMode) {
          const map = props.timesByDateId;
          let targetIdx = i;
          let targetSrc = src;
          if (map && !(map[src.id]?.length ?? 0)) {
            const found = dateWheelOptions.findIndex((w) => (map[w.id]?.length ?? 0) > 0);
            if (found < 0) return;
            targetIdx = found;
            const alt = dateOptions.find((d) => d.id === dateWheelOptions[found]?.id);
            if (!alt) return;
            targetSrc = alt;
          }
          setDateIdx(targetIdx);
          setTimeIdx(0);
          props.onDatePreview?.(targetSrc.dateLabel, targetSrc.id);
          return;
        }
        if (src.dateLabel !== props.dateLabel) props.onDateChange(src.dateLabel, src.id);
      },
      [dateOptions, dateWheelOptions, props]
    );

    const onTimeIndex = React.useCallback(
      (i: number) => {
        if (props.draftMode) {
          setTimeIdx(i);
          return;
        }
        const opt = timeWheelOptions[i];
        if (opt) props.onTimeChange(opt.label);
      },
      [props, timeWheelOptions]
    );

    const dateIndex = props.draftMode ? dateIdx : controlledDateIndex;
    const timeIndex = props.draftMode ? timeIdx : controlledTimeIndex;

    return (
      <View style={styles.row}>
        <View style={[styles.col, styles.colWide]}>
          <VerticalSnapWheel
            accessibilityLabel="Date"
            options={dateWheelOptions}
            selectedIndex={dateIndex}
            disabled={props.disabled}
            accentColor={t.ordersNavPurpleBright}
            textColor={t.textMuted}
            onIndexChange={onDateIndex}
          />
        </View>
        <View style={styles.col}>
          <VerticalSnapWheel
            accessibilityLabel="Time"
            options={
              timeWheelOptions.length > 0
                ? timeWheelOptions
                : [{ id: "pending", label: "…", sublabel: "Pick a date" }]
            }
            selectedIndex={timeWheelOptions.length > 0 ? timeIndex : 0}
            disabled={props.disabled}
            accentColor={t.ordersNavPurpleBright}
            textColor={t.textMuted}
            onIndexChange={onTimeIndex}
          />
        </View>
      </View>
    );
  }
);

export const ReservationDateTimeWheels = ReservationDateTimeWheelsInner;

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
