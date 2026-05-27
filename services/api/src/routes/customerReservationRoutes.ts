import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { validateReservationStartInput } from "../lib/reservationStartValidation.js";

function bearerToken(headers: { authorization?: string }): string | null {
  const auth = headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length);
}

export function registerCustomerReservationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post<{ Params: { restaurantId: string } }>(
    "/customer/restaurants/:restaurantId/reservations/validate-start",
    async (req, reply) => {
      const tok = bearerToken(req.headers as { authorization?: string });
      if (!tok) return reply.status(401).send({ ok: false, error: "missing_token" });
      const pl = app.verifyJwt(tok);
      if (pl.role !== "CUSTOMER") {
        return reply.status(403).send({ ok: false, error: "customer_only" });
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
}
