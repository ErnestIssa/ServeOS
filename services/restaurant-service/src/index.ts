import "dotenv/config";
import Fastify from "fastify";

const port = Number(process.env.RESTAURANT_SERVICE_PORT ?? 3002);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "restaurant-service" }));

app.get("/restaurants", async () => ({
  ok: true,
  restaurants: []
}));

await app.listen({ port, host });

