import React from "react";

/** Mobile booking bar — keeps parent sheet scroll in sync without stuck locks. */
export function useBookingBarScrollLock(onLockChange?: (locked: boolean) => void) {
  const slotsRef = React.useRef({ guests: false, date: false, time: false });
  const lockTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = React.useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const publish = React.useCallback(() => {
    if (!onLockChange) return;
    const locked = slotsRef.current.guests || slotsRef.current.date || slotsRef.current.time;
    onLockChange(locked);
  }, [onLockChange]);

  const forceUnlock = React.useCallback(() => {
    slotsRef.current = { guests: false, date: false, time: false };
    clearTimers();
    onLockChange?.(false);
  }, [clearTimers, onLockChange]);

  const setSlotActive = React.useCallback(
    (slot: "guests" | "date" | "time", active: boolean) => {
      slotsRef.current[slot] = active;

      if (active) {
        if (lockTimerRef.current) {
          clearTimeout(lockTimerRef.current);
          lockTimerRef.current = null;
        }
        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = setTimeout(forceUnlock, 900);
        publish();
        return;
      }

      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        lockTimerRef.current = null;
        publish();
      }, 32);

      if (!slotsRef.current.guests && !slotsRef.current.date && !slotsRef.current.time) {
        if (safetyTimerRef.current) {
          clearTimeout(safetyTimerRef.current);
          safetyTimerRef.current = null;
        }
      }
    },
    [forceUnlock, publish]
  );

  React.useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    onGuestsDrag: React.useCallback((active: boolean) => setSlotActive("guests", active), [setSlotActive]),
    onDateDrag: React.useCallback((active: boolean) => setSlotActive("date", active), [setSlotActive]),
    onTimeDrag: React.useCallback((active: boolean) => setSlotActive("time", active), [setSlotActive]),
    forceUnlock
  };
}
