import "dotenv/config";
import Fastify from "fastify";

const port = Number(process.env.PAYMENT_SERVICE_PORT ?? 3004);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "payment-service" }));

app.get("/payments/providers", async () => ({
  ok: true,
  providers: ["stripe", "swish"]
}));

await app.listen({ port, host });

