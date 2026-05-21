import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { staffPresenceConnect, staffPresenceDisconnect } from "../lib/restaurantPresence.js";

/** Staff device presence for customer chat header (Online / Offline). */
export function registerRestaurantChatRealtime(app: FastifyInstance, _prisma: PrismaClient, _chatBus: EventEmitter) {
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

      let role: string;
      try {
        const p = jwt.verify(token, secret) as { sub: string; role: string };
        role = p.role;
        if (role !== "OWNER" && role !== "STAFF") {
          socket.close();
          return;
        }
      } catch {
        socket.close();
        return;
      }

      staffPresenceConnect(restaurantId);

      socket.on("close", () => {
        staffPresenceDisconnect(restaurantId);
      });
    }
  );
}
