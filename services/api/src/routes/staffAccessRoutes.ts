import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import type { PrismaClient, Role } from "@prisma/client";
import { z } from "zod";
import { requireMobileAuth } from "../lib/mobileAuthContext.js";
import { PERMISSION_GROUPS, INVITABLE_OPERATIONAL_ROLES } from "../lib/venuePermissions.js";
import {
  createStaffInvitation,
  cancelStaffInvitation,
  previewInvitation
} from "../lib/staffInvitationService.js";
import { notifyStaffInvited } from "../notifications/integrations/staff.js";
import {
  listVenueStaff,
  approveMembership,
  rejectMembership,
  suspendMembership,
  removeMembership,
  updateMembershipPermissions,
  updateRestaurantAccessPolicy
} from "../lib/staffMembershipService.js";
import { loadRestaurantPolicy } from "../lib/venueAccessGuard.js";

const inviteSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6).optional(),
  intendedRole: z.enum(["STAFF", "KITCHEN", "CASHIER", "MANAGER"]),
  permissions: z.array(z.string()).optional(),
  /** Requested channels — delivery deferred until notification phase. */
  notifyChannels: z.array(z.enum(["email", "sms", "whatsapp"])).optional()
});

export function registerStaffAccessRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  domainEventBus: EventEmitter
) {
  app.get("/staff-access/permission-catalog", async () => ({
    ok: true,
    invitableRoles: INVITABLE_OPERATIONAL_ROLES,
    managerRole: "MANAGER",
    groups: PERMISSION_GROUPS,
    note: "Notification delivery is not enabled yet; invitations return acceptUrl only."
  }));

  app.get("/staff-invitations/preview", async (req, reply) => {
    const token = String((req.query as { token?: string }).token ?? "").trim();
    if (!token) return reply.status(400).send({ ok: false, error: "token_required" });
    const res = await previewInvitation(prisma, token);
    if (!res.ok) return reply.status(400).send({ ok: false, error: res.error });
    return { ok: true, ...res.invitation };
  });

  app.get("/restaurants/:restaurantId/staff", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const restaurantId = String((req.params as { restaurantId: string }).restaurantId);
    try {
      const data = await listVenueStaff(prisma, ctx, restaurantId);
      const policy = await loadRestaurantPolicy(prisma, restaurantId);
      return { ok: true, ...data, accessPolicy: policy };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/restaurants/:restaurantId/staff/invitations", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const restaurantId = String((req.params as { restaurantId: string }).restaurantId);
    const body = inviteSchema.parse(req.body);
    try {
      const created = await createStaffInvitation(prisma, ctx, restaurantId, {
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        intendedRole: body.intendedRole as Role,
        permissions: body.permissions
      });
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { name: true }
      });
      await notifyStaffInvited(domainEventBus, {
        restaurantId,
        restaurantName: restaurant?.name ?? "Venue",
        invitationId: created.invitationId,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        intendedRole: body.intendedRole,
        acceptUrl: created.acceptUrl,
        invitedByUserId: ctx.userId
      });
      return {
        ok: true,
        invitationId: created.invitationId,
        expiresAt: created.expiresAt.toISOString(),
        acceptUrl: created.acceptUrl,
        delivery: {
          queued: true,
          channels: body.notifyChannels ?? ["email", "sms", "whatsapp"],
          message: "routed_via_notification_service"
        }
      };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.delete("/restaurants/:restaurantId/staff/invitations/:invitationId", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, invitationId } = req.params as { restaurantId: string; invitationId: string };
    try {
      await cancelStaffInvitation(prisma, ctx, restaurantId, invitationId);
      return { ok: true };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/restaurants/:restaurantId/staff/memberships/:membershipId/approve", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    try {
      const res = await approveMembership(prisma, ctx, restaurantId, membershipId);
      const m = await prisma.membership.findUnique({
        where: { id: membershipId },
        select: { userId: true, restaurant: { select: { name: true } } }
      });
      if (m) {
        const { notifyStaffApproved } = await import("../notifications/integrations/staff.js");
        await notifyStaffApproved(domainEventBus, {
          restaurantId,
          restaurantName: m.restaurant.name,
          userId: m.userId,
          approvedByUserId: ctx.userId
        });
      }
      return res;
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/restaurants/:restaurantId/staff/memberships/:membershipId/reject", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    try {
      const m = await prisma.membership.findUnique({
        where: { id: membershipId },
        select: { userId: true, restaurant: { select: { name: true } } }
      });
      const res = await rejectMembership(prisma, ctx, restaurantId, membershipId);
      if (m) {
        const { notifyStaffRejected } = await import("../notifications/integrations/staff.js");
        await notifyStaffRejected(domainEventBus, {
          restaurantId,
          restaurantName: m.restaurant.name,
          userId: m.userId
        });
      }
      return res;
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/restaurants/:restaurantId/staff/memberships/:membershipId/suspend", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    try {
      return await suspendMembership(prisma, ctx, restaurantId, membershipId);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.delete("/restaurants/:restaurantId/staff/memberships/:membershipId", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    try {
      return await removeMembership(prisma, ctx, restaurantId, membershipId);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.patch("/restaurants/:restaurantId/staff/memberships/:membershipId/permissions", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    const body = z.object({ permissions: z.array(z.string()) }).parse(req.body);
    try {
      return await updateMembershipPermissions(prisma, ctx, restaurantId, membershipId, body.permissions);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.patch("/restaurants/:restaurantId/access-policy", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const restaurantId = String((req.params as { restaurantId: string }).restaurantId);
    const body = z
      .object({
        maxManagers: z.number().int().min(0).optional(),
        allowManagersToInviteManagers: z.boolean().optional()
      })
      .parse(req.body);
    try {
      return await updateRestaurantAccessPolicy(prisma, ctx, restaurantId, body);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });
}
