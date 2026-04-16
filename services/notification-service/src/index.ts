import "dotenv/config";
import Fastify from "fastify";

const port = Number(process.env.NOTIFICATION_SERVICE_PORT ?? 3005);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "notification-service" }));

app.post("/notify", async () => ({
  ok: true,
  queued: true
}));

await app.listen({ port, host });

