import "./instrument.js";

import { EventEmitter } from "node:events";
import { upstashRedisHealth } from "@serveos/core-upstash";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { authPlugin } from "./plugins/auth.js";
import { registerAuthRoutes } from "./routes/authRoutes.js";
import { registerRestaurantRoutes } from "./routes/restaurantRoutes.js";
import { registerRestaurantChatRoutes } from "./routes/restaurantChatRoutes.js";
import { registerOrderRoutes } from "./routes/orderRoutes.js";
import { registerCartRoutes } from "./routes/cartRoutes.js";
import { registerBusinessRoutes } from "./routes/businessRoutes.js";
import { registerWorkspaceDeploymentRoutes } from "./routes/workspaceDeploymentRoutes.js";
import { registerCustomerRoutes } from "./routes/customerRoutes.js";
import { registerMobileExperienceRoutes } from "./routes/mobileExperienceRoutes.js";
import { registerMobileWorkspaceRoutes } from "./routes/mobileWorkspaceRoutes.js";
import { registerStaffAccessRoutes } from "./routes/staffAccessRoutes.js";
import { registerCustomerReservationRoutes } from "./routes/customerReservationRoutes.js";
import { registerCustomerChatRoutes } from "./routes/customerChatRoutes.js";
import { registerCustomerChatRealtime } from "./routes/customerChatRealtime.js";
import { registerRestaurantChatRealtime } from "./routes/restaurantChatRealtime.js";
import { registerNotificationRoutes } from "./routes/notificationRoutes.js";
import { registerNotificationRealtime } from "./routes/notificationRealtime.js";
import { initNotificationSystem } from "./notifications/initNotifications.js";
import { ensureChatMessageImageEnum } from "./lib/chatImageEnum.js";
import { isAuthTokenRevoked } from "./lib/authTokenRevocation.js";
import { isSessionRevoked } from "./lib/account/sessionService.js";
import { assertBearerUserStillActive } from "./lib/auth/authAccessGuard.js";
import { registerMeRoutes } from "./routes/meRoutes.js";
import { registerMediaRoutes } from "./routes/mediaRoutes.js";
import { captureApiError, captureException, flushSentry } from "./lib/integrations/sentry.js";
import { isCloudflareCdnConfigured } from "./lib/integrations/cloudflareCdn.js";
import { isObjectStorageConfigured } from "./lib/integrations/objectStorage.js";
import { isSmsProviderConfigured } from "./lib/integrations/smsProvider.js";
import { apiErrorMessage, apiFail, enrichApiPayload } from "./lib/apiErrors.js";
import { registerConfigRoutes } from "./routes/configRoutes.js";
import { registerCommunicationRoutes } from "./routes/communicationRoutes.js";
import { registerWorkspaceEnrollmentRoutes } from "./routes/workspaceEnrollmentRoutes.js";
import { registerWorkspaceProvisioningRoutes } from "./routes/workspaceProvisioningRoutes.js";
import { registerTrustRoutes } from "./routes/trustRoutes.js";
import { startOrderOutboxProcessor } from "./lib/orders/orderOutboxProcessor.js";
import { startOrderRecoveryProcessor } from "./lib/orders/orderRecoveryService.js";

const port = Number(process.env.PORT ?? process.env.API_GATEWAY_PORT ?? 3000);
/** Render / Docker: set `HOST=0.0.0.0` so the service accepts external connections. */
const host = process.env.HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const orderBus = new EventEmitter();
orderBus.setMaxListeners(0);
const chatBus = new EventEmitter();
chatBus.setMaxListeners(0);
const domainEventBus = new EventEmitter();
domainEventBus.setMaxListeners(0);
const notificationBus = new EventEmitter();
notificationBus.setMaxListeners(0);

app.setErrorHandler((err: unknown, req, reply) => {
  const e = err as {
    name?: string;
    statusCode?: number;
    status?: number;
    message?: string;
    meta?: Record<string, unknown>;
  };
  if (e?.name === "ZodError") {
    return reply.status(400).send({ ok: false, error: "validation_error", message: apiErrorMessage("validation_error") });
  }
  const code = e.statusCode ?? e.status ?? 500;
  const msg = e.message ?? "server_error";
  const errorCode = String(msg);
  if (code >= 500) {
    app.log.error(err);
    captureException(err, { req, statusCode: code });
  }
  return reply.status(code).send({
    ok: false,
    error: errorCode,
    message: apiErrorMessage(errorCode),
    ...(e.meta && typeof e.meta === "object" ? { meta: e.meta } : {})
  });
});

