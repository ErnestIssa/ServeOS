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
import { isEmailProviderConfigured } from "../../lib/integrations/emailProvider.js";
import { sendNotificationEmail } from "../../lib/integrations/transactionalEmails.js";
import { isPushProviderConfigured } from "../../lib/integrations/pushProvider.js";
import { sendPushToUser } from "../../lib/deviceTokenService.js";
import { isSmsProviderConfigured, sendSms } from "../../lib/integrations/smsProvider.js";

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

/** Firebase Admin SDK (FCM HTTP v1) push delivery. */
export async function deliverPush(
  ctx: ChannelContext,
  event: DomainEvent,
  target: NotificationTarget,
  inApp?: InAppUserPayload
): Promise<DeliveryResult> {
  if (!isPushProviderConfigured()) {
    return { status: "SKIPPED", error: "fcm_not_configured" };
  }
  if (target.kind !== "user") {
    return { status: "SKIPPED", error: "push_requires_user_target" };
  }

  const title = inApp?.title ?? "ServeOS";
  const body = inApp?.body ?? "";
  const data: Record<string, string> = {
    eventType: event.type,
    ...(inApp?.notificationId ? { notificationId: inApp.notificationId } : {}),
    ...(inApp?.category ? { category: inApp.category } : {}),
    ...(inApp?.eventKey ? { eventKey: inApp.eventKey } : {}),
    ...(event.restaurantId ? { restaurantId: event.restaurantId } : {}),
    ...(typeof event.payload.orderId === "string" ? { orderId: event.payload.orderId } : {}),
    ...(typeof event.payload.chatRoomId === "string" ? { chatRoomId: event.payload.chatRoomId } : {})
  };

  try {
    const result = await sendPushToUser(ctx.prisma, target.userId, { title, body, data });
    if (result.status === "SENT") {
      return { status: "SENT", externalId: result.externalId };
    }
    if (result.status === "SKIPPED") {
      ctx.log.info({ channel: "PUSH", userId: target.userId, title }, "notification_push_skipped");
      return { status: "SKIPPED", error: result.error };
    }
    ctx.log.warn({ channel: "PUSH", userId: target.userId, err: result.error }, "notification_push_failed");
    return { status: "FAILED", error: result.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.log.warn({ err: msg, channel: "PUSH", event: event.type }, "notification_push_failed");
    return { status: "FAILED", error: msg };
  }
}

async function resolveTargetEmail(
  ctx: ChannelContext,
  target: NotificationTarget
): Promise<string | null> {
  if (target.kind === "contact") return target.email?.trim().toLowerCase() ?? null;
  const user = await ctx.prisma.user.findUnique({
    where: { id: target.userId },
    select: { email: true }
  });
  return user?.email?.trim().toLowerCase() ?? null;
}

/** Resend-backed notification email delivery. */
export async function deliverEmail(
  ctx: ChannelContext,
  event: DomainEvent,
  target: NotificationTarget,
  inApp?: InAppUserPayload
): Promise<DeliveryResult> {
  if (!isEmailProviderConfigured()) {
    return { status: "FAILED", error: "resend_not_configured" };
  }

  const to = await resolveTargetEmail(ctx, target);
  if (!to) return { status: "SKIPPED", error: "no_email" };

  const title = inApp?.title ?? "ServeOS notification";
  const body = inApp?.body ?? "";
  const acceptUrl = typeof event.payload.acceptUrl === "string" ? event.payload.acceptUrl : undefined;

  try {
    const result = await sendNotificationEmail({
      to,
      subject: title,
      title,
      body,
      actionUrl: acceptUrl,
      actionLabel: acceptUrl ? "Open in ServeOS" : undefined
    });
    return { status: "SENT", externalId: result.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.log.warn({ err: msg, channel: "EMAIL", event: event.type, to }, "notification_email_failed");
    return { status: "FAILED", error: msg };
  }
}

/** Twilio SMS — staff invites, system alerts; skipped when not configured or trial-unverified. */
export async function deliverSms(
  ctx: ChannelContext,
  event: DomainEvent,
  target: NotificationTarget,
  inApp?: InAppUserPayload
): Promise<DeliveryResult> {
  if (!isSmsProviderConfigured()) {
    return { status: "SKIPPED", error: "sms_not_configured" };
  }

  const phone =
    target.kind === "contact"
      ? target.phone?.trim()
      : (
          await ctx.prisma.user.findUnique({
            where: { id: target.userId },
            select: { phone: true }
          })
        )?.phone?.trim();

  if (!phone) return { status: "SKIPPED", error: "no_phone" };

  let text = inApp?.body ?? "";
  const acceptUrl = typeof event.payload.acceptUrl === "string" ? event.payload.acceptUrl : undefined;
  if (acceptUrl && !text.includes(acceptUrl)) {
    text = `${text} ${acceptUrl}`.trim();
  }
  if (inApp?.title && event.type === "staff.invited") {
    text = `ServeOS: ${inApp.title}. ${text}`.trim();
  } else if (inApp?.title && event.type === "system.alert") {
    text = `ServeOS alert: ${inApp.title}. ${text}`.trim();
  }

  try {
    const result = await sendSms({ to: phone, body: text });
    if (result.skipped) return { status: "SKIPPED", error: "sms_not_configured" };
    if (!result.ok) {
      if (result.error === "sms_trial_unverified_number") {
        ctx.log.info({ channel: "SMS", to: phone, event: event.type }, "notification_sms_trial_unverified");
        return { status: "SKIPPED", error: result.error };
      }
      ctx.log.warn({ channel: "SMS", to: phone, err: result.error, event: event.type }, "notification_sms_failed");
      return { status: "FAILED", error: result.error ?? "sms_send_failed" };
    }
    return { status: "SENT", externalId: result.messageSid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.log.warn({ err: msg, channel: "SMS", event: event.type }, "notification_sms_failed");
    return { status: "FAILED", error: msg };
  }
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
