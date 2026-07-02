import type { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { readPreferredRestaurantIdFromProfile } from "../lib/customerPreferredVenue.js";
import { autoTerminateStaleActiveOrdersForCustomer } from "../lib/autoTerminateStaleActiveOrders.js";
import {
  buildImageDataUri,
  CHAT_ALLOWED_IMAGE_MIMES,
  CHAT_IMAGE_MAX_BASE64_CHARS,
  CHAT_MAX_IMAGES_PER_ROOM,
  CHAT_MAX_IMAGES_PER_SEND,
  parseImageDataUri,
  type ChatImageMime
} from "../lib/chatImageLimits.js";
import {
  createChatImageMessages,
  createChatTextMessage,
  listRoomMessages,
  markCustomerRead,
  serializeMessage,
  serializeMessages
} from "../lib/chatMessageService.js";
import type { ChatWsPayload } from "../lib/chatRealtime.js";
import { notifyChatMessage } from "../notifications/integrations/chat.js";
import { splitRoomMessagesForOcl, buildCustomerHubTimeline } from "../lib/orderOcl.js";
import {
  buildThreadFeed,
  ensureCustomerChatRoom,
  estimateOrderMinutesRemaining,
  hubCopyForScene,
  orderStatusCustomerLabel,
  pickActiveOrderForVenue,
  quickActionsForScene,
  resolveCustomerChatScene,
  syncOrderRoomSystemMessage,
  type CustomerChatScene,
  type ThreadFeedItem
} from "../lib/customerChatHub.js";
import { isRestaurantStaffOnline } from "../lib/restaurantPresence.js";
import { buildVenueStatusPayload } from "../lib/venueHoursStatus.js";
import { countCustomerChatImagesInRoom, ensureChatMessageImageEnum } from "../lib/chatImageEnum.js";
import { countCustomerChatUnread, countRoomUnreadForCustomer } from "../lib/chatUnread.js";
import { buildCustomerChatOverview } from "../lib/customerChatOverview.js";

function bearerToken(headers: { authorization?: string }): string | null {
  const auth = headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length);
}

const hubQuerySchema = z.object({
  restaurantId: z.string().min(1).optional()
});

const postMessageSchema = z.object({
  restaurantId: z.string().min(1),
  content: z.string().min(1).max(2000),
  orderId: z.string().min(1).optional()
});

const postImagesSchema = z.object({
  restaurantId: z.string().min(1),
  orderId: z.string().min(1).optional(),
  images: z
    .array(
      z.object({
        mimeType: z.enum(CHAT_ALLOWED_IMAGE_MIMES),
        dataBase64: z.string().min(32).max(CHAT_IMAGE_MAX_BASE64_CHARS)
      })
    )
    .min(1)
    .max(CHAT_MAX_IMAGES_PER_SEND)
});

