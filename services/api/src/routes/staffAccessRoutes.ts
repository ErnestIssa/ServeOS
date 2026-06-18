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
import { sendStaffInvitationEmail } from "../lib/integrations/transactionalEmails.js";
import { isSmsProviderConfigured } from "../lib/integrations/smsProvider.js";
import {
  listVenueStaff,
  approveMembership,
  rejectMembership,
  suspendMembership,
  activateMembership,
  restoreMembership,
  removeMembership,
  updateMembershipPermissions,
  updateRestaurantAccessPolicy,
  getMembershipDetail
} from "../lib/staffMembershipService.js";
import {
  adminRequestStaffPasswordReset,
  adminRevokeStaffSessions
} from "../lib/staffAdminSecurityService.js";
import { publishStaffRealtimeEvent } from "../lib/staffRealtime.js";
import { loadRestaurantPolicy } from "../lib/venueAccessGuard.js";
import { resolveInviterAtRestaurant } from "../lib/userDisplayName.js";

const inviteSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6).optional(),
  intendedRole: z.enum(["STAFF", "KITCHEN", "CASHIER", "MANAGER"]),
  permissions: z.array(z.string()).optional(),
  /** Requested channels — delivery deferred until notification phase. */
  notifyChannels: z.array(z.enum(["email", "sms", "whatsapp"])).optional()
});

const INVITE_ROLE_LABELS: Record<string, string> = {
  STAFF: "Floor staff",
  KITCHEN: "Kitchen",
  CASHIER: "Cashier",
  MANAGER: "Venue manager"
};

function rosterUpdated(bus: EventEmitter, restaurantId: string) {
  publishStaffRealtimeEvent(bus, { type: "staff.roster.updated", restaurantId });
}

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
    note: "Staff invitation email is sent via Resend (primary). SMS is sent via Twilio when configured and a phone number is provided."
  }));

  app.get("/staff-invitations/preview", async (req, reply) => {
    const token = String((req.query as { token?: string }).token ?? "").trim();
    if (!token) return reply.status(400).send({ ok: false, error: "token_required" });
    const res = await previewInvitation(prisma, token);
    if (!res.ok) return reply.status(400).send({ ok: false, error: res.error });
    return { ok: true, ...res.invitation };
  });

  app.get("/restaurants/:restaurantId/staff/memberships/:membershipId", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    try {
      return await getMembershipDetail(prisma, ctx, restaurantId, membershipId);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
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
      const restaurantName = restaurant?.name ?? "Venue";
      const inviter = await resolveInviterAtRestaurant(prisma, {
        userId: ctx.userId,
        restaurantId
      });
      const invitedByName = inviter?.name ?? null;
      const invitedByRole = inviter?.roleLabel ?? null;
      const roleLabel = INVITE_ROLE_LABELS[body.intendedRole] ?? body.intendedRole;
      let emailResult: { id: string };
      try {
        emailResult = await sendStaffInvitationEmail({
          to: body.email,
          fullName: body.fullName,
          restaurantName,
          intendedRole: body.intendedRole,
          roleLabel,
          invitedByName,
          invitedByRole,
          acceptUrl: created.acceptUrl,
          expiresAt: created.expiresAt.toISOString().slice(0, 10)
        });
      } catch (e: unknown) {
        const err = e as { message?: string };
        return reply.status(502).send({ ok: false, error: err.message ?? "email_send_failed" });
      }

      await notifyStaffInvited(domainEventBus, {
        restaurantId,
        restaurantName,
        invitationId: created.invitationId,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        intendedRole: body.intendedRole,
        acceptUrl: created.acceptUrl,
        invitedByUserId: ctx.userId
      });
      rosterUpdated(domainEventBus, restaurantId);
      return {
        ok: true,
        invitationId: created.invitationId,
        expiresAt: created.expiresAt.toISOString(),
        acceptUrl: created.acceptUrl,
        delivery: {
          email: { sent: true, id: emailResult.id },
          sms: {
            queued: isSmsProviderConfigured() && Boolean(body.phone?.trim()),
            requiresVerifiedNumber: true
          },
          channels: body.notifyChannels ?? ["email", "sms"]
        }
      };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string; metadata?: unknown };
      return reply.status(err.statusCode ?? 500).send({
        ok: false,
        error: err.message ?? "error",
        ...(err.metadata ? { metadata: err.metadata } : {})
      });
    }
  });

  app.delete("/restaurants/:restaurantId/staff/invitations/:invitationId", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, invitationId } = req.params as { restaurantId: string; invitationId: string };
    try {
      await cancelStaffInvitation(prisma, ctx, restaurantId, invitationId);
      rosterUpdated(domainEventBus, restaurantId);
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
      rosterUpdated(domainEventBus, restaurantId);
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
      rosterUpdated(domainEventBus, restaurantId);
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
      const res = await suspendMembership(prisma, ctx, restaurantId, membershipId);
      rosterUpdated(domainEventBus, restaurantId);
      return res;
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/restaurants/:restaurantId/staff/memberships/:membershipId/activate", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    try {
      const res = await activateMembership(prisma, ctx, restaurantId, membershipId);
      rosterUpdated(domainEventBus, restaurantId);
      return res;
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/restaurants/:restaurantId/staff/memberships/:membershipId/restore", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    try {
      const res = await restoreMembership(prisma, ctx, restaurantId, membershipId);
      rosterUpdated(domainEventBus, restaurantId);
      return res;
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/restaurants/:restaurantId/staff/memberships/:membershipId/revoke-sessions", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    const body = securityPasswordSchema.parse(req.body);
    try {
      const membership = await prisma.membership.findFirst({
        where: { id: membershipId, restaurantId },
        select: { userId: true }
      });
      const res = await adminRevokeStaffSessions(prisma, ctx, restaurantId, membershipId, body.password);
      if (membership) {
        publishStaffRealtimeEvent(domainEventBus, {
          type: "staff.session.revoked",
          restaurantId,
          userId: membership.userId
        });
      }
      rosterUpdated(domainEventBus, restaurantId);
      return res;
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.post("/restaurants/:restaurantId/staff/memberships/:membershipId/reset-password", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    const body = securityPasswordSchema.parse(req.body);
    try {
      return await adminRequestStaffPasswordReset(prisma, ctx, restaurantId, membershipId, body.password);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });

  app.delete("/restaurants/:restaurantId/staff/memberships/:membershipId", async (req, reply) => {
    const ctx = await requireMobileAuth(req, app, prisma);
    const { restaurantId, membershipId } = req.params as { restaurantId: string; membershipId: string };
    try {
      const res = await removeMembership(prisma, ctx, restaurantId, membershipId);
      rosterUpdated(domainEventBus, restaurantId);
      return res;
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
      const res = await updateMembershipPermissions(prisma, ctx, restaurantId, membershipId, body.permissions);
      rosterUpdated(domainEventBus, restaurantId);
      return res;
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
