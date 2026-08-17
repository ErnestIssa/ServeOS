import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { staffPresenceConnect, staffPresenceDisconnect } from "../lib/venue/restaurantPresence.js";
import { roomStaffChannel, roomVenueChat, type ChatWsPayload } from "../lib/chat/chatRealtime.js";
import { allowedStaffChannelKeys } from "../lib/chat/chatAccess.js";
import { limitChatWsConnect } from "../lib/chat/chatRateLimit.js";

/** Staff/admin venue chat + presence. Customers cannot subscribe. */
export function registerRestaurantChatRealtime(
  app: FastifyInstance,
  prisma: PrismaClient,
  chatBus: EventEmitter
) {
  app.get(
    "/restaurants/chat/events",
    { websocket: true },
    async (socket, req) => {
      const q = req.query as { token?: string; restaurantId?: string };
      const token = typeof q.token === "string" ? q.token : "";
      const restaurantId = typeof q.restaurantId === "string" ? q.restaurantId.trim() : "";
      const secret = process.env.JWT_SECRET;
      if (!secret || !token || !restaurantId) {
        socket.close();
        return;
      }

      let userId: string;
      try {
        const p = jwt.verify(token, secret) as { sub: string; role: string };
        userId = p.sub;
        if (p.role === "CUSTOMER") {
          socket.close();
          return;
        }
      } catch {
        socket.close();
        return;
      }

      const limited = await limitChatWsConnect(userId);
      if (!limited.ok) {
        socket.close();
        return;
      }

      const membership = await prisma.membership.findFirst({
        where: { userId, restaurantId, status: "ACTIVE" },
        select: { id: true, role: true }
      });
      if (!membership) {
        socket.close();
        return;
      }

      staffPresenceConnect(restaurantId);

      const venueRoom = roomVenueChat(restaurantId);
      const staffRooms = allowedStaffChannelKeys(membership.role).map((key) =>
        roomStaffChannel(restaurantId, key)
      );
      const send = (payload: ChatWsPayload) => {
        if (socket.readyState === 1) socket.send(JSON.stringify(payload));
      };
      chatBus.on(venueRoom, send);
      for (const room of staffRooms) chatBus.on(room, send);

      socket.on("close", () => {
        chatBus.off(venueRoom, send);
        for (const room of staffRooms) chatBus.off(room, send);
        staffPresenceDisconnect(restaurantId);
      });
    }
  );
}
