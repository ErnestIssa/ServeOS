import type { PrismaClient } from "@prisma/client";
import type { DomainEvent, NotificationTarget } from "./types.js";
import type { RecipientStrategy } from "./routingRules.js";
import { isAdminMembershipRole } from "../lib/membershipAccess.js";

export async function resolveRecipients(
  prisma: PrismaClient,
  strategy: RecipientStrategy,
  event: DomainEvent
): Promise<NotificationTarget[]> {
  const p = event.payload;
  const rid = event.restaurantId?.trim();

  switch (strategy) {
    case "order_participants": {
      const targets: NotificationTarget[] = [];
      const customerUserId = typeof p.customerUserId === "string" ? p.customerUserId : null;
      if (customerUserId) targets.push({ kind: "user", userId: customerUserId });
      if (rid) {
        const staff = await prisma.membership.findMany({
          where: { restaurantId: rid, status: "ACTIVE" },
          select: { userId: true, role: true }
        });
        for (const m of staff) {
          if (isAdminMembershipRole(m.role) || m.role === "STAFF" || m.role === "KITCHEN" || m.role === "CASHIER") {
            if (!targets.some((t) => t.kind === "user" && t.userId === m.userId)) {
              targets.push({ kind: "user", userId: m.userId });
            }
          }
        }
      }
      return targets;
    }
    case "chat_participants": {
      const targets: NotificationTarget[] = [];
      const customerUserId = typeof p.customerUserId === "string" ? p.customerUserId : null;
      const excludeUserId = event.actorUserId ?? null;
      if (customerUserId && customerUserId !== excludeUserId) {
        targets.push({ kind: "user", userId: customerUserId });
      }
      if (rid) {
        const staff = await prisma.membership.findMany({
          where: { restaurantId: rid, status: "ACTIVE" },
          select: { userId: true }
        });
        for (const m of staff) {
          if (m.userId !== excludeUserId && !targets.some((t) => t.kind === "user" && t.userId === m.userId)) {
            targets.push({ kind: "user", userId: m.userId });
          }
        }
      }
      return targets;
    }
    case "restaurant_admins": {
      if (!rid) return [];
      const admins = await prisma.membership.findMany({
        where: {
          restaurantId: rid,
          status: "ACTIVE",
          role: { in: ["OWNER", "MANAGER"] }
        },
        select: { userId: true }
      });
      return admins.map((a) => ({ kind: "user" as const, userId: a.userId }));
    }
    case "invitee_contact": {
      return [
        {
          kind: "contact",
          email: typeof p.email === "string" ? p.email : undefined,
          phone: typeof p.phone === "string" ? p.phone : undefined,
          name: typeof p.fullName === "string" ? p.fullName : undefined
        }
      ];
    }
    case "affected_user": {
      const userId = typeof p.userId === "string" ? p.userId : event.actorUserId;
      return userId ? [{ kind: "user", userId }] : [];
    }
    case "actor_only": {
      return event.actorUserId ? [{ kind: "user", userId: event.actorUserId }] : [];
    }
    default:
      return [];
  }
}
