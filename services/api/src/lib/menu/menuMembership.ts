import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import type { ActiveVenueMembership } from "../venueAccessGuard.js";
import { isVenueMembershipRole } from "../membershipAccess.js";
import { resolveMembershipPermissions } from "../venuePermissions.js";

export async function requireMenuVenueMembership(
  prisma: PrismaClient,
  req: { headers: { authorization?: string } },
  restaurantId: string
): Promise<{ userId: string; membership: ActiveVenueMembership }> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw Object.assign(new Error("JWT_SECRET is required"), { statusCode: 500 });

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw Object.assign(new Error("missing_token"), { statusCode: 401 });
  }

  const token = auth.slice("Bearer ".length);
  const user = jwt.verify(token, secret) as { sub: string; role: string };

  const m = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId: user.sub, restaurantId } }
  });
  if (!m || m.status !== "ACTIVE" || !isVenueMembershipRole(m.role)) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }

  return {
    userId: user.sub,
    membership: {
      id: m.id,
      restaurantId: m.restaurantId,
      role: m.role,
      permissions: resolveMembershipPermissions(m.role, m.permissions)
    }
  };
}
