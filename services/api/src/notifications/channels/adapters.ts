import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  publishOrderEventToUpstash,
  publishUserNotificationToUpstash,
  type OrderEventPayload
} from "@serveos/core-upstash";
import { emitChatEvent, type ChatWsPayload } from "../../lib/chatRealtime.js";
import { roomOclEntity, type OclUpdatedPayload } from "../../lib/oclRealtime.js";
import type { DeliveryChannel, DomainEvent, InAppUserPayload, NotificationTarget } from "../types.js";

export type ChannelContext = {
  prisma: PrismaClient;
  log: FastifyBaseLogger;
  orderBus: EventEmitter;
  chatBus: EventEmitter;
  notificationBus: EventEmitter;
};

export type DeliveryResult = {
  status: "SENT" | "FAILED" | "SKIPPED";
  externalId?: string;
  error?: string;
};

export async function deliverInApp(
  ctx: ChannelContext,
  event: DomainEvent,
  target: NotificationTarget,
  inApp?: InAppUserPayload
): Promise<DeliveryResult> {
  try {
    if (event.type === "order.updated" || event.type === "order.created" || event.type === "order.delivered") {
      const p = event.payload;
      const payload: OrderEventPayload = {
        type: "order_updated",
        orderId: String(p.orderId ?? ""),
        restaurantId: String(p.restaurantId ?? event.restaurantId ?? ""),
        status: String(p.status ?? ""),
        totalCents: Number(p.totalCents ?? 0),
        restaurantName: typeof p.restaurantName === "string" ? p.restaurantName : undefined
      };
      const customerUserId = typeof p.customerUserId === "string" ? p.customerUserId : null;
      ctx.orderBus.emit(`order:${payload.orderId}`, payload);
      ctx.orderBus.emit(`restaurant:${payload.restaurantId}`, payload);
      if (customerUserId) ctx.orderBus.emit(`customer:${customerUserId}`, payload);
      await publishOrderEventToUpstash(payload, customerUserId);
    }

    if (event.type === "ocl.updated") {
      const p = event.payload;
      const entityType = p.entityType === "reservation" ? "reservation" : "order";
      const entityId = String(p.entityId ?? "");
      const restaurantId = String(p.restaurantId ?? event.restaurantId ?? "");
      const orderId = typeof p.orderId === "string" ? p.orderId : entityType === "order" ? entityId : undefined;
      const reservationId =
        typeof p.reservationId === "string" ? p.reservationId : entityType === "reservation" ? entityId : undefined;
      const customerUserId = typeof p.customerUserId === "string" ? p.customerUserId : null;
      const payload: OclUpdatedPayload = {
        type: "ocl_updated",
        entityType,
        entityId,
        restaurantId,
        orderId,
        reservationId
      };
      ctx.orderBus.emit(roomOclEntity(entityType, entityId), payload);
      if (orderId) ctx.orderBus.emit(`order:${orderId}`, payload);
      if (restaurantId) ctx.orderBus.emit(`restaurant:${restaurantId}`, payload);
      if (customerUserId) ctx.orderBus.emit(`customer:${customerUserId}`, payload);
    }

    if (event.type === "chat.message_sent") {
      const chatRoomId = String(event.payload.chatRoomId ?? "");
      const customerUserId =
        typeof event.payload.customerUserId === "string" ? event.payload.customerUserId : null;
      const wsPayload = event.payload.wsPayload as ChatWsPayload | undefined;
      if (chatRoomId && wsPayload) {
        emitChatEvent(ctx.chatBus, chatRoomId, customerUserId, wsPayload);
      }
    }

    if (target.kind === "user" && inApp) {
      ctx.notificationBus.emit(`user:${target.userId}`, inApp);
      await publishUserNotificationToUpstash(target.userId, inApp);
    }

    return { status: "SENT" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.log.warn({ err: msg, channel: "IN_APP", event: event.type }, "notification_in_app_failed");
    return { status: "FAILED", error: msg };
  }
}

/** Stub — plug FCM when `FCM_SERVER_KEY` is configured. */
export async function deliverPush(
  ctx: ChannelContext,
  _event: DomainEvent,
  target: NotificationTarget,
  inApp?: InAppUserPayload
): Promise<DeliveryResult> {
  if (!process.env.FCM_SERVER_KEY?.trim()) {
    ctx.log.info({ channel: "PUSH", target, title: inApp?.title }, "notification_push_stub");
    return { status: "SKIPPED", error: "fcm_not_configured" };
  }
  return { status: "SKIPPED", error: "fcm_adapter_not_implemented" };
}

/** Stub — plug Resend/SendGrid when `EMAIL_API_KEY` is configured. */
export async function deliverEmail(
  ctx: ChannelContext,
  event: DomainEvent,
  target: NotificationTarget,
  inApp?: InAppUserPayload
): Promise<DeliveryResult> {
  if (!process.env.EMAIL_API_KEY?.trim()) {
    ctx.log.info(
      {
        channel: "EMAIL",
        to: target.kind === "contact" ? target.email : target.userId,
        subject: inApp?.title ?? event.type,
        acceptUrl: event.payload.acceptUrl
      },
      "notification_email_stub"
    );
    return { status: "SKIPPED", error: "email_not_configured" };
  }
  return { status: "SKIPPED", error: "email_adapter_not_implemented" };
}

/** Stub — plug Twilio SMS when `TWILIO_ACCOUNT_SID` is set. */
export async function deliverSms(
  ctx: ChannelContext,
  event: DomainEvent,
  target: NotificationTarget,
  inApp?: InAppUserPayload
): Promise<DeliveryResult> {
  if (!process.env.TWILIO_ACCOUNT_SID?.trim()) {
    ctx.log.info(
      { channel: "SMS", to: target.kind === "contact" ? target.phone : "user", body: inApp?.body },
      "notification_sms_stub"
    );
    return { status: "SKIPPED", error: "sms_not_configured" };
  }
  return { status: "SKIPPED", error: "sms_adapter_not_implemented" };
}

/** Stub — plug Twilio WhatsApp when configured. */
export async function deliverWhatsApp(
  ctx: ChannelContext,
  event: DomainEvent,
  target: NotificationTarget,
  inApp?: InAppUserPayload
): Promise<DeliveryResult> {
  if (!process.env.TWILIO_WHATSAPP_FROM?.trim()) {
    ctx.log.info(
      { channel: "WHATSAPP", to: target.kind === "contact" ? target.phone : "user" },
      "notification_whatsapp_stub"
    );
    return { status: "SKIPPED", error: "whatsapp_not_configured" };
  }
  return { status: "SKIPPED", error: "whatsapp_adapter_not_implemented" };
}

export async function runChannelDelivery(
  channel: DeliveryChannel,
  ctx: ChannelContext,
  event: DomainEvent,
  target: NotificationTarget,
  inApp?: InAppUserPayload
): Promise<DeliveryResult> {
  switch (channel) {
    case "IN_APP":
      return deliverInApp(ctx, event, target, inApp);
    case "PUSH":
      return deliverPush(ctx, event, target, inApp);
    case "EMAIL":
      return deliverEmail(ctx, event, target, inApp);
    case "SMS":
      return deliverSms(ctx, event, target, inApp);
    case "WHATSAPP":
      return deliverWhatsApp(ctx, event, target, inApp);
    default:
      return { status: "SKIPPED", error: "unknown_channel" };
  }
}
