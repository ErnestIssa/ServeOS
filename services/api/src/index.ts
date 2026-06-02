import { EventEmitter } from "node:events";
import { loadServeOsEnv } from "@serveos/core-env";
loadServeOsEnv();

import { upstashRedisHealth } from "@serveos/core-upstash";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { authPlugin } from "./plugins/auth.js";
import { registerAuthRoutes } from "./routes/authRoutes.js";
import { registerRestaurantRoutes } from "./routes/restaurantRoutes.js";
import { registerRestaurantChatRoutes } from "./routes/restaurantChatRoutes.js";
import { registerOrderRoutes } from "./routes/orderRoutes.js";
import { registerCartRoutes } from "./routes/cartRoutes.js";
import { registerBusinessRoutes } from "./routes/businessRoutes.js";
import { registerCustomerRoutes } from "./routes/customerRoutes.js";
import { registerCustomerReservationRoutes } from "./routes/customerReservationRoutes.js";
import { registerCustomerChatRoutes } from "./routes/customerChatRoutes.js";
import { registerCustomerChatRealtime } from "./routes/customerChatRealtime.js";
import { registerRestaurantChatRealtime } from "./routes/restaurantChatRealtime.js";
import { ensureChatMessageImageEnum } from "./lib/chatImageEnum.js";

const port = Number(process.env.PORT ?? process.env.API_GATEWAY_PORT ?? 3000);
/** Render / Docker: set `HOST=0.0.0.0` so the service accepts external connections. */
const host = process.env.HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const orderBus = new EventEmitter();
orderBus.setMaxListeners(0);
const chatBus = new EventEmitter();
chatBus.setMaxListeners(0);

app.setErrorHandler((err: unknown, _req, reply) => {
  const e = err as {
    name?: string;
    statusCode?: number;
    status?: number;
    message?: string;
    meta?: Record<string, unknown>;
  };
  if (e?.name === "ZodError") {
    return reply.status(400).send({ ok: false, error: "validation_error" });
  }
  const code = e.statusCode ?? e.status ?? 500;
  const msg = e.message ?? "server_error";
  if (code >= 500) app.log.error(err);
  return reply.status(code).send({
    ok: false,
    error: String(msg),
    ...(e.meta && typeof e.meta === "object" ? { meta: e.meta } : {})
  });
});

async function main() {
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });

  await app.register(authPlugin);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await ensureChatMessageImageEnum(prisma);
      app.log.info("ChatMessageType.IMAGE enum ready");
      break;
    } catch (err) {
      app.log.error({ err, attempt }, "chat_image_enum_ensure_failed");
      if (attempt === 3) {
        app.log.warn("Chat routes will retry enum ensure per request; run prisma migrate deploy on the database");
      } else {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }

  app.get("/health", async () => {
    const redis = await upstashRedisHealth();
    const ok = redis.configured ? redis.ok : true;
    return {
      ok,
      service: "serveos-api",
      upstashRedis: redis.configured
        ? { configured: true, ok: redis.ok, ...(redis.error ? { error: redis.error } : {}) }
        : { configured: false, mode: "skipped" }
    };
  });

  app.get("/", async () => ({
    ok: true,
    name: "ServeOS API",
    deployment: "unified",
    endpoints: ["/health", "/auth/*", "/customer/*", "/customer/chat/*", "/restaurants/*", "/orders/*"]
  }));

  registerAuthRoutes(app, prisma);
  registerRestaurantRoutes(app, prisma);
  registerRestaurantChatRoutes(app, prisma, chatBus);
  registerCustomerRoutes(app, prisma);
  registerCustomerReservationRoutes(app, prisma);
  registerCustomerChatRoutes(app, prisma, chatBus);
  await registerOrderRoutes(app, prisma, orderBus, chatBus);
  registerCustomerChatRealtime(app, prisma, chatBus);
  registerRestaurantChatRealtime(app, prisma, chatBus);
  registerCartRoutes(app, prisma);
  registerBusinessRoutes(app);

  await app.listen({ port, host });
}

void main().catch((err) => {
  app.log.error({ err }, "fatal_startup_error");
  process.exitCode = 1;
});
