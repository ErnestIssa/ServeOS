import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

function bearerToken(headers: { authorization?: string }): string | null {
  const auth = headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length);
}

export function registerCustomerRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/customer/restaurant-directory", async (req, reply) => {
    const tok = bearerToken(req.headers as { authorization?: string });
    if (!tok) return reply.status(401).send({ ok: false, error: "missing_token" });
    const pl = app.verifyJwt(tok);
    if (pl.role !== "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_only" });
    }

    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
    return { ok: true, restaurants };
  });

  const bodySchema = z.object({
    restaurantId: z.string().min(1)
  });

  app.patch("/customer/preferred-restaurant", async (req, reply) => {
    const tok = bearerToken(req.headers as { authorization?: string });
    if (!tok) return reply.status(401).send({ ok: false, error: "missing_token" });
    const pl = app.verifyJwt(tok);
    if (pl.role !== "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_only" });
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation_error" });
    }

    const { restaurantId } = parsed.data;
    const r = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true }
    });
    if (!r) return reply.status(404).send({ ok: false, error: "restaurant_not_found" });

    await prisma.user.update({
      where: { id: pl.sub },
      data: { preferredRestaurantId: r.id },
      select: { id: true }
    });

    return { ok: true, preferredRestaurantId: r.id, restaurantName: r.name };
  });
}
