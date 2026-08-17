import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { markCustomerRead } from "../lib/chat/chatMessageService.js";
import { emitChatEvent, roomChat, roomCustomerChat, type ChatWsPayload } from "../lib/chat/chatRealtime.js";
import { assertCustomerOwnsRoom, customerRoomAccessOr } from "../lib/chat/chatAccess.js";
import { limitChatTyping, limitChatWsConnect } from "../lib/chat/chatRateLimit.js";

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
      const q = req.query as { token?: string; sessionId?: string };
      const token = typeof q.token === "string" ? q.token : "";
      const sessionId = typeof q.sessionId === "string" ? q.sessionId.trim() : "";
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

      const limited = await limitChatWsConnect(sub);
      if (!limited.ok) {
        socket.close();
        return;
      }

      const joinedRooms = new Set<string>();
      const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
      const customerRoom = roomCustomerChat(sub);

      const send = (payload: ChatWsPayload) => {
        if (socket.readyState === 1) socket.send(JSON.stringify(payload));
      };

      const onChat = (payload: ChatWsPayload) => send(payload);
      chatBus.on(customerRoom, onChat);

      const accessOr = await customerRoomAccessOr(prisma, {
        customerUserId: sub,
        sourceSessionId: sessionId || null
      });
      const rooms = accessOr.length
        ? await prisma.chatRoom.findMany({
            where: { OR: accessOr },
            select: { id: true }
          })
        : [];
      for (const r of rooms) {
        joinedRooms.add(r.id);
        chatBus.on(roomChat(r.id), onChat);
      }

      socket.on("message", async (raw: Buffer | string) => {
        try {
          const text = typeof raw === "string" ? raw : raw.toString("utf8");
          const data = JSON.parse(text) as InboundWs;
          if (data.event === "join_room" && data.chatRoomId) {
            try {
              await assertCustomerOwnsRoom(prisma, data.chatRoomId, {
                customerUserId: sub,
                sourceSessionId: sessionId || null
              });
            } catch {
              return;
            }
            if (!joinedRooms.has(data.chatRoomId)) {
              joinedRooms.add(data.chatRoomId);
              chatBus.on(roomChat(data.chatRoomId), onChat);
            }
            return;
          }
          if (data.event === "typing" && data.chatRoomId) {
            const typed = await limitChatTyping(sub);
            if (!typed.ok) return;
            try {
              await assertCustomerOwnsRoom(prisma, data.chatRoomId, {
                customerUserId: sub,
                sourceSessionId: sessionId || null
              });
            } catch {
              return;
            }
            const room = await prisma.chatRoom.findUnique({
              where: { id: data.chatRoomId },
              select: { id: true, restaurantId: true, type: true, channelKey: true }
            });
            if (!room) return;
            emitChatEvent(chatBus, room.id, sub, {
              type: "user_typing",
              chatRoomId: room.id,
              role: "CUSTOMER",
              isTyping: !!data.isTyping
            }, room.restaurantId, { roomType: room.type, channelKey: room.channelKey });
            const prev = typingTimers.get(room.id);
            if (prev) clearTimeout(prev);
            if (data.isTyping) {
              typingTimers.set(
                room.id,
                setTimeout(() => {
                  emitChatEvent(chatBus, room.id, sub, {
                    type: "user_typing",
                    chatRoomId: room.id,
                    role: "CUSTOMER",
                    isTyping: false
                  }, room.restaurantId, { roomType: room.type, channelKey: room.channelKey });
                  typingTimers.delete(room.id);
                }, 8000)
              );
            }
            return;
          }
          if (data.event === "messages_read" && data.chatRoomId) {
            try {
              await assertCustomerOwnsRoom(prisma, data.chatRoomId, {
                customerUserId: sub,
                sourceSessionId: sessionId || null
              });
            } catch {
              return;
            }
            const readAt = await markCustomerRead(prisma, data.chatRoomId, sub, sessionId || null);
            const readRoom = await prisma.chatRoom.findUnique({
              where: { id: data.chatRoomId },
              select: { restaurantId: true, type: true, channelKey: true }
            });
            emitChatEvent(chatBus, data.chatRoomId, sub, {
              type: "messages_read",
              chatRoomId: data.chatRoomId,
              readerRole: "CUSTOMER",
              readAt: readAt.toISOString()
            }, readRoom?.restaurantId, { roomType: readRoom?.type, channelKey: readRoom?.channelKey });
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
        for (const t of typingTimers.values()) clearTimeout(t);
        typingTimers.clear();
      });
    }
  );
}
