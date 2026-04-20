import { loadServeOsEnv } from "@serveos/core-env";
loadServeOsEnv();

import Fastify from "fastify";
import cors from "@fastify/cors";
import httpProxy from "http-proxy";

const port = Number(process.env.API_GATEWAY_PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });
const proxy = httpProxy.createProxyServer({ ws: true });

const authUrl = process.env.AUTH_SERVICE_URL ?? `http://${host}:${Number(process.env.AUTH_SERVICE_PORT ?? 3001)}`;
const restaurantUrl =
  process.env.RESTAURANT_SERVICE_URL ?? `http://${host}:${Number(process.env.RESTAURANT_SERVICE_PORT ?? 3002)}`;
const orderUrl = process.env.ORDER_SERVICE_URL ?? `http://${host}:${Number(process.env.ORDER_SERVICE_PORT ?? 3003)}`;

await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
});

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/", async () => ({
  ok: true,
  name: "ServeOS API Gateway",
  endpoints: ["/health", "/auth/*", "/restaurants/*", "/orders/*"]
}));

proxy.on("error", (err, _req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = res as any;
  if (!r?.writeHead) return;
  r.writeHead(502, { "Content-Type": "application/json" });
  r.end(JSON.stringify({ ok: false, error: "bad_gateway" }));
});

app.all("/auth/*", async (req, reply) => {
  await new Promise<void>((resolve) => {
    proxy.web(req.raw, reply.raw, { target: authUrl, changeOrigin: true }, () => resolve());
  });
  reply.hijack();
});

app.all("/restaurants/*", async (req, reply) => {
  await new Promise<void>((resolve) => {
    proxy.web(req.raw, reply.raw, { target: restaurantUrl, changeOrigin: true }, () => resolve());
  });
  reply.hijack();
});

app.all("/orders/*", async (req, reply) => {
  await new Promise<void>((resolve) => {
    proxy.web(req.raw, reply.raw, { target: orderUrl, changeOrigin: true }, () => resolve());
  });
  reply.hijack();
});

await app.listen({ port, host });

app.server.on("upgrade", (req, socket, head) => {
  const path = (req.url ?? "").split("?")[0] ?? "";
  if (!path.startsWith("/orders/events")) {
    socket.destroy();
    return;
  }
  proxy.ws(req, socket, head, { target: orderUrl }, (err) => {
    if (err) {
      app.log.error({ err }, "websocket_proxy_error");
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    }
  });
});
