import React from "react";
import { fetchReservationSlotPicker, type ReservationSlotPicker } from "./reservationApi";

type Params = {
  authToken: string | null | undefined;
  restaurantId: string | null | undefined;
  quickDateId: string | null | undefined;
  dateLabel: string;
  timeLabel: string;
  enabled?: boolean;
  /** When the API normalizes date/time (e.g. past slot), push into draft. */
  onResolved?: (patch: { dateLabel: string; quickDateId: string; timeLabel: string }) => void;
};

function scheduleMatches(
  res: ReservationSlotPicker,
  params: Pick<Params, "dateLabel" | "quickDateId" | "timeLabel">
) {
  return (
    res.dateLabel === params.dateLabel &&
    res.quickDateId === (params.quickDateId ?? res.quickDateId) &&
    res.timeLabel === params.timeLabel
  );
}

export function useReservationSlotPicker(params: Params) {
  const { authToken, restaurantId, enabled = true, onResolved } = params;
  const [availableTimeLabels, setAvailableTimeLabels] = React.useState<string[]>([]);
  const [bookableDateIds, setBookableDateIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const onResolvedRef = React.useRef(onResolved);
  onResolvedRef.current = onResolved;

  const scheduleRef = React.useRef({
    dateLabel: params.dateLabel,
    quickDateId: params.quickDateId,
    timeLabel: params.timeLabel
  });
  scheduleRef.current = {
    dateLabel: params.dateLabel,
    quickDateId: params.quickDateId,
    timeLabel: params.timeLabel
  };

  const applyPicker = React.useCallback((res: ReservationSlotPicker, notify: boolean) => {
    setAvailableTimeLabels(res.timeOptions.filter((t) => t.available).map((t) => t.label));
    setBookableDateIds(res.dateOptions.filter((d) => d.hasAvailableSlots !== false).map((d) => d.id));
    if (notify && onResolvedRef.current && !scheduleMatches(res, scheduleRef.current)) {
      onResolvedRef.current({
        dateLabel: res.dateLabel,
        quickDateId: res.quickDateId,
        timeLabel: res.timeLabel
      });
    }
  }, []);

  const load = React.useCallback(
    async (query: { quickDateId?: string | null; dateLabel?: string; timeLabel?: string }, notify = false) => {
      if (!enabled || !authToken?.trim() || !restaurantId?.trim()) {
        setAvailableTimeLabels([]);
        setBookableDateIds([]);
        return null;
      }
      setLoading(true);
      try {
        const res = await fetchReservationSlotPicker(authToken, restaurantId, query);
        if (!res.ok) {
          setAvailableTimeLabels([]);
          setBookableDateIds([]);
          return null;
        }
        applyPicker(res, notify);
        return res;
      } catch {
        setAvailableTimeLabels([]);
        setBookableDateIds([]);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [applyPicker, authToken, restaurantId, enabled]
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await load(
        {
          quickDateId: params.quickDateId,
          dateLabel: params.dateLabel,
          timeLabel: params.timeLabel
        },
        true
      );
      if (cancelled || !res) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load, params.quickDateId, params.dateLabel, params.timeLabel]);

  const pickDate = React.useCallback(
    async (dateLabel: string, quickDateId: string) => {
      const res = await load({ quickDateId, dateLabel, timeLabel: params.timeLabel }, true);
      if (!res) return null;
      return {
        dateLabel: res.dateLabel,
        quickDateId: res.quickDateId,
        timeLabel: res.timeLabel
      };
    },
    [load, params.timeLabel]
  );

  return {
    availableTimeLabels,
    bookableDateIds,
    loading,
    pickDate
  };
}
