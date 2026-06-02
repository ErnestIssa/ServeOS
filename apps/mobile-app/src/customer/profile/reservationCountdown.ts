export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
};

/** Matches backend `upcomingReservationWhere` grace (2h after `startsAt`). */
export const RESERVATION_VISIT_GRACE_MS = 2 * 60 * 60 * 1000;

export type ReservationVisitPhase = "upcoming" | "now" | "past";

export function reservationVisitPhase(startsAtIso: string, nowMs = Date.now()): ReservationVisitPhase {
  const startsAtMs = new Date(startsAtIso).getTime();
  if (!Number.isFinite(startsAtMs)) return "past";
  const remainingMs = startsAtMs - nowMs;
  if (remainingMs > 0) return "upcoming";
  if (remainingMs > -RESERVATION_VISIT_GRACE_MS) return "now";
  return "past";
}

/** Whole-period fill ratio (0 = just booked, 1 = visit time). Uses server `createdAt` → `startsAt`. */
export function countdownFillProgress(
  nowMs: number,
  startsAtMs: number,
  windowStartMs: number
): number {
  const totalMs = Math.max(startsAtMs - windowStartMs, 60_000);
  const elapsedMs = nowMs - windowStartMs;
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= totalMs) return 1;
  return elapsedMs / totalMs;
}

export function splitCountdownRemaining(ms: number): CountdownParts {
  const totalMin = Math.max(0, Math.ceil(ms / 60_000));
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  return { days, hours, minutes };
}

export function padCountdownUnit(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatReservationVisitTime(startsAtIso: string): string {
  const d = new Date(startsAtIso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function reservationVisitHeadline(phase: ReservationVisitPhase): string {
  switch (phase) {
    case "now":
      return "Your reservation is now";
    case "past":
      return "Reservation was";
    default:
      return "";
  }
}
