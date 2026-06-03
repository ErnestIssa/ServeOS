import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  serializeCustomerReservation,
  uniqueConfirmationCode,
  upcomingReservationWhere,
  validateFullReservationBody,
  type ReservationDraftPayload
} from "../lib/reservationBooking.js";
import {
  quickDateFromStartsAt,
  timeLabelFromStartsAt
} from "../lib/reservationPresets.js";
import {
  buildEditReservationSlotPicker,
  buildReservationSlotPicker,
  scheduleFieldErrorMessage,
  validateReservationSchedule,
  type PinnedReservationSlot
} from "../lib/reservationSlotValidation.js";
import {
  clearCustomerReservationDraft,
  loadCustomerReservationDraft,
  saveCustomerReservationDraft
} from "../lib/customerReservationDraftService.js";
import { validateReservationStartInput } from "../lib/reservationStartValidation.js";
import { ensureReservationChatRoom, loadCustomerReservationOcl } from "../lib/reservationOcl.js";

function bearerToken(headers: { authorization?: string }): string | null {
  const auth = headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length);
}

function requireCustomer(req: { headers: { authorization?: string } }, app: FastifyInstance) {
  const tok = bearerToken(req.headers as { authorization?: string });
  if (!tok) throw Object.assign(new Error("missing_token"), { statusCode: 401 });
  const pl = app.verifyJwt(tok);
  if (pl.role !== "CUSTOMER") throw Object.assign(new Error("customer_only"), { statusCode: 403 });
  return pl;
}

const patchReservationSchema = z.object({
  guests: z.number().int().min(1).max(99).optional(),
  dateLabel: z.string().trim().min(1).optional(),
  quickDateId: z.string().trim().min(1).optional().nullable(),
  timeLabel: z.string().trim().min(1).optional(),
  branchId: z.string().trim().min(1).nullable().optional(),
  quickPickIds: z.array(z.string().trim().min(1)).optional(),
  seatingPreference: z.string().nullable().optional(),
  occasion: z.string().nullable().optional(),
  accessibilityNoteIds: z.array(z.string()).optional(),
  restaurantNote: z.string().optional(),
  tableId: z.string().nullable().optional(),
  slotLabel: z.string().nullable().optional()
});

