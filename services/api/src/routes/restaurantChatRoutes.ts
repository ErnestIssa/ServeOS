import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import {
  markCustomerMessagesDeliveredInRoom,
  markMessageDelivered,
  markRestaurantReadInRoom
} from "../lib/chatReceipts.js";

function bearerToken(headers: { authorization?: string }): string | null {
  const auth = headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length);
}

async function requireStaff(
  req: { headers: { authorization?: string } },
  prisma: PrismaClient,
  restaurantId: string
) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw Object.assign(new Error("JWT_SECRET is required"), { statusCode: 500 });
  const tok = bearerToken(req.headers as { authorization?: string });
  if (!tok) throw Object.assign(new Error("missing_token"), { statusCode: 401 });
  const p = jwt.verify(tok, secret) as { sub: string; role: string };
  const m = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId: p.sub, restaurantId } }
  });
  if (!m || (m.role !== "OWNER" && m.role !== "STAFF")) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return p;
}

export function registerRestaurantChatRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  chatBus: EventEmitter
) {
  app.post("/restaurants/:restaurantId/chat/rooms/:chatRoomId/read", async (req, reply) => {
    const { restaurantId, chatRoomId } = req.params as { restaurantId: string; chatRoomId: string };
    try {
      await requireStaff(req, prisma, restaurantId);
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 403).send({ ok: false, error: err.message ?? "forbidden" });
    }
    const room = await prisma.chatRoom.findFirst({
      where: { id: chatRoomId, restaurantId }
    });
    if (!room) return reply.status(404).send({ ok: false, error: "room_not_found" });
    const readAt = await markRestaurantReadInRoom(prisma, chatBus, chatRoomId);
    return { ok: true, readAt: readAt?.toISOString() ?? null };
  });

  app.post("/restaurants/:restaurantId/chat/rooms/:chatRoomId/delivered", async (req, reply) => {
    const { restaurantId, chatRoomId } = req.params as { restaurantId: string; chatRoomId: string };
    try {
      await requireStaff(req, prisma, restaurantId);
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 403).send({ ok: false, error: err.message ?? "forbidden" });
    }
    const room = await prisma.chatRoom.findFirst({
      where: { id: chatRoomId, restaurantId }
    });
    if (!room) return reply.status(404).send({ ok: false, error: "room_not_found" });
    const ids = await markCustomerMessagesDeliveredInRoom(prisma, chatBus, chatRoomId);
    return { ok: true, messageIds: ids };
  });

  app.post("/restaurants/:restaurantId/chat/messages/:messageId/delivered", async (req, reply) => {
    const { restaurantId, messageId } = req.params as { restaurantId: string; messageId: string };
    try {
      await requireStaff(req, prisma, restaurantId);
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 403).send({ ok: false, error: err.message ?? "forbidden" });
    }
    const msg = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { chatRoom: true }
    });
    if (!msg || msg.chatRoom.restaurantId !== restaurantId) {
      return reply.status(404).send({ ok: false, error: "message_not_found" });
    }
    const id = await markMessageDelivered(prisma, chatBus, messageId);
    return { ok: true, messageId: id };
  });
}
