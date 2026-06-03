import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { startNotificationProcessor, type NotificationRuntime } from "./notificationProcessor.js";

export function initNotificationSystem(
  app: FastifyInstance,
  prisma: PrismaClient,
  buses: {
    domainEventBus: EventEmitter;
    orderBus: EventEmitter;
    chatBus: EventEmitter;
    notificationBus: EventEmitter;
  }
): NotificationRuntime {
  const runtime: NotificationRuntime = {
    prisma,
    log: app.log,
    orderBus: buses.orderBus,
    chatBus: buses.chatBus,
    notificationBus: buses.notificationBus
  };
  startNotificationProcessor(runtime, buses.domainEventBus);
  app.log.info("notification_processor_started");
  return runtime;
}
