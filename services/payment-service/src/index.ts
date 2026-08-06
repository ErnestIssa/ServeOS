import "dotenv/config";
import Fastify from "fastify";

const port = Number(process.env.PAYMENT_SERVICE_PORT ?? 3004);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });

function envReady() {
  return {
    stripe: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    swish: Boolean(process.env.SWISH_PAYEE_ALIAS?.trim() || process.env.SWISH_CERT_PATH?.trim()),
    webhook: Boolean(process.env.PAYMENT_WEBHOOK_SECRET?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim())
  };
}

app.get("/health", async () => ({ ok: true, service: "payment-service" }));

app.get("/payments/providers", async () => {
  const ready = envReady();
  return {
    ok: true,
    providers: [
      {
        key: "stripe",
        label: "Stripe",
        connectedCapable: ready.stripe,
        methods: ["card", "apple_pay", "google_pay"],
        capabilities: ["payments", "refunds", "webhooks", "payouts"]
      },
      {
        key: "swish",
        label: "Swish",
        connectedCapable: ready.swish,
        methods: ["swish"],
        capabilities: ["payments", "refunds", "webhooks"]
      }
    ],
    envReady: ready
  };
});

app.get("/payments/capabilities", async () => ({
  ok: true,
  envReady: envReady(),
  note: "Live charges require provider SDKs + secrets. This service exposes capability metadata only."
}));

await app.listen({ port, host });
