import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { readPreferredRestaurantIdFromProfile } from "../lib/customerPreferredVenue.js";

/** Fields that exist on every deployed DB revision (safe for signup response + fallbacks). */
const USER_CORE_SELECT = {
  id: true,
  email: true,
  phone: true,
  role: true
} as const;

function publicUserFromDbRow(row: {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  signupProfile?: unknown | null;
}) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    role: row.role,
    signupProfile: row.signupProfile ?? null,
    preferredRestaurantId: readPreferredRestaurantIdFromProfile(row.signupProfile)
  };
}

async function findUserForAuthMe(prisma: PrismaClient, sub: string) {
  try {
    const row = await prisma.user.findUnique({
      where: { id: sub },
      select: { ...USER_CORE_SELECT, signupProfile: true }
    });
    if (!row) return null;
    return publicUserFromDbRow(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      const row = await prisma.user.findUnique({
        where: { id: sub },
        select: USER_CORE_SELECT
      });
      if (!row) return null;
      return publicUserFromDbRow({ ...row, signupProfile: null });
    }
    throw e;
  }
}

const SALT_ROUNDS = 10;

function normalizeOrgNumber(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  if (digits.length > 0) return digits;
  return raw.trim().toLowerCase();
}

/** Mobile business wizard final payload subset required to provision Company + first Restaurant */
const businessSignupProvisionSchema = z
  .object({
    flow: z.literal("BUSINESS"),
    orgNumber: z.string().min(1),
    companyName: z.string().min(1),
    venueTradingName: z.string().min(2),
    businessType: z.enum(["Restaurant", "Cafe", "Bakery", "Other"]),
    businessTypeOtherDescription: z.string().optional(),
    establishmentLocation: z.string().min(2),
    offeringsDescription: z.string().min(2)
  })
  .superRefine((d, ctx) => {
    if (d.businessType === "Other" && !(d.businessTypeOtherDescription ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businessTypeOtherDescription"]
      });
    }
  });

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
      },
      select: { id: true }
    });
    if (existing) {
      return reply.status(409).send({ ok: false, error: "user_already_exists" });
    }

    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    const baseUserData = {
      email: body.email,
      phone: body.phone,
      password: passwordHash,
      role: body.role
    };

    const reg = body.registrationProfile;
    const needsBusinessBootstrap =
      body.role === "OWNER" &&
      reg &&
      typeof reg === "object" &&
      (reg as { flow?: unknown }).flow === "BUSINESS";
    let businessProvision: z.infer<typeof businessSignupProvisionSchema> | null = null;
    if (needsBusinessBootstrap) {
      const parsed = businessSignupProvisionSchema.safeParse(reg);
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, error: "invalid_registration_profile" });
      }
      businessProvision = parsed.data;
    }

    let dbUser: {
      id: string;
      email: string | null;
      phone: string | null;
      role: string;
      signupProfile?: unknown | null;
    };
    try {
      dbUser = await prisma.user.create({
        data:
          body.registrationProfile !== undefined
            ? {
                ...baseUserData,
                signupProfile: body.registrationProfile as Prisma.InputJsonValue
              }
            : baseUserData,
        select: { ...USER_CORE_SELECT, signupProfile: true }
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2022" &&
        body.registrationProfile !== undefined
      ) {
        dbUser = await prisma.user.create({
          data: baseUserData,
          select: USER_CORE_SELECT
        });
        dbUser = { ...dbUser, signupProfile: null };
      } else {
        throw e;
      }
    }

    if (businessProvision && dbUser.role === "OWNER") {
      const orgKey = normalizeOrgNumber(businessProvision.orgNumber);
      try {
        await prisma.$transaction(async (tx) => {
          const company = await tx.company.upsert({
            where: { orgNumberNormalized: orgKey },
            create: { orgNumberNormalized: orgKey, legalName: businessProvision!.companyName.trim() },
            update: { legalName: businessProvision!.companyName.trim() }
          });
          const otherDesc =
            businessProvision!.businessType === "Other"
              ? businessProvision!.businessTypeOtherDescription!.trim()
              : null;
          const restaurant = await tx.restaurant.create({
            data: {
              name: businessProvision!.venueTradingName.trim(),
              companyId: company.id,
              venueSubtype: businessProvision!.businessType,
              venueSubtypeOther: otherDesc,
              establishmentLocation: businessProvision!.establishmentLocation.trim(),
              offeringsDescription: businessProvision!.offeringsDescription.trim()
            },
            select: { id: true }
          });
          await tx.membership.create({
            data: { userId: dbUser.id, restaurantId: restaurant.id, role: "OWNER" }
          });
        });
      } catch (e) {
        await prisma.user.delete({ where: { id: dbUser.id } }).catch(() => undefined);
        throw e;
      }
    }

    const token = app.signJwt({
      sub: dbUser.id,
      role: dbUser.role as "OWNER" | "STAFF" | "CUSTOMER"
    });
    return { ok: true, user: publicUserFromDbRow(dbUser), token };
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
          data: { password: await bcrypt.hash(body.password, SALT_ROUNDS) },
          select: { id: true }
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
    const user = await findUserForAuthMe(prisma, payload.sub);
    if (!user) return reply.status(404).send({ ok: false, error: "user_not_found" });
    return { ok: true, user };
  });
}
