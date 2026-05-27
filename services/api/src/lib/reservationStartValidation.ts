import { z } from "zod";
import {
  BRANCH_OPTIONS,
  GUEST_COUNTS,
  LEGACY_DATE_OPTIONS,
  RECOMMENDATION_PICKS,
  TIME_OPTIONS,
  buildQuickDateOptions,
  resolveQuickDateId
} from "./reservationPresets.js";

const branchIds = new Set<string>(BRANCH_OPTIONS.map((b) => b.id));
const quickPickIdSet = new Set<string>(RECOMMENDATION_PICKS.map((p) => p.id));
const timeLabels = new Set<string>(TIME_OPTIONS.map((t) => t.label));
const legacyDateLabels = new Set<string>(LEGACY_DATE_OPTIONS.map((d) => d.label));

export const reservationStartBodySchema = z.object({
  guests: z.number().int().min(1).max(99),
  dateLabel: z.string().trim().min(1),
  quickDateId: z.string().trim().min(1).optional().nullable(),
  timeLabel: z.string().trim().min(1),
  branchId: z.string().trim().min(1).nullable().optional(),
  quickPickIds: z.array(z.string().trim().min(1)).default([])
});

export type ReservationStartBody = z.infer<typeof reservationStartBodySchema>;

export type ReservationStartFieldErrors = Partial<
  Record<"guests" | "dateLabel" | "timeLabel" | "experience" | "branchId" | "quickPickIds", string>
>;

export type ReservationStartValidated = {
  guests: number;
  dateLabel: string;
  quickDateId: string;
  dayLabel: string;
  timeLabel: string;
  timeId: string;
  branchId: string | null;
  quickPickIds: string[];
};

function normalizeGuests(n: number): { ok: true; guests: number } | { ok: false; error: string } {
  if (!Number.isFinite(n) || n < 1) return { ok: false, error: "required" };
  if ((GUEST_COUNTS as readonly number[]).includes(n)) return { ok: true, guests: n };
  if (n >= 8) return { ok: true, guests: 8 };
  return { ok: false, error: "invalid" };
}

function resolveDate(
  dateLabel: string,
  quickDateId?: string | null
):
  | { ok: true; dateLabel: string; quickDateId: string; dayLabel: string }
  | { ok: false; error: string } {
  const quick = buildQuickDateOptions(10);
  const id = resolveQuickDateId(quick, dateLabel, quickDateId);
  if (id) {
    const opt = quick.find((o) => o.id === id)!;
    return { ok: true, dateLabel: opt.dateLabel, quickDateId: opt.id, dayLabel: opt.label };
  }
  if (legacyDateLabels.has(dateLabel)) {
    const legacy = LEGACY_DATE_OPTIONS.find((d) => d.label === dateLabel)!;
    return { ok: true, dateLabel: legacy.label, quickDateId: legacy.id, dayLabel: legacy.label };
  }
  return { ok: false, error: "invalid" };
}

function resolveTime(timeLabel: string): { ok: true; timeLabel: string; timeId: string } | { ok: false; error: string } {
  if (!timeLabels.has(timeLabel)) return { ok: false, error: "invalid" };
  const opt = TIME_OPTIONS.find((t) => t.label === timeLabel)!;
  return { ok: true, timeLabel: opt.label, timeId: opt.id };
}

function resolveExperience(
  branchId: string | null | undefined,
  quickPickIds: string[]
):
  | { ok: true; branchId: string | null; quickPickIds: string[] }
  | { ok: false; error: string; field?: "branchId" | "quickPickIds" | "experience" } {
  const branch = branchId?.trim() ? branchId.trim() : null;
  const picks = [...new Set(quickPickIds.map((id) => id.trim()).filter(Boolean))];

  if (branch && !branchIds.has(branch)) {
    return { ok: false, error: "invalid", field: "branchId" };
  }
  for (const id of picks) {
    if (!quickPickIdSet.has(id)) {
      return { ok: false, error: "invalid", field: "quickPickIds" };
    }
  }
  if (!branch && picks.length === 0) {
    return { ok: false, error: "pick_at_least_one", field: "experience" };
  }
  return { ok: true, branchId: branch, quickPickIds: picks };
}

export function validateReservationStartInput(
  raw: unknown
):
  | { ok: true; data: ReservationStartValidated }
  | { ok: false; error: "validation_error"; fields: ReservationStartFieldErrors } {
  const parsed = reservationStartBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "validation_error", fields: { guests: "invalid" } };
  }

  const fields: ReservationStartFieldErrors = {};
  const body = parsed.data;

  const guestsRes = normalizeGuests(body.guests);
  if (!guestsRes.ok) fields.guests = guestsRes.error;

  const dateRes = resolveDate(body.dateLabel, body.quickDateId);
  if (!dateRes.ok) fields.dateLabel = dateRes.error;

  const timeRes = resolveTime(body.timeLabel);
  if (!timeRes.ok) fields.timeLabel = timeRes.error;

  const expRes = resolveExperience(body.branchId ?? null, body.quickPickIds ?? []);
  if (!expRes.ok) {
    if (expRes.field === "experience") fields.experience = expRes.error;
    else if (expRes.field === "branchId") fields.branchId = expRes.error;
    else if (expRes.field === "quickPickIds") fields.quickPickIds = expRes.error;
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, error: "validation_error", fields };
  }

  return {
    ok: true,
    data: {
      guests: guestsRes.ok ? guestsRes.guests : body.guests,
      dateLabel: dateRes.ok ? dateRes.dateLabel : body.dateLabel,
      quickDateId: dateRes.ok ? dateRes.quickDateId : "",
      dayLabel: dateRes.ok ? dateRes.dayLabel : body.dateLabel,
      timeLabel: timeRes.ok ? timeRes.timeLabel : body.timeLabel,
      timeId: timeRes.ok ? timeRes.timeId : body.timeLabel,
      branchId: expRes.ok ? expRes.branchId : null,
      quickPickIds: expRes.ok ? expRes.quickPickIds : []
    }
  };
}
