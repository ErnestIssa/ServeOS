import type { CustomerReservation, PrismaClient } from "@prisma/client";
import { buildQuickDateOptions, resolveQuickDateId } from "./reservationPresets.js";
import { validateReservationStartInput, type ReservationStartValidated } from "./reservationStartValidation.js";

export type ReservationDraftPayload = {
  branchId: string | null;
  quickDateId: string | null;
  quickPickIds: string[];
  guests: number;
  dateLabel: string;
  timeLabel: string;
  seatingPreference: string | null;
  occasion: string | null;
  accessibilityNoteIds: string[];
  restaurantNote: string;
  tableId: string | null;
  slotLabel: string | null;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Resolve visit start from quick date id + HH:mm label (server TZ). */
export function resolveReservationStartsAt(
  quickDateId: string | null | undefined,
  dateLabel: string,
  timeLabel: string
): Date {
  const quick = buildQuickDateOptions(10);
  const id = resolveQuickDateId(quick, dateLabel, quickDateId);
  let dayOffset = 0;
  if (id?.match(/^d(\d+)$/)) {
    dayOffset = Number.parseInt(id.slice(1), 10);
  } else if (dateLabel === "Today") {
    dayOffset = 0;
  } else if (dateLabel === "Tomorrow") {
    dayOffset = 1;
  }
  const d = addDays(startOfDay(new Date()), dayOffset);
  const parts = timeLabel.trim().split(":");
  const h = Number.parseInt(parts[0] ?? "19", 10);
  const m = Number.parseInt(parts[1] ?? "0", 10);
  d.setHours(Number.isFinite(h) ? h : 19, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export function makeConfirmationCode(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `SRV-${n}`;
}

export async function uniqueConfirmationCode(prisma: PrismaClient): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = makeConfirmationCode();
    const hit = await prisma.customerReservation.findUnique({
      where: { confirmationCode: code },
      select: { id: true }
    });
    if (!hit) return code;
  }
  return `SRV-${Date.now().toString().slice(-6)}`;
}

export function normalizeDraftPayload(raw: unknown, validated: ReservationStartValidated): ReservationDraftPayload {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const accessibilityNoteIds = Array.isArray(o.accessibilityNoteIds)
    ? o.accessibilityNoteIds.filter((id): id is string => typeof id === "string")
    : [];
  return {
    branchId: validated.branchId,
    quickDateId: validated.quickDateId,
    quickPickIds: validated.quickPickIds,
    guests: validated.guests,
    dateLabel: validated.dateLabel,
    timeLabel: validated.timeLabel,
    seatingPreference: typeof o.seatingPreference === "string" ? o.seatingPreference : null,
    occasion: typeof o.occasion === "string" ? o.occasion : null,
    accessibilityNoteIds,
    restaurantNote: typeof o.restaurantNote === "string" ? o.restaurantNote : "",
    tableId: typeof o.tableId === "string" ? o.tableId : null,
    slotLabel: typeof o.slotLabel === "string" ? o.slotLabel : null
  };
}

export function validateFullReservationBody(raw: unknown):
  | { ok: true; validated: ReservationStartValidated; draft: ReservationDraftPayload }
  | { ok: false; error: string; fields?: Record<string, string> } {
  const start = validateReservationStartInput(raw);
  if (!start.ok) {
    return { ok: false, error: "validation_error", fields: start.fields };
  }
  return {
    ok: true,
    validated: start.data,
    draft: normalizeDraftPayload(raw, start.data)
  };
}

export function serializeCustomerReservation(row: CustomerReservation & { restaurant: { id: string; name: string } }) {
  const draft = row.draft as ReservationDraftPayload;
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    restaurantName: row.restaurant.name,
    confirmationCode: row.confirmationCode,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    draft
  };
}

/** Active = confirmed and visit hasn't ended (2h grace after start). */
export function upcomingReservationWhere(userId: string, now = new Date()) {
  const graceMs = 2 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - graceMs);
  return {
    userId,
    status: "CONFIRMED" as const,
    startsAt: { gte: cutoff }
  };
}
