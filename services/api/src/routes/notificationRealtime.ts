import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import jwt from "jsonwebtoken";
import type { InAppUserPayload } from "../notifications/types.js";

function roomUser(userId: string) {
  return `user:${userId}`;
}

export async function registerNotificationRealtime(
  app: FastifyInstance,
  notificationBus: EventEmitter
) {
  await app.register(websocket);

  app.get("/notifications/ws", { websocket: true }, (socket, req) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      socket.close(1011, "server_misconfigured");
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token")?.trim();
    if (!token) {
      socket.close(4401, "missing_token");
      return;
    }
    let userId: string;
    try {
      const pl = jwt.verify(token, secret) as { sub: string };
      userId = pl.sub;
    } catch {
      socket.close(4401, "invalid_token");
      return;
    }

    const channel = roomUser(userId);
    const onNotify = (payload: InAppUserPayload) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify({ type: "notification", ...payload }));
      }
    };
    notificationBus.on(channel, onNotify);
    socket.on("close", () => notificationBus.off(channel, onNotify));
    socket.send(JSON.stringify({ type: "connected", userId }));
  });
}
