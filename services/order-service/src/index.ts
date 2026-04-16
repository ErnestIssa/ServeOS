import "dotenv/config";
import Fastify from "fastify";

const port = Number(process.env.ORDER_SERVICE_PORT ?? 3003);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "order-service" }));

app.get("/orders", async () => ({
  ok: true,
  orders: []
}));

await app.listen({ port, host });

