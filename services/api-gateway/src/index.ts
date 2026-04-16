import "dotenv/config";
import Fastify from "fastify";

const port = Number(process.env.API_GATEWAY_PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/", async () => ({
  ok: true,
  name: "ServeOS API Gateway",
  endpoints: ["/health"]
}));

await app.listen({ port, host });

