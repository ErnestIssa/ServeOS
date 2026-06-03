import fp from "fastify-plugin";
import jwt from "jsonwebtoken";

/** Matches Prisma `Role` enum — stored in JWT for auth checks. */
export type JwtRole = "OWNER" | "MANAGER" | "STAFF" | "KITCHEN" | "CASHIER" | "CUSTOMER";

export type JwtUser = {
  sub: string;
  role: JwtRole;
};

export function toJwtRole(role: string): JwtRole {
  const u = role.trim().toUpperCase();
  if (
    u === "OWNER" ||
    u === "MANAGER" ||
    u === "STAFF" ||
    u === "KITCHEN" ||
    u === "CASHIER" ||
    u === "CUSTOMER"
  ) {
    return u;
  }
  return "CUSTOMER";
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtUser;
  }
}

export const authPlugin = fp(async (app) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  app.decorate("signJwt", (payload: JwtUser) => {
    return jwt.sign(payload, secret, { expiresIn: "7d" });
  });

  app.decorate("verifyJwt", (token: string): JwtUser => {
    return jwt.verify(token, secret) as JwtUser;
  });
});

declare module "fastify" {
  interface FastifyInstance {
    signJwt(payload: JwtUser): string;
    verifyJwt(token: string): JwtUser;
  }
}
