import "dotenv/config";
import Fastify from "fastify";

const port = Number(process.env.AUTH_SERVICE_PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "auth-service" }));

app.post("/login", async () => ({
  ok: true,
  token: "dev-token"
}));

await app.listen({ port, host });

