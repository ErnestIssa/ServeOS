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
import { registerOrderRoutes } from "./routes/orderRoutes.js";

const port = Number(process.env.PORT ?? process.env.API_GATEWAY_PORT ?? 3000);
/** Render / Docker: set `HOST=0.0.0.0` so the service accepts external connections. */
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const orderBus = new EventEmitter();
orderBus.setMaxListeners(0);

app.setErrorHandler((err: unknown, _req, reply) => {
  const e = err as { name?: string; statusCode?: number; status?: number; message?: string };
  if (e?.name === "ZodError") {
    return reply.status(400).send({ ok: false, error: "validation_error" });
  }
  const code = e.statusCode ?? e.status ?? 500;
  const msg = e.message ?? "server_error";
  if (code >= 500) app.log.error(err);
  return reply.status(code).send({ ok: false, error: String(msg) });
});

async function main() {
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });

  await app.register(authPlugin);

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
    endpoints: ["/health", "/auth/*", "/restaurants/*", "/orders/*"]
  }));

  registerAuthRoutes(app, prisma);
  registerRestaurantRoutes(app, prisma);
  await registerOrderRoutes(app, prisma, orderBus);

  await app.listen({ port, host });
}

void main().catch((err) => {
  app.log.error({ err }, "fatal_startup_error");
  process.exitCode = 1;
});
