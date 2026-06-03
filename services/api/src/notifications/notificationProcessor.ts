import { randomUUID } from "node:crypto";
import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { runChannelDelivery, type ChannelContext } from "./channels/adapters.js";
import { filterChannelsByPreferences, loadUserNotificationPrefs } from "./preferences.js";
import { resolveRecipients } from "./recipientResolver.js";
import { ROUTING_RULES } from "./routingRules.js";
import type { DomainEvent, InAppUserPayload, NotificationTarget } from "./types.js";

export type NotificationRuntime = ChannelContext;

export async function processDomainEvent(runtime: NotificationRuntime, event: DomainEvent): Promise<void> {
  const rule = ROUTING_RULES[event.type];
  if (!rule) {
    runtime.log.warn({ type: event.type }, "notification_no_route");
    return;
  }

  const targets = await resolveRecipients(runtime.prisma, rule.recipients, event);
  if (!targets.length) return;

  const title = rule.title(event.payload);
  const body = rule.body(event.payload);

  for (const target of targets) {
    await deliverToTarget(runtime, event, target, {
      category: rule.category,
      eventKey: event.type,
      title,
      body,
      priority: rule.priority,
      channels: rule.channels,
      restaurantId: event.restaurantId ?? null
    });
  }
}

async function deliverToTarget(
  runtime: NotificationRuntime,
  event: DomainEvent,
  target: NotificationTarget,
  meta: {
    category: (typeof ROUTING_RULES)[keyof typeof ROUTING_RULES]["category"];
    eventKey: string;
    title: string;
    body: string;
    priority: (typeof ROUTING_RULES)[keyof typeof ROUTING_RULES]["priority"];
    channels: (typeof ROUTING_RULES)[keyof typeof ROUTING_RULES]["channels"];
    restaurantId: string | null;
  }
): Promise<void> {
  if (target.kind === "contact") {
    const outbound = meta.channels.filter((c) => c !== "IN_APP");
    const stubPayload: InAppUserPayload = {
      notificationId: event.id,
      category: meta.category,
      eventKey: meta.eventKey,
      title: meta.title,
      body: meta.body,
      priority: meta.priority,
      payload: event.payload,
      createdAt: event.occurredAt
    };
    for (const channel of outbound) {
      await runChannelDelivery(channel, runtime, event, target, stubPayload);
    }
    return;
  }

  let channels = [...meta.channels];
  let notificationId: string | null = null;
  let inAppPayload: InAppUserPayload | undefined;

  if (target.kind === "user") {
    const prefs = await loadUserNotificationPrefs(runtime.prisma, target.userId);
    channels = filterChannelsByPreferences(channels, meta.priority, meta.category, prefs);

    const row = await runtime.prisma.notification.create({
      data: {
        userId: target.userId,
        restaurantId: meta.restaurantId,
        category: meta.category,
        eventKey: meta.eventKey,
        title: meta.title,
        body: meta.body,
        payload: event.payload as Prisma.InputJsonValue,
        priority: meta.priority,
        channels: channels as Prisma.InputJsonValue
      }
    });
    notificationId = row.id;
    inAppPayload = {
      notificationId: row.id,
      category: meta.category,
      eventKey: meta.eventKey,
      title: meta.title,
      body: meta.body,
      priority: meta.priority,
      payload: event.payload,
      createdAt: row.createdAt.toISOString()
    };
  }

  for (const channel of meta.channels) {
    const allowed = channels.includes(channel);
    const deliveryRow =
      notificationId && target.kind === "user"
        ? await runtime.prisma.notificationDelivery.create({
            data: {
              notificationId,
              channel,
              status: allowed ? "PENDING" : "SKIPPED",
              lastError: allowed ? null : "filtered_by_preferences"
            }
          })
        : null;

    if (!allowed) continue;

    const result = await runChannelDelivery(channel, runtime, event, target, inAppPayload);

    if (deliveryRow) {
      await runtime.prisma.notificationDelivery.update({
        where: { id: deliveryRow.id },
        data: {
          status: result.status,
          attempts: { increment: 1 },
          lastError: result.error ?? null,
          externalId: result.externalId ?? null
        }
      });
    }
  }
}

export function startNotificationProcessor(runtime: NotificationRuntime, bus: EventEmitter): void {
  bus.on("domain-event", (event: DomainEvent) => {
    void processDomainEvent(runtime, event).catch((err) => {
      runtime.log.error({ err, eventId: event.id, type: event.type }, "notification_process_failed");
    });
  });
}

export function createDomainEvent(
  type: DomainEvent["type"],
  payload: Record<string, unknown>,
  opts?: { restaurantId?: string | null; actorUserId?: string | null }
): DomainEvent {
  return {
    id: randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    restaurantId: opts?.restaurantId ?? null,
    actorUserId: opts?.actorUserId ?? null,
    payload
  };
}