app.addHook("onSend", async (_req, _reply, payload) => {
  if (typeof payload !== "string") return payload;
  try {
    const parsed = JSON.parse(payload) as { ok?: boolean; error?: string; message?: string };
    if (parsed && typeof parsed === "object" && parsed.ok === false && parsed.error) {
      return JSON.stringify(enrichApiPayload(parsed));
    }
  } catch {
    /* not JSON */
  }
  return payload;
});

app.addHook("onResponse", async (req, reply) => {
  if (reply.statusCode >= 500) {
    captureApiError({ req, statusCode: reply.statusCode });
  }
});

async function main() {
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });

  await app.register(authPlugin);

  app.addHook("onRequest", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return;
    const token = auth.slice("Bearer ".length).trim();
    if (!token) return;
    if (await isAuthTokenRevoked(token)) {
      return reply.status(401).send(apiFail("token_revoked"));
    }
    if (await isSessionRevoked(prisma, token)) {
      return reply.status(401).send(apiFail("session_revoked"));
    }

    const publicAuthPaths = [
      "/auth/login",
      "/auth/signup",
      "/auth/password-reset",
      "/workspace-enrollment",
      "/communication-preferences",
      "/health",
      "/config/client"
    ];
    if (publicAuthPaths.some((p) => req.url.startsWith(p))) return;

    try {
      const payload = app.verifyJwt(token);
      const active = await assertBearerUserStillActive(prisma, payload.sub);
      if (!active.ok) {
        return reply.status(403).send(apiFail(active.error));
      }
    } catch {
      /* Route-level auth handles invalid JWT */
    }
  });

  await app.register(websocket);

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
      sentry: { configured: Boolean(process.env.SENTRY_DSN?.trim()) },
      fcm: { configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() || process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()) },
      objectStorage: { configured: isObjectStorageConfigured() },
      cloudflareCdn: { configured: isCloudflareCdnConfigured() },
      sms: { configured: isSmsProviderConfigured() },
      upstashRedis: redis.configured
        ? { configured: true, ok: redis.ok, ...(redis.error ? { error: redis.error } : {}) }
        : { configured: false, mode: "skipped" }
    };
  });

  app.get("/", async () => ({
    ok: true,
    name: "ServeOS API",
    deployment: "unified",
    endpoints: [
      "/health",
      "/config/client",
      "/auth/*",
      "/auth/password-reset/*",
      "/me/*",
      "/media/*",
      "/customer/*",
      "/customer/context",
      "/mobile/experience",
      "/customer/chat/*",
      "/restaurants/*",
      "/orders/*",
      "/trust/*",
      "/cart/*",
      "/notifications/*",
      "/workspace-deployment/*"
    ]
  }));

  initNotificationSystem(app, prisma, {
    domainEventBus,
    orderBus,
    chatBus,
    notificationBus
  });

  registerConfigRoutes(app);
  registerCommunicationRoutes(app, prisma);
  registerWorkspaceEnrollmentRoutes(app, prisma, domainEventBus);
  registerWorkspaceProvisioningRoutes(app, prisma);
  registerAuthRoutes(app, prisma, domainEventBus);
  registerMeRoutes(app, prisma);
  registerMediaRoutes(app, prisma);
  registerMobileExperienceRoutes(app, prisma);
  registerMobileWorkspaceRoutes(app, prisma, chatBus, domainEventBus);
  registerStaffAccessRoutes(app, prisma, domainEventBus);
  registerRestaurantRoutes(app, prisma);
  registerRestaurantChatRoutes(app, prisma, chatBus);
  registerCustomerRoutes(app, prisma);
  registerCustomerReservationRoutes(app, prisma);
  registerCustomerChatRoutes(app, prisma, chatBus, domainEventBus);
  await registerOrderRoutes(app, prisma, orderBus, chatBus, domainEventBus);
  startOrderOutboxProcessor(prisma, { domainEventBus, orderBus }, app.log);
  startOrderRecoveryProcessor(prisma, { domainEventBus, orderBus }, app.log);
  registerTrustRoutes(app, prisma, domainEventBus);
  registerCustomerChatRealtime(app, prisma, chatBus);
  registerRestaurantChatRealtime(app, prisma, chatBus);
  registerNotificationRoutes(app, prisma, domainEventBus);
  registerNotificationRealtime(app, notificationBus);
  registerCartRoutes(app, prisma);
  registerBusinessRoutes(app);
  registerWorkspaceDeploymentRoutes(app, prisma);

  await app.listen({ port, host });
}

void main().catch(async (err) => {
  app.log.error({ err }, "fatal_startup_error");
  captureException(err, { tags: { area: "startup" } });
  await flushSentry();
  process.exitCode = 1;
});
