import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  resolveReservationStartsAt,
  serializeCustomerReservation,
  uniqueConfirmationCode,
  upcomingReservationWhere,
  validateFullReservationBody,
  type ReservationDraftPayload
} from "../lib/reservationBooking.js";
import { validateReservationStartInput } from "../lib/reservationStartValidation.js";

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
        select: { id: true, name: true }
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

      const v = result.data;
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
        select: { id: true, name: true }
      });
      if (!restaurant) {
        return reply.status(404).send({ ok: false, error: "restaurant_not_found" });
      }

      const parsed = validateFullReservationBody(req.body);
      if (!parsed.ok) {
        return reply.status(400).send({
          ok: false,
          error: parsed.error,
          fields: parsed.fields
        });
      }

      const startsAt = resolveReservationStartsAt(
        parsed.draft.quickDateId,
        parsed.draft.dateLabel,
        parsed.draft.timeLabel
      );
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
    "/customer/reservations/:reservationId",
    async (req, reply) => {
      const user = requireCustomer(req, app);
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
      const user = requireCustomer(req, app);
      const { reservationId } = req.params;

      const existing = await prisma.customerReservation.findFirst({
        where: { id: reservationId, userId: user.sub, status: "CONFIRMED" },
        include: { restaurant: { select: { id: true, name: true } } }
      });
      if (!existing) {
        return reply.status(404).send({ ok: false, error: "reservation_not_found" });
      }

      const patch = patchReservationSchema.parse(req.body);
      const prevDraft = existing.draft as ReservationDraftPayload;
      const merged = { ...prevDraft, ...patch };

      const validated = validateFullReservationBody(merged);
      if (!validated.ok) {
        return reply.status(400).send({
          ok: false,
          error: validated.error,
          fields: validated.fields
        });
      }

      const startsAt = resolveReservationStartsAt(
        validated.draft.quickDateId,
        validated.draft.dateLabel,
        validated.draft.timeLabel
      );

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

  app.post<{ Params: { reservationId: string } }>(
    "/customer/reservations/:reservationId/cancel",
    async (req, reply) => {
      const user = requireCustomer(req, app);
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
}