export function registerCustomerChatRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  _chatBus: EventEmitter,
  domainEventBus: EventEmitter
) {
  async function pushChatMessage(input: {
    chatRoomId: string;
    restaurantId: string;
    customerUserId: string | null;
    actorUserId: string;
    message: { content?: string | null };
    wsPayload: ChatWsPayload;
  }) {
    const preview =
      typeof input.message.content === "string" && input.message.content.trim()
        ? input.message.content.trim().slice(0, 120)
        : "New message";
    await notifyChatMessage(domainEventBus, {
      chatRoomId: input.chatRoomId,
      restaurantId: input.restaurantId,
      customerUserId: input.customerUserId,
      actorUserId: input.actorUserId,
      preview,
      wsPayload: input.wsPayload
    });
  }
  app.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith("/customer/chat")) return;
    try {
      await ensureChatMessageImageEnum(prisma);
    } catch {
      return reply.status(503).send({
        ok: false,
        error: "chat_schema_not_ready",
        message: "Chat photo support is still initializing. Retry in a moment."
      });
    }
  });

  app.get("/customer/chat/unread-count", async (req, reply) => {
    const tok = bearerToken(req.headers as { authorization?: string });
    if (!tok) return reply.status(401).send({ ok: false, error: "missing_token" });
    const pl = app.verifyJwt(tok);
    if (pl.role !== "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_only" });
    }
    const unreadCount = await countCustomerChatUnread(prisma, pl.sub);
    return { ok: true, unreadCount };
  });

  app.get("/customer/chat/overview", async (req, reply) => {
    const tok = bearerToken(req.headers as { authorization?: string });
    if (!tok) return reply.status(401).send({ ok: false, error: "missing_token" });
    const pl = app.verifyJwt(tok);
    if (pl.role !== "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_only" });
    }
    const overview = await buildCustomerChatOverview(prisma, pl.sub);
    return { ok: true, ...overview };
  });

  app.get("/customer/chat/hub", async (req, reply) => {
    const tok = bearerToken(req.headers as { authorization?: string });
    if (!tok) return reply.status(401).send({ ok: false, error: "missing_token" });
    const pl = app.verifyJwt(tok);
    if (pl.role !== "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_only" });
    }

    const parsed = hubQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation_error" });
    }

    const user = await prisma.user.findUnique({
      where: { id: pl.sub },
      select: { id: true, signupProfile: true }
    });
    if (!user) return reply.status(404).send({ ok: false, error: "user_not_found" });

    let restaurantId =
      parsed.data.restaurantId?.trim() || readPreferredRestaurantIdFromProfile(user.signupProfile) || "";

    await autoTerminateStaleActiveOrdersForCustomer(prisma, pl.sub, new Date());

    const orders = await prisma.order.findMany({
      where: { customerUserId: pl.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        restaurant: { select: { id: true, name: true } },
        lines: true
      }
    });

    const orderRows = orders.map((o) => ({
      id: o.id,
      restaurantId: o.restaurantId,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      note: o.note ?? null,
      restaurant: o.restaurant,
      lines: o.lines.map((l) => ({
        menuItemId: l.menuItemId,
        nameSnapshot: l.nameSnapshot,
        quantity: l.quantity,
        lineTotalCents: l.lineTotalCents
      }))
    }));

    const activeOrder = pickActiveOrderForVenue(orderRows, restaurantId);
    if (!restaurantId && activeOrder) restaurantId = activeOrder.restaurantId;
    if (!restaurantId) {
      const last = orderRows[0];
      if (last) restaurantId = last.restaurantId;
    }

    if (!restaurantId) {
      return {
        ok: true,
        scene: "new" as CustomerChatScene,
        needsVenue: true,
        copy: hubCopyForScene("new"),
        quickActions: quickActionsForScene("new"),
        restaurant: null,
        cart: null,
        activeOrder: null,
        recentOrders: [],
        timeline: [],
        messages: [],
        threadFeed: [],
        chatRoomId: null,
        composerHint: "Choose a venue in Orders to message the restaurant.",
        venueStatus: buildVenueStatusPayload(null, false)
      };
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, openingHours: true }
    });
    if (!restaurant) return reply.status(404).send({ ok: false, error: "restaurant_not_found" });

    const cart = await prisma.shoppingCart.findUnique({
      where: { userId_restaurantId: { userId: pl.sub, restaurantId } },
      include: {
        lines: {
          include: { menuItem: { select: { id: true, name: true } } }
        }
      }
    });

    let cartPayload: {
      lineCount: number;
      totalQuantity: number;
      subtotalCents: number;
      lines: Array<{ id: string; name: string; quantity: number; lineTotalCents: number }>;
    } | null = null;

    if (cart && cart.lines.length > 0) {
      let subtotalCents = 0;
      let totalQuantity = 0;
      const lines = cart.lines.map((line) => {
        const lineTotal = line.menuItem.priceCents * line.quantity;
        subtotalCents += lineTotal;
        totalQuantity += line.quantity;
        return {
          id: line.id,
          name: line.menuItem.name,
          quantity: line.quantity,
          lineTotalCents: lineTotal
        };
      });
      cartPayload = { lineCount: lines.length, totalQuantity, subtotalCents, lines };
    }

    const hasCompletedOrders = orderRows.some((o) => o.status === "COMPLETED" || o.status === "CANCELLED");
    const scene = resolveCustomerChatScene({
      cartLineCount: cartPayload?.lineCount ?? 0,
      activeOrder: activeOrder ?? null,
      hasCompletedOrders
    });

    const copy = hubCopyForScene(scene);
    const quickActions = quickActionsForScene(scene);

    const chatRoomId = await ensureCustomerChatRoom(prisma, {
      scene,
      restaurantId,
      customerUserId: pl.sub,
      orderId: activeOrder?.id
    });

    if (scene === "active_order" && activeOrder) {
      const seeded = await syncOrderRoomSystemMessage(
        prisma,
        chatRoomId,
        activeOrder.status,
        activeOrder.restaurant.name
      );
      if (seeded) {
        const room = await prisma.chatRoom.findUnique({ where: { id: chatRoomId } });
        const serializedSeed = await serializeMessage(
          seeded,
          { userId: pl.sub, role: "CUSTOMER" },
          {
            restaurantLastReadAt: room?.restaurantLastReadAt ?? null,
            customerLastReadAt: room?.customerLastReadAt ?? null
          }
        );
        await pushChatMessage({
          chatRoomId,
          restaurantId: activeOrder.restaurantId,
          customerUserId: pl.sub,
          actorUserId: pl.sub,
          message: serializedSeed,
          wsPayload: { type: "new_message", message: serializedSeed }
        });
      }
    }

    const roomRow = await prisma.chatRoom.findUnique({ where: { id: chatRoomId } });
    const rawRows = await prisma.chatMessage.findMany({
      where: { chatRoomId },
      orderBy: { createdAt: "asc" },
      take: 120
    });
    const { humanIds } = splitRoomMessagesForOcl(rawRows);
    const serialized = await serializeMessages(
      rawRows.filter((m) => humanIds.has(m.id)),
      { userId: pl.sub, role: "CUSTOMER" },
      {
        restaurantLastReadAt: roomRow?.restaurantLastReadAt ?? null,
        customerLastReadAt: roomRow?.customerLastReadAt ?? null
      }
    );
    const messages: ThreadFeedItem[] = serialized.map((m) => ({ kind: "message" as const, ...m }));
    const threadFeed = buildThreadFeed(messages);
    const timeline =
      scene === "active_order" && activeOrder
        ? buildCustomerHubTimeline(activeOrder.status, restaurant.name, rawRows)
        : [];
    const roomUnreadCount = await countRoomUnreadForCustomer(prisma, chatRoomId, pl.sub);
    const customerImageCount = await countCustomerChatImagesInRoom(prisma, chatRoomId);

    const recentOrders = orderRows
      .filter((o) => o.restaurantId === restaurantId && (o.status === "COMPLETED" || o.status === "CANCELLED"))
      .slice(0, 3)
      .map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.totalCents,
        createdAt: o.createdAt.toISOString(),
        restaurant: o.restaurant,
        lines: o.lines.map((l) => ({
          menuItemId: l.menuItemId,
          name: l.nameSnapshot,
          quantity: l.quantity,
          lineTotalCents: l.lineTotalCents
        }))
      }));

    let activeOrderPayload: Record<string, unknown> | null = null;
    if (activeOrder && activeOrder.restaurantId === restaurantId) {
      const statusUi = orderStatusCustomerLabel(activeOrder.status);
      const eta = estimateOrderMinutesRemaining(activeOrder.status, activeOrder.createdAt, activeOrder.updatedAt);
      activeOrderPayload = {
        id: activeOrder.id,
        shortLabel: activeOrder.id.replace(/\s/g, "").slice(-6).toUpperCase(),
        status: activeOrder.status,
        statusLabel: statusUi.label,
        statusEmoji: statusUi.emoji,
        estimatedMinutes: eta,
        totalCents: activeOrder.totalCents,
        createdAt: activeOrder.createdAt.toISOString(),
        updatedAt: activeOrder.updatedAt.toISOString(),
        restaurant: activeOrder.restaurant,
        lines: activeOrder.lines.map((l) => ({
          menuItemId: l.menuItemId,
          name: l.nameSnapshot,
          quantity: l.quantity,
          lineTotalCents: l.lineTotalCents
        }))
      };
    }

    const composerHint =
      scene === "cart"
        ? "Ask about ingredients or special requests before you checkout."
        : scene === "active_order"
          ? "Message the restaurant about this order."
          : scene === "completed_only"
            ? "Ask a question or request help with a past visit."
            : "Say hello — the restaurant can reply here when messaging is enabled.";

    return {
      ok: true,
      scene,
      needsVenue: false,
      copy,
      quickActions,
      composerHint,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        openingHours: restaurant.openingHours
      },
      cart: cartPayload,
      activeOrder: activeOrderPayload,
      recentOrders,
      timeline,
      messages,
      threadFeed,
      chatRoomId,
      customerLastReadAt: roomRow?.customerLastReadAt?.toISOString() ?? null,
      roomUnreadCount,
      chatImageQuota: {
        used: customerImageCount,
        max: CHAT_MAX_IMAGES_PER_ROOM,
        perSend: CHAT_MAX_IMAGES_PER_SEND
      },
      venueTyping: false,
      venueStatus: buildVenueStatusPayload(
        restaurant.openingHours,
        isRestaurantStaffOnline(restaurant.id)
      )
    };
  });

  app.post("/customer/chat/messages", async (req, reply) => {
    const tok = bearerToken(req.headers as { authorization?: string });
    if (!tok) return reply.status(401).send({ ok: false, error: "missing_token" });
    const pl = app.verifyJwt(tok);
    if (pl.role !== "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_only" });
    }

    const parsed = postMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation_error" });
    }

    const { restaurantId, content, orderId } = parsed.data;

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return reply.status(404).send({ ok: false, error: "restaurant_not_found" });

    let scene: CustomerChatScene = "new";
    let resolvedOrderId: string | undefined;

    if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.customerUserId !== pl.sub) {
        return reply.status(404).send({ ok: false, error: "order_not_found" });
      }
      if (order.restaurantId !== restaurantId) {
        return reply.status(400).send({ ok: false, error: "order_venue_mismatch" });
      }
      scene = "active_order";
      resolvedOrderId = order.id;
    } else {
      const orders = await prisma.order.findMany({
        where: { customerUserId: pl.sub, restaurantId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { restaurant: { select: { id: true, name: true } }, lines: true }
      });
      const orderRows = orders.map((o) => ({
        id: o.id,
        restaurantId: o.restaurantId,
        status: o.status,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        note: o.note ?? null,
        restaurant: o.restaurant,
        lines: o.lines.map((l) => ({
          menuItemId: l.menuItemId,
          nameSnapshot: l.nameSnapshot,
          quantity: l.quantity,
          lineTotalCents: l.lineTotalCents
        }))
      }));
      const active = pickActiveOrderForVenue(orderRows, restaurantId);
      const cart = await prisma.shoppingCart.findUnique({
        where: { userId_restaurantId: { userId: pl.sub, restaurantId } },
        include: { lines: true }
      });
      const hasCompleted = orderRows.some((o) => o.status === "COMPLETED" || o.status === "CANCELLED");
      scene = resolveCustomerChatScene({
        cartLineCount: cart?.lines.length ?? 0,
        activeOrder: active,
        hasCompletedOrders: hasCompleted
      });
      resolvedOrderId = active?.id;
    }

    const chatRoomId = await ensureCustomerChatRoom(prisma, {
      scene,
      restaurantId,
      customerUserId: pl.sub,
      orderId: resolvedOrderId
    });

    const row = await createChatTextMessage(prisma, {
      chatRoomId,
      senderUserId: pl.sub,
      senderRole: "CUSTOMER",
      content
    });

    const room = await prisma.chatRoom.findUnique({ where: { id: chatRoomId } });
    const message = await serializeMessage(row, { userId: pl.sub, role: "CUSTOMER" }, {
      restaurantLastReadAt: room?.restaurantLastReadAt ?? null,
      customerLastReadAt: room?.customerLastReadAt ?? null
    });

    await pushChatMessage({
      chatRoomId,
      restaurantId,
      customerUserId: pl.sub,
      actorUserId: pl.sub,
      message,
      wsPayload: { type: "new_message", message }
    });

    return { ok: true, message };
  });

  app.post("/customer/chat/messages/images", async (req, reply) => {
    const tok = bearerToken(req.headers as { authorization?: string });
    if (!tok) return reply.status(401).send({ ok: false, error: "missing_token" });
    const pl = app.verifyJwt(tok);
    if (pl.role !== "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_only" });
    }

    const parsed = postImagesSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation_error" });
    }

    const { restaurantId, orderId, images } = parsed.data;
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return reply.status(404).send({ ok: false, error: "restaurant_not_found" });

    let scene: CustomerChatScene = "new";
    let resolvedOrderId: string | undefined;

    if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.customerUserId !== pl.sub) {
        return reply.status(404).send({ ok: false, error: "order_not_found" });
      }
      if (order.restaurantId !== restaurantId) {
        return reply.status(400).send({ ok: false, error: "order_venue_mismatch" });
      }
      scene = "active_order";
      resolvedOrderId = order.id;
    } else {
      const orders = await prisma.order.findMany({
        where: { customerUserId: pl.sub, restaurantId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { restaurant: { select: { id: true, name: true } }, lines: true }
      });
      const orderRows = orders.map((o) => ({
        id: o.id,
        restaurantId: o.restaurantId,
        status: o.status,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        note: o.note ?? null,
        restaurant: o.restaurant,
        lines: o.lines.map((l) => ({
          menuItemId: l.menuItemId,
          nameSnapshot: l.nameSnapshot,
          quantity: l.quantity,
          lineTotalCents: l.lineTotalCents
        }))
      }));
      const active = pickActiveOrderForVenue(orderRows, restaurantId);
      const cart = await prisma.shoppingCart.findUnique({
        where: { userId_restaurantId: { userId: pl.sub, restaurantId } },
        include: { lines: true }
      });
      const hasCompleted = orderRows.some((o) => o.status === "COMPLETED" || o.status === "CANCELLED");
      scene = resolveCustomerChatScene({
        cartLineCount: cart?.lines.length ?? 0,
        activeOrder: active,
        hasCompletedOrders: hasCompleted
      });
      resolvedOrderId = active?.id;
    }

    const chatRoomId = await ensureCustomerChatRoom(prisma, {
      scene,
      restaurantId,
      customerUserId: pl.sub,
      orderId: resolvedOrderId
    });

    const used = await countCustomerChatImagesInRoom(prisma, chatRoomId);
    if (used + images.length > CHAT_MAX_IMAGES_PER_ROOM) {
      return reply.status(400).send({
        ok: false,
        error: "image_quota_exceeded",
        quota: { used, max: CHAT_MAX_IMAGES_PER_ROOM, perSend: CHAT_MAX_IMAGES_PER_SEND }
      });
    }

    const normalizedImages: Array<{ mimeType: ChatImageMime; dataBase64: string }> = [];
    for (const img of images) {
      const uri = buildImageDataUri(img.mimeType as ChatImageMime, img.dataBase64.trim());
      if (!parseImageDataUri(uri)) {
        return reply.status(400).send({ ok: false, error: "invalid_image" });
      }
      normalizedImages.push({ mimeType: img.mimeType as ChatImageMime, dataBase64: img.dataBase64.trim() });
    }

    const rows = await createChatImageMessages(prisma, {
      chatRoomId,
      senderUserId: pl.sub,
      senderRole: "CUSTOMER",
      images: normalizedImages
    });

    const room = await prisma.chatRoom.findUnique({ where: { id: chatRoomId } });
    const readCtx = {
      restaurantLastReadAt: room?.restaurantLastReadAt ?? null,
      customerLastReadAt: room?.customerLastReadAt ?? null
    };
    const messages = await serializeMessages(rows, { userId: pl.sub, role: "CUSTOMER" }, readCtx);
    for (const message of messages) {
      await pushChatMessage({
        chatRoomId,
        restaurantId,
        customerUserId: pl.sub,
        actorUserId: pl.sub,
        message,
        wsPayload: { type: "new_message", message }
      });
    }

    return {
      ok: true,
      messages,
      chatImageQuota: {
        used: used + messages.length,
        max: CHAT_MAX_IMAGES_PER_ROOM,
        perSend: CHAT_MAX_IMAGES_PER_SEND
      }
    };
  });
}
