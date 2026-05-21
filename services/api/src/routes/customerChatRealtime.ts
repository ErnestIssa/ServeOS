import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { markCustomerRead } from "../lib/chatMessageService.js";
import { emitChatEvent, roomChat, roomCustomerChat, type ChatWsPayload } from "../lib/chatRealtime.js";

type InboundWs =
  | { event: "join_room"; chatRoomId: string }
  | { event: "typing"; chatRoomId: string; isTyping: boolean }
  | { event: "messages_read"; chatRoomId: string };

export function registerCustomerChatRealtime(
  app: FastifyInstance,
  prisma: PrismaClient,
  chatBus: EventEmitter
) {
  app.get(
    "/customer/chat/events",
    { websocket: true },
    async (socket, req) => {
      const q = req.query as { token?: string };
      const token = typeof q.token === "string" ? q.token : "";
      const secret = process.env.JWT_SECRET;
      if (!secret || !token) {
        socket.close();
        return;
      }

      let sub: string;
      let role: string;
      try {
        const p = jwt.verify(token, secret) as { sub: string; role: string };
        sub = p.sub;
        role = p.role;
      } catch {
        socket.close();
        return;
      }

      if (role !== "CUSTOMER") {
        socket.close();
        return;
      }

      const joinedRooms = new Set<string>();
      const customerRoom = roomCustomerChat(sub);

      const send = (payload: ChatWsPayload) => {
        if (socket.readyState === 1) socket.send(JSON.stringify(payload));
      };

      const onChat = (payload: ChatWsPayload) => send(payload);
      chatBus.on(customerRoom, onChat);

      const rooms = await prisma.chatRoom.findMany({
        where: { OR: [{ customerUserId: sub }, { order: { customerUserId: sub } }] },
        select: { id: true }
      });
      for (const r of rooms) {
        joinedRooms.add(r.id);
        chatBus.on(roomChat(r.id), onChat);
      }

      socket.on("message", async (raw) => {
        try {
          const text = typeof raw === "string" ? raw : raw.toString("utf8");
          const data = JSON.parse(text) as InboundWs;
          if (data.event === "join_room" && data.chatRoomId) {
            const room = await prisma.chatRoom.findFirst({
              where: {
                id: data.chatRoomId,
                OR: [{ customerUserId: sub }, { order: { customerUserId: sub } }]
              }
            });
            if (!room) return;
            if (!joinedRooms.has(room.id)) {
              joinedRooms.add(room.id);
              chatBus.on(roomChat(room.id), onChat);
            }
            return;
          }
          if (data.event === "typing" && data.chatRoomId) {
            const room = await prisma.chatRoom.findFirst({
              where: {
                id: data.chatRoomId,
                OR: [{ customerUserId: sub }, { order: { customerUserId: sub } }]
              }
            });
            if (!room) return;
            emitChatEvent(chatBus, room.id, sub, {
              type: "user_typing",
              chatRoomId: room.id,
              role: "CUSTOMER",
              isTyping: !!data.isTyping
            });
            return;
          }
          if (data.event === "messages_read" && data.chatRoomId) {
            const readAt = await markCustomerRead(prisma, data.chatRoomId, sub);
            emitChatEvent(chatBus, data.chatRoomId, sub, {
              type: "messages_read",
              chatRoomId: data.chatRoomId,
              readerRole: "CUSTOMER",
              readAt: readAt.toISOString()
            });
          }
        } catch {
          /* ignore malformed */
        }
      });

      socket.on("close", () => {
        chatBus.off(customerRoom, onChat);
        for (const id of joinedRooms) {
          chatBus.off(roomChat(id), onChat);
        }
      });
    }
  );
}
