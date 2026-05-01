import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

const SALT_ROUNDS = 10;

export function registerAuthRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const signupSchema = z.object({
    email: z.string().email().optional(),
    phone: z.string().min(6).optional(),
    password: z.string().min(8),
    role: z.enum(["OWNER", "STAFF", "CUSTOMER"]).default("OWNER"),
    registrationProfile: z.record(z.string(), z.any()).optional()
  });

  app.post("/auth/signup", async (req, reply) => {
    const body = signupSchema.parse(req.body);
    if (!body.email && !body.phone) {
      return reply.status(400).send({ ok: false, error: "email_or_phone_required" });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          body.email ? { email: body.email } : undefined,
          body.phone ? { phone: body.phone } : undefined
        ].filter(Boolean) as any
      }
    });
    if (existing) {
      return reply.status(409).send({ ok: false, error: "user_already_exists" });
    }

    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        phone: body.phone,
        password: passwordHash,
        role: body.role,
        signupProfile:
          body.registrationProfile !== undefined ? (body.registrationProfile as Prisma.InputJsonValue) : undefined
      },
      select: { id: true, email: true, phone: true, role: true, signupProfile: true }
    });

    const token = app.signJwt({ sub: user.id, role: user.role });
    return { ok: true, user, token };
  });

  const loginSchema = z.object({
    email: z.string().email().optional(),
    phone: z.string().min(6).optional(),
    password: z.string().min(8)
  });

  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    if (!body.email && !body.phone) {
      return reply.status(400).send({ ok: false, error: "email_or_phone_required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          body.email ? { email: body.email } : undefined,
          body.phone ? { phone: body.phone } : undefined
        ].filter(Boolean) as any
      },
      select: { id: true, email: true, phone: true, role: true, password: true }
    });
    if (!user) {
      return reply.status(401).send({ ok: false, error: "invalid_credentials" });
    }

    let valid = false;
    if (user.password.startsWith("$2")) {
      valid = await bcrypt.compare(body.password, user.password);
    } else {
      valid = user.password === body.password;
      if (valid) {
        await prisma.user.update({
          where: { id: user.id },
          data: { password: await bcrypt.hash(body.password, SALT_ROUNDS) }
        });
      }
    }

    if (!valid) {
      return reply.status(401).send({ ok: false, error: "invalid_credentials" });
    }

    const token = app.signJwt({ sub: user.id, role: user.role });
    return { ok: true, user: { id: user.id, email: user.email, phone: user.phone, role: user.role }, token };
  });

  app.get("/auth/me", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ ok: false, error: "missing_token" });
    const token = auth.slice("Bearer ".length);

    const payload = app.verifyJwt(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, phone: true, role: true, signupProfile: true }
    });
    if (!user) return reply.status(404).send({ ok: false, error: "user_not_found" });
    return { ok: true, user };
  });
}