export function registerCustomerReservationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post<{ Params: { restaurantId: string } }>(
    "/customer/restaurants/:restaurantId/reservations/validate-start",
    async (req, reply) => {
      try {
        requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }

      const { restaurantId } = req.params;
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true, openingHours: true }
      });
      if (!restaurant) {
        return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
      }

      const result = validateReservationStartInput(req.body);
      if (!result.ok) {
        return reply.status(400).send({
          ok: false,
          error: result.error,
          fields: result.fields
        });
      }

      const schedule = validateReservationSchedule(req.body, restaurant.openingHours ?? null);
      if (!schedule.ok) {
        return reply.status(400).send({
          ok: false,
          error: schedule.error,
          fields: schedule.fields
        });
      }

      const v = schedule.validated;
      return {
        ok: true,
        nextScreen: "builder" as const,
        restaurant: { id: restaurant.id, name: restaurant.name },
        draft: {
          guests: v.guests,
          dateLabel: v.dateLabel,
          quickDateId: v.quickDateId,
          dayLabel: v.dayLabel,
          timeLabel: v.timeLabel,
          timeId: v.timeId,
          branchId: v.branchId,
          quickPickIds: v.quickPickIds
        }
      };
    }
  );

  /** Confirm a table booking (full draft from availability step). */
  app.post<{ Params: { restaurantId: string } }>(
    "/customer/restaurants/:restaurantId/reservations",
    async (req, reply) => {
      let user;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }

      const { restaurantId } = req.params;

      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true, openingHours: true }
      });
      if (!restaurant) {
        return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
      }

      const parsed = validateFullReservationBody(req.body, restaurant.openingHours ?? null);
      if (!parsed.ok) {
        return reply.status(400).send({
          ok: false,
          error: parsed.error,
          fields: parsed.fields
        });
      }

      const startsAt = parsed.startsAt;
      const confirmationCode = await uniqueConfirmationCode(prisma);

      const row = await prisma.customerReservation.create({
        data: {
          userId: user.sub,
          restaurantId,
          confirmationCode,
          status: "CONFIRMED",
          startsAt,
          draft: parsed.draft as object
        },
        include: { restaurant: { select: { id: true, name: true } } }
      });

      await ensureReservationChatRoom(prisma, {
        reservationId: row.id,
        restaurantId,
        customerUserId: user.sub
      });

      await prisma.customerReservationDraft.upsert({
        where: { userId_restaurantId: { userId: user.sub, restaurantId } },
        create: {
          userId: user.sub,
          restaurantId,
          screenId: "confirmation",
          draft: parsed.draft as object,
          confirmationCode
        },
        update: {
          screenId: "confirmation",
          draft: parsed.draft as object,
          confirmationCode
        }
      });

      return { ok: true, reservation: serializeCustomerReservation(row) };
    }
  );

  app.get("/customer/reservations/upcoming", async (req, reply) => {
    let user;
    try {
      user = requireCustomer(req, app);
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
    }

    const rows = await prisma.customerReservation.findMany({
      where: upcomingReservationWhere(user.sub),
      orderBy: { startsAt: "asc" },
      take: 20,
      include: { restaurant: { select: { id: true, name: true } } }
    });

    return {
      ok: true,
      reservations: rows.map(serializeCustomerReservation)
    };
  });

  app.get<{ Params: { reservationId: string } }>(
    "/customer/reservations/:reservationId/ocl",
    async (req, reply) => {
      let user;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }
      try {
        const snapshot = await loadCustomerReservationOcl(prisma, user.sub, req.params.reservationId);
        return { ok: true, ...snapshot };
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
      }
    }
  );

  app.get<{ Params: { reservationId: string } }>(
    "/customer/reservations/:reservationId",
    async (req, reply) => {
      let user;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }
      const { reservationId } = req.params;

      const row = await prisma.customerReservation.findFirst({
        where: { id: reservationId, userId: user.sub },
        include: { restaurant: { select: { id: true, name: true } } }
      });
      if (!row) {
        return reply.status(404).send({ ok: false, error: "reservation_not_found" });
      }

      return { ok: true, reservation: serializeCustomerReservation(row) };
    }
  );

  app.patch<{ Params: { reservationId: string } }>(
    "/customer/reservations/:reservationId",
    async (req, reply) => {
      let user;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }
      const { reservationId } = req.params;

      const existing = await prisma.customerReservation.findFirst({
        where: { id: reservationId, userId: user.sub, status: "CONFIRMED" },
        include: { restaurant: { select: { id: true, name: true, openingHours: true } } }
      });
      if (!existing) {
        return reply.status(404).send({ ok: false, error: "reservation_not_found" });
      }

      const patchResult = patchReservationSchema.safeParse(req.body);
      if (!patchResult.success) {
        return reply.status(400).send({
          ok: false,
          error: "invalid_body",
          fields: patchResult.error.flatten().fieldErrors
        });
      }
      const patch = patchResult.data;
      const prevDraft = existing.draft as ReservationDraftPayload;
      const merged = { ...prevDraft, ...patch };

      const visitDay = new Date(existing.startsAt);
      visitDay.setHours(0, 0, 0, 0);
      const canonical = quickDateFromStartsAt(existing.startsAt, new Date());
      const pinnedSlot: PinnedReservationSlot = {
        quickDateId: canonical.id,
        dateLabel: canonical.dateLabel,
        timeLabel: timeLabelFromStartsAt(existing.startsAt),
        visitDayMs: visitDay.getTime()
      };
      const validated = validateFullReservationBody(
        merged,
        existing.restaurant.openingHours ?? null,
        new Date(),
        pinnedSlot
      );
      if (!validated.ok) {
        return reply.status(400).send({
          ok: false,
          error: validated.error,
          fields: validated.fields,
          message: scheduleFieldErrorMessage(validated.fields)
        });
      }

      const startsAt = validated.startsAt;

      const row = await prisma.customerReservation.update({
        where: { id: reservationId },
        data: {
          startsAt,
          draft: validated.draft as object
        },
        include: { restaurant: { select: { id: true, name: true } } }
      });

      return { ok: true, reservation: serializeCustomerReservation(row) };
    }
  );

  /** Slot picker for edit flow — same rules as book bar; API is source of truth. */
  app.get<{
    Params: { restaurantId: string };
    Querystring: { quickDateId?: string; dateLabel?: string; timeLabel?: string; reservationId?: string };
  }>(
    "/customer/restaurants/:restaurantId/reservations/slot-picker",
    async (req, reply) => {
      let user: ReturnType<typeof requireCustomer>;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }

      const { restaurantId } = req.params;
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, openingHours: true }
      });
      if (!restaurant) {
        return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
      }

      let pinnedSlot: PinnedReservationSlot | null = null;
      let visitStartsAt: Date | null = null;
      let quickDateId = req.query.quickDateId?.trim() || null;
      let dateLabel = req.query.dateLabel?.trim() || null;
      let preferredTime = req.query.timeLabel?.trim() || null;

      const holdId = req.query.reservationId?.trim();
      if (holdId) {
        const hold = await prisma.customerReservation.findFirst({
          where: { id: holdId, userId: user.sub, restaurantId, status: "CONFIRMED" },
          select: { startsAt: true }
        });
        if (!hold) {
          return reply.status(404).send({ ok: false, error: "reservation_not_found" });
        }
        visitStartsAt = hold.startsAt;
        const now = new Date();
        const visitDay = new Date(hold.startsAt);
        visitDay.setHours(0, 0, 0, 0);
        const canonical = quickDateFromStartsAt(hold.startsAt, now);
        const timeLabel = timeLabelFromStartsAt(hold.startsAt);
        pinnedSlot = {
          quickDateId: canonical.id,
          dateLabel: canonical.dateLabel,
          timeLabel,
          visitDayMs: visitDay.getTime()
        };
        const userPickedDate = Boolean(quickDateId || dateLabel);
        if (!userPickedDate) {
          quickDateId = canonical.id;
          dateLabel = canonical.dateLabel;
          preferredTime = timeLabel;
        }
      }

      if (holdId && visitStartsAt && !quickDateId && !dateLabel) {
        const editPicker = buildEditReservationSlotPicker(
          restaurant.openingHours ?? null,
          visitStartsAt,
          new Date(),
          pinnedSlot
        );
        return { ok: true, ...editPicker };
      }

      const picker = buildReservationSlotPicker(
        restaurant.openingHours ?? null,
        quickDateId,
        dateLabel || "Today",
        preferredTime,
        new Date(),
        pinnedSlot,
        visitStartsAt
      );

      return { ok: true, ...picker };
    }
  );

  app.post<{ Params: { reservationId: string } }>(
    "/customer/reservations/:reservationId/cancel",
    async (req, reply) => {
      let user;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }
      const { reservationId } = req.params;

      const existing = await prisma.customerReservation.findFirst({
        where: { id: reservationId, userId: user.sub, status: "CONFIRMED" }
      });
      if (!existing) {
        return reply.status(404).send({ ok: false, error: "reservation_not_found" });
      }

      const row = await prisma.customerReservation.update({
        where: { id: reservationId },
        data: { status: "CANCELLED" },
        include: { restaurant: { select: { id: true, name: true } } }
      });

      return { ok: true, reservation: serializeCustomerReservation(row) };
    }
  );

  app.get<{ Params: { restaurantId: string } }>(
    "/customer/restaurants/:restaurantId/reservations/draft",
    async (req, reply) => {
      let user;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }
      const { restaurantId } = req.params;
      const flow = await loadCustomerReservationDraft(prisma, user.sub, restaurantId);
      return { ok: true, flow };
    }
  );

  app.patch<{ Params: { restaurantId: string } }>(
    "/customer/restaurants/:restaurantId/reservations/draft",
    async (req, reply) => {
      let user;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }
      const { restaurantId } = req.params;
      const body = z
        .object({
          draft: z.record(z.unknown()),
          screen: z.string().min(1),
          scrollByScreen: z.record(z.number()).optional(),
          confirmedReservationId: z.string().nullable().optional()
        })
        .parse(req.body);

      const flow = await saveCustomerReservationDraft(prisma, user.sub, restaurantId, {
        draft: body.draft,
        screen: body.screen,
        scrollByScreen: body.scrollByScreen,
        confirmedReservationId: body.confirmedReservationId ?? null
      });
      return { ok: true, flow };
    }
  );

  app.delete<{ Params: { restaurantId: string } }>(
    "/customer/restaurants/:restaurantId/reservations/draft",
    async (req, reply) => {
      let user;
      try {
        user = requireCustomer(req, app);
      } catch (e) {
        const err = e as { statusCode?: number; message?: string };
        return reply.status(err.statusCode ?? 401).send({ ok: false, error: err.message ?? "unauthorized" });
      }
      const { restaurantId } = req.params;
      await clearCustomerReservationDraft(prisma, user.sub, restaurantId);
      return { ok: true };
    }
  );
}
