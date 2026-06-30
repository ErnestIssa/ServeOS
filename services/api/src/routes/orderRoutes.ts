import { EventEmitter } from "node:events";
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { notifyOrderCreated, notifyOrderUpdated } from "../notifications/integrations/orders.js";
import type { OrderEventPayload } from "@serveos/core-upstash";
import { placeOrder, applyPaymentSucceededWebhook, applyPaymentFailedWebhook } from "../lib/orders/index.js";
import {
  getAdminOrderDetail,
  getAdminOrderStats,
  listAdminOrders
} from "../lib/orders/orderQueryService.js";
import {
  countOutboxByStatus,
  listDeadLetterOutboxEvents,
  replayDeadLetterOutboxEvent
} from "../lib/orders/orderOutboxDeadLetter.js";
import { getOrderEngineOperationalSnapshot } from "../lib/orders/orderRecoveryService.js";
import { listPendingCompensations } from "../lib/orders/orderCompensationService.js";
import { loadRestaurantOrderPolicy, mergeOrderEnginePolicy } from "../lib/orders/orderTenantPolicies.js";
import { searchOrders } from "../lib/orders/orderSearchService.js";
import { ORDER_READ_MODEL_POLICY } from "../lib/orders/orderReadModelPolicy.js";
import {
  buildOrderIdentitySnapshot,
  listOrdersBySessionId,
  loadRestaurantIdentityPolicy,
  mergeOrderIdentityPolicy,
  resolveOrderByInternalId,
  resolveOrderByPaymentReference,
  resolveOrderByTenantNumber,
  resolveOrderByReceiptHash,
  resolveOrderByGs1Identifier,
  resolveOrderByFederationId,
  resolveOrderByPartnerIdentity,
  resolveOrderFromAuditLog,
  registerPartnerOrderIdentity,
  validateIdentityPolicyChange,
  HISTORICAL_IDENTITY_GUARANTEE
} from "../lib/orderIdentity/index.js";
import { getOrderOwnership } from "../lib/orderOwnership/index.js";
import {
  listAllSourceContracts,
  loadRestaurantSourcePolicy,
  getSourceContract,
  PHASE_1_ORDER_SOURCES,
  persistSourceInterpretation,
  SOURCE_POLICY_VERSIONING_RULES
} from "../lib/orderSource/index.js";
import { applyOrderEditOperation } from "../lib/orderEdit/index.js";
import { ORDER_STATUS_VALUES } from "../lib/orders/orderStatusValues.js";
import type { PlaceOrderInput } from "../lib/orders/orderTypes.js";
import { autoTerminateStaleActiveOrdersForCustomer } from "../lib/autoTerminateStaleActiveOrders.js";
import { isVenueMembershipRole } from "../lib/membershipAccess.js";
import { applyOrderStatusOcl, loadCustomerOrderOcl } from "../lib/orderOcl.js";
import {
  assertOrderingSessionForRestaurant,
  placementDefaultsFromSession
} from "../lib/ordering/orderingSessionService.js";
import { loadSessionCartLinesForOrder, clearSessionCart } from "../lib/ordering/sessionCartService.js";
import {
  completeOrderCheckout,
  createOrderCheckout,
  mapCheckoutError
} from "../lib/orders/orderCheckoutService.js";
import {
  finalizeOrderStatusAudit,
  guardOrderStatusChange,
  handleOrderDiscountRequest,
  handleOrderRefundRequest
} from "../lib/trust/orderTrustGuard.js";

function roomOrder(id: string) {
  return `order:${id}`;
}
function roomRestaurant(id: string) {
  return `restaurant:${id}`;
}
function roomCustomer(id: string) {
  return `customer:${id}`;
}

function readIdempotencyKey(req: { headers: Record<string, unknown> }): string | undefined {
  const raw = req.headers["idempotency-key"] ?? req.headers["x-idempotency-key"];
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export async function registerOrderRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  orderBus: EventEmitter,
  chatBus: EventEmitter,
  domainEventBus: EventEmitter
) {
  async function publishOrderEvent(orderId: string, created = false) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        restaurantId: true,
        status: true,
        totalCents: true,
        customerUserId: true,
        restaurant: { select: { name: true } }
      }
    });
    if (!order) return;
    const input = {
      orderId: order.id,
      restaurantId: order.restaurantId,
      status: order.status,
      totalCents: order.totalCents,
      restaurantName: order.restaurant.name,
      customerUserId: order.customerUserId
    };
    if (created) await notifyOrderCreated(domainEventBus, input);
    else await notifyOrderUpdated(domainEventBus, input);
    app.log.info(
      { orderId: order.id, restaurantId: order.restaurantId, status: order.status, created },
      "order_event_routed_to_notifications"
    );
  }

  function requireUser(req: { headers: { authorization?: string } }) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw Object.assign(new Error("JWT_SECRET is required"), { statusCode: 500 });
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      throw Object.assign(new Error("missing_token"), { statusCode: 401 });
    }
    const token = auth.slice("Bearer ".length);
    return jwt.verify(token, secret) as { sub: string; role: string };
  }

  function tryUser(req: { headers: { authorization?: string } }): { sub: string } | null {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return null;
    try {
      const token = auth.slice("Bearer ".length);
      const p = jwt.verify(token, secret) as { sub: string };
      return { sub: p.sub };
    } catch {
      return null;
    }
  }

  async function requireStaff(req: { headers: { authorization?: string } }, restaurantId: string) {
    const user = requireUser(req);
    const m = await prisma.membership.findUnique({
      where: { userId_restaurantId: { userId: user.sub, restaurantId } }
    });
    if (!m || !isVenueMembershipRole(m.role)) {
      throw Object.assign(new Error("forbidden"), { statusCode: 403 });
    }
    return user;
  }

  app.get(
    "/orders/events",
    { websocket: true },
    async (socket, req) => {
      const q = req.query as {
        orderId?: string;
        restaurantId?: string;
        mine?: string;
        token?: string;
      };
      const orderId = typeof q.orderId === "string" ? q.orderId : undefined;
      const restaurantId = typeof q.restaurantId === "string" ? q.restaurantId : undefined;
      const mine = q.mine === "1" || q.mine === "true";
      const token = typeof q.token === "string" ? q.token : "";

      const send = (payload: OrderEventPayload) => {
        if (socket.readyState === 1) socket.send(JSON.stringify(payload));
      };

      let room: string | null = null;

      try {
        if (orderId) {
          const exists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
          if (!exists) {
            socket.close();
            return;
          }
          room = roomOrder(orderId);
        } else if (restaurantId && token) {
          await requireStaff({ headers: { authorization: `Bearer ${token}` } }, restaurantId);
          room = roomRestaurant(restaurantId);
        } else if (mine && token) {
          const secret = process.env.JWT_SECRET;
          if (!secret) {
            socket.close();
            return;
          }
          let sub: string;
          try {
            sub = (jwt.verify(token, secret) as { sub: string }).sub;
          } catch {
            socket.close();
            return;
          }
          room = roomCustomer(sub);
        } else {
          socket.close();
          return;
        }
      } catch {
        socket.close();
        return;
      }

      const onEvent = (payload: OrderEventPayload | { type?: string }) => send(payload as OrderEventPayload);
      orderBus.on(room!, onEvent);
      if (orderId) {
        orderBus.on(`ocl:order:${orderId}`, onEvent);
      }

      if (orderId) {
        const o = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            restaurantId: true,
            status: true,
            totalCents: true,
            restaurant: { select: { name: true } }
          }
        });
        if (o) {
          send({
            type: "order_updated",
            orderId: o.id,
            restaurantId: o.restaurantId,
            status: o.status,
            totalCents: o.totalCents,
            restaurantName: o.restaurant.name
          });
        }
      }

      socket.on("close", () => {
        orderBus.off(room!, onEvent);
        if (orderId) orderBus.off(`ocl:order:${orderId}`, onEvent);
      });
    }
  );

  const orderLineBody = z.object({
    menuItemId: z.string(),
    quantity: z.number().int().positive(),
    modifierOptionIds: z.array(z.string()).optional()
  });

  const placeOrderSchema = z
    .object({
      restaurantId: z.string(),
      note: z.string().max(2000).optional(),
      lines: z.array(orderLineBody).optional(),
      fromCart: z.boolean().optional(),
      fromSessionCart: z.boolean().optional(),
      sourceSessionId: z.string().max(200).optional(),
      sourceSessionType: z.string().max(50).optional(),
      deviceId: z.string().max(200).optional(),
      reservationId: z.string().max(200).optional(),
      source: z
        .enum([
          "QR_ORDER",
          "WALK_IN",
          "STAFF_CREATED",
          "PHONE_ORDER",
          "RESERVATION",
          "RESERVATION_ORDER",
          "DELIVERY_PARTNER"
        ])
        .optional(),
      partnerId: z.string().max(100).optional(),
      externalPartnerOrderId: z.string().max(200).optional(),
      createdByContext: z.enum(["CUSTOMER", "STAFF"]).optional()
    })
    .refine(
      (b) => (b.fromCart || b.fromSessionCart ? true : !!(b.lines && b.lines.length > 0)),
      { message: "lines_or_fromCart" }
    );

  app.post("/orders/place", async (req) => {
    const body = placeOrderSchema.parse(req.body);
    const customer = tryUser(req);

    const restaurant = await prisma.restaurant.findUnique({ where: { id: body.restaurantId } });
    if (!restaurant) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });

    let lineSources: Array<{ menuItemId: string; quantity: number; modifierOptionIds?: string[] }>;
    let orderNote = body.note?.trim() || undefined;

    if (body.fromCart) {
      if (!customer) throw Object.assign(new Error("missing_token"), { statusCode: 401 });
      const cart = await prisma.shoppingCart.findUnique({
        where: { userId_restaurantId: { userId: customer.sub, restaurantId: body.restaurantId } },
        include: { lines: true }
      });
      if (!cart || cart.lines.length === 0) {
        throw Object.assign(new Error("cart_empty"), { statusCode: 400 });
      }
      if (!orderNote && cart.orderNote?.trim()) {
        orderNote = cart.orderNote.trim();
      }
      lineSources = cart.lines.map((l: (typeof cart.lines)[number]) => ({
        menuItemId: l.menuItemId,
        quantity: l.quantity,
        modifierOptionIds: Array.isArray(l.modifierOptionIds)
          ? (l.modifierOptionIds as string[])
          : []
      }));
    } else if (body.fromSessionCart) {
      if (!body.sourceSessionId?.trim()) {
        throw Object.assign(new Error("source_session_required"), { statusCode: 400 });
      }
      const sessionCart = await loadSessionCartLinesForOrder(
        prisma,
        body.sourceSessionId.trim(),
        body.restaurantId
      );
      if (!orderNote && sessionCart.orderNote) orderNote = sessionCart.orderNote;
      lineSources = sessionCart.lines;
    } else {
      lineSources = body.lines ?? [];
    }

    const lineInputs: Array<{
      menuItemId: string;
      quantity: number;
      modifierOptionIds?: string[];
    }> = [];

    for (const line of lineSources) {
      lineInputs.push({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        modifierOptionIds: line.modifierOptionIds
      });
    }

    let source = body.source as PlaceOrderInput["source"];
    let sourceSessionId = body.sourceSessionId;
    let sourceSessionType = body.sourceSessionType;
    let tableLabel: string | undefined;
    let initialStatus: PlaceOrderInput["initialStatus"];
    let paymentStatus: PlaceOrderInput["paymentStatus"];

    if (sourceSessionId?.trim()) {
      const session = await assertOrderingSessionForRestaurant(prisma, sourceSessionId.trim(), body.restaurantId);
      if (!session.ok) {
        throw Object.assign(new Error(session.error), { statusCode: 400 });
      }
      const defaults = placementDefaultsFromSession(session.session);
      if (!source) source = defaults.source;
      sourceSessionType = sourceSessionType ?? defaults.sourceSessionType;
      tableLabel = defaults.tableLabel;
      if (!body.source) {
        initialStatus = defaults.initialStatus;
        paymentStatus = defaults.paymentStatus;
      }
    } else if (!customer?.sub) {
      throw Object.assign(new Error("source_session_required"), { statusCode: 400 });
    }

    const order = await placeOrder(
      prisma,
      {
          restaurantId: body.restaurantId,
        note: orderNote,
        lines: lineInputs,
          customerUserId: customer?.sub ?? null,
          createdByUserId: customer?.sub ?? null,
        createdByContext: body.createdByContext ?? "CUSTOMER",
        source,
        sourceSessionId,
        sourceSessionType,
        tableLabel,
        initialStatus,
        paymentStatus,
        deviceId: body.deviceId,
        reservationId: body.reservationId,
        partnerId: body.partnerId,
        externalPartnerOrderId: body.externalPartnerOrderId,
        idempotencyKey: readIdempotencyKey(req)
      },
      { domainEventBus, orderBus },
      app.log
    );

      if (body.fromCart && customer) {
      await prisma.shoppingCart.deleteMany({
          where: { userId: customer.sub, restaurantId: body.restaurantId }
        });
      }

      if (body.fromSessionCart && body.sourceSessionId?.trim()) {
        await clearSessionCart(prisma, body.sourceSessionId.trim());
      }

    const identityPolicy = await loadRestaurantIdentityPolicy(prisma, order.restaurantId);
    const identity = buildOrderIdentitySnapshot(order, identityPolicy);

    return {
      ok: true,
      order: {
        id: order.id,
        restaurantId: order.restaurantId,
        status: order.status,
        displaySeq: order.displaySeq,
        displayPeriodKey: order.displayPeriodKey,
        identity,
        subtotalCents: order.subtotalCents,
        taxCents: order.taxCents,
        totalCents: order.totalCents,
        lines: order.lines.map((l) => ({
          id: l.id,
          name: l.nameSnapshot,
          quantity: l.quantity,
          lineTotalCents: l.lineTotalCents
        }))
      }
    };
  });

  app.get("/orders/restaurant/:restaurantId", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const q = req.query as Record<string, string | undefined>;
    const result = await listAdminOrders(prisma, {
      restaurantId,
      page: q.page ? Number(q.page) : 1,
      pageSize: q.pageSize ? Number(q.pageSize) : 25,
      status: (q.status as never) ?? (q.preset === "active" ? "active" : q.preset === "completed" ? "completed" : q.preset === "problem" ? "problem" : undefined),
      source: q.source,
      paymentStatus: q.paymentStatus,
      search: q.search,
      assignedStaffUserId: q.staff
    });
    return { ok: true, ...result };
  });

  app.get("/orders/restaurant/:restaurantId/stats", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const stats = await getAdminOrderStats(prisma, restaurantId);
    return { ok: true, stats };
  });

  app.get("/orders/restaurant/:restaurantId/:orderId/admin", async (req) => {
    const { restaurantId, orderId } = req.params as { restaurantId: string; orderId: string };
    await requireStaff(req, restaurantId);
    const order = await getAdminOrderDetail(prisma, restaurantId, orderId);
    return { ok: true, order };
  });

  app.get("/orders/restaurant/:restaurantId/outbox/dead-letter", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const events = await listDeadLetterOutboxEvents(prisma, { restaurantId });
    const counts = await countOutboxByStatus(prisma, restaurantId);
    return { ok: true, events, counts };
  });

  app.post("/orders/restaurant/:restaurantId/outbox/:outboxId/replay", async (req) => {
    const { restaurantId, outboxId } = req.params as { restaurantId: string; outboxId: string };
    await requireStaff(req, restaurantId);
    const row = await replayDeadLetterOutboxEvent(prisma, outboxId, { domainEventBus, orderBus }, app.log);
    if (row.restaurantId !== restaurantId) {
      throw Object.assign(new Error("forbidden"), { statusCode: 403 });
    }
    return { ok: true, event: row };
  });

  app.get("/orders/restaurant/:restaurantId/search", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const q = req.query as { q?: string; limit?: string };
    if (!q.q?.trim()) {
      return { ok: true, results: [] };
    }
    const results = await searchOrders(prisma, {
      restaurantId,
      q: q.q,
      limit: q.limit ? Number(q.limit) : 25
    });
    return { ok: true, results };
  });

  app.get("/orders/restaurant/:restaurantId/operational", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const snapshot = await getOrderEngineOperationalSnapshot(prisma, restaurantId);
    return { ok: true, ...snapshot };
  });

  app.get("/orders/restaurant/:restaurantId/compensations", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const compensations = await listPendingCompensations(prisma, restaurantId);
    return { ok: true, compensations };
  });

  app.get("/orders/restaurant/:restaurantId/engine-policy", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const policy = await loadRestaurantOrderPolicy(prisma, restaurantId);
    return { ok: true, policy, readModelPolicy: ORDER_READ_MODEL_POLICY };
  });

  const enginePolicyPatchSchema = z.object({
    cancelAfterAccepted: z.boolean().optional(),
    cancelAfterKitchenStart: z.boolean().optional(),
    autoAcceptOnPayment: z.boolean().optional(),
    autoAcceptOnCreate: z.boolean().optional(),
    refundRequiresManager: z.boolean().optional(),
    customerCancelBeforeAccepted: z.boolean().optional(),
    sla: z
      .object({
        maxActiveAgeMs: z.number().int().positive().optional(),
        preparingDelayWarningMs: z.number().int().positive().optional(),
        acceptedWithoutPrepEscalationMs: z.number().int().positive().optional(),
        readyHandoffDelayMs: z.number().int().positive().optional()
      })
      .optional(),
    recovery: z
      .object({
        autoEscalateStuckOrders: z.boolean().optional(),
        autoRetryKdsOutbox: z.boolean().optional(),
        autoReconcilePaidMismatch: z.boolean().optional()
      })
      .optional()
  });

  app.patch("/orders/restaurant/:restaurantId/engine-policy", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    const user = await requireStaff(req, restaurantId);
    const m = await prisma.membership.findUnique({
      where: { userId_restaurantId: { userId: user.sub, restaurantId } }
    });
    if (!m || (m.role !== "OWNER" && m.role !== "MANAGER")) {
      throw Object.assign(new Error("manager_required"), { statusCode: 403 });
    }

    const patch = enginePolicyPatchSchema.parse(req.body);
    const existing = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { orderEnginePolicy: true }
    });
    const merged = mergeOrderEnginePolicy({
      ...(typeof existing?.orderEnginePolicy === "object" && existing.orderEnginePolicy !== null
        ? existing.orderEnginePolicy
        : {}),
      ...patch,
      sla: {
        ...(typeof existing?.orderEnginePolicy === "object" &&
        existing.orderEnginePolicy !== null &&
        "sla" in existing.orderEnginePolicy &&
        typeof (existing.orderEnginePolicy as { sla?: object }).sla === "object"
          ? (existing.orderEnginePolicy as { sla: object }).sla
          : {}),
        ...(patch.sla ?? {})
      },
      recovery: {
        ...(typeof existing?.orderEnginePolicy === "object" &&
        existing.orderEnginePolicy !== null &&
        "recovery" in existing.orderEnginePolicy &&
        typeof (existing.orderEnginePolicy as { recovery?: object }).recovery === "object"
          ? (existing.orderEnginePolicy as { recovery: object }).recovery
          : {}),
        ...(patch.recovery ?? {})
      }
    });

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { orderEnginePolicy: merged as never }
    });

    return { ok: true, policy: merged };
  });

  app.get("/orders/restaurant/:restaurantId/source-policy", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const tenant = await loadRestaurantSourcePolicy(prisma, restaurantId);
    const contracts = listAllSourceContracts(tenant);
    return { ok: true, phase1Sources: PHASE_1_ORDER_SOURCES, contracts };
  });

  app.get("/orders/restaurant/:restaurantId/source-policy/:source", async (req) => {
    const { restaurantId, source } = req.params as { restaurantId: string; source: string };
    await requireStaff(req, restaurantId);
    const tenant = await loadRestaurantSourcePolicy(prisma, restaurantId);
    const canonical = source as (typeof PHASE_1_ORDER_SOURCES)[number];
    if (!PHASE_1_ORDER_SOURCES.includes(canonical)) {
      throw Object.assign(new Error("invalid_order_source"), { statusCode: 400 });
    }
    const base = getSourceContract(canonical);
    const effective = listAllSourceContracts(tenant).find((c) => c.source === canonical)!;
    return { ok: true, base, effective };
  });

  const sourceInterpretationSchema = z.object({
    interpretation: z.enum([
      "STAFF_ASSISTED",
      "CONVERTED_TO_RESERVATION",
      "PARTNER_REASSIGNED_INTERNAL",
      "SOURCE_CORRECTION_LOGGED",
      "HYBRID_STAFF_LINE_ADDITION"
    ]),
    note: z.string().max(500).optional()
  });

  app.post("/orders/:orderId/source-interpretation", async (req) => {
    const { orderId } = req.params as { orderId: string };
    const body = sourceInterpretationSchema.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { restaurantId: true }
    });
    if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
    const user = await requireStaff(req, order.restaurantId);
    const result = await persistSourceInterpretation(prisma, {
      orderId,
      restaurantId: order.restaurantId,
      interpretation: body.interpretation,
      actorUserId: user.sub,
      actorIsStaff: true,
      note: body.note
    });
    return { ok: true, ...result, policies: SOURCE_POLICY_VERSIONING_RULES };
  });

  const orderEditSchema = z.object({
    expectedVersion: z.number().int().nonnegative(),
    operation: z.enum([
      "ADD_ITEM",
      "REMOVE_ITEM",
      "UPDATE_QUANTITY",
      "MODIFY_MODIFIERS",
      "UPDATE_NOTE",
      "ADD_ALLERGY_NOTE",
      "STAFF_CORRECTION",
      "PRICE_OVERRIDE"
    ]),
    payload: z.record(z.unknown()),
    reason: z.string().max(500).optional(),
    requestSource: z.enum(["UI", "STAFF_POS", "SYSTEM"]).optional(),
    idempotencyKey: z.string().max(128).optional()
  });

  app.post("/orders/:orderId/edit", async (req) => {
    const { orderId } = req.params as { orderId: string };
    const body = orderEditSchema.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { restaurantId: true, customerUserId: true }
    });
    if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

    const user = requireUser(req);
    const isCustomer = order.customerUserId === user.sub;
    if (!isCustomer) {
      await requireStaff(req, order.restaurantId);
    }

    const result = await applyOrderEditOperation(
      prisma,
      {
        orderId,
        expectedVersion: body.expectedVersion,
        operation: body.operation,
        payload: body.payload as never,
        actor: {
          userId: user.sub,
          source: isCustomer ? "CUSTOMER" : "STAFF",
          isCustomer
        },
        reason: body.reason,
        requestSource: body.requestSource,
        idempotencyKey: body.idempotencyKey
      },
      { domainEventBus, orderBus }
    );

    await publishOrderEvent(orderId);
    return { ok: true, ...result };
  });

  app.get("/orders/restaurant/:restaurantId/identity-policy", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    await requireStaff(req, restaurantId);
    const policy = await loadRestaurantIdentityPolicy(prisma, restaurantId);
    return { ok: true, policy };
  });

  const identityPolicyPatchSchema = z.object({
    displayNumberReset: z.enum(["never", "yearly", "monthly"]).optional(),
    trackingCodePrefix: z.string().min(2).max(8).optional(),
    internalIdSchema: z.enum(["cuid", "ulid"]).optional()
  });

  app.patch("/orders/restaurant/:restaurantId/identity-policy", async (req) => {
    const { restaurantId } = req.params as { restaurantId: string };
    const user = await requireStaff(req, restaurantId);
    const m = await prisma.membership.findUnique({
      where: { userId_restaurantId: { userId: user.sub, restaurantId } }
    });
    if (!m || (m.role !== "OWNER" && m.role !== "MANAGER")) {
      throw Object.assign(new Error("manager_required"), { statusCode: 403 });
    }
    const patch = identityPolicyPatchSchema.parse(req.body);
    const existing = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { orderIdentityPolicy: true }
    });
    const merged = mergeOrderIdentityPolicy({
      ...(typeof existing?.orderIdentityPolicy === "object" && existing.orderIdentityPolicy !== null
        ? existing.orderIdentityPolicy
        : {}),
      ...patch
    });
    const policyChange = validateIdentityPolicyChange(existing?.orderIdentityPolicy, merged);
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { orderIdentityPolicy: merged as never }
    });
    return { ok: true, policy: merged, policyChange, historicalGuarantee: HISTORICAL_IDENTITY_GUARANTEE };
  });

  app.get("/orders/identity/resolve", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const by = q.by ?? "internal";

    if (by === "internal") {
      if (!q.orderId) throw Object.assign(new Error("orderId_required"), { statusCode: 400 });
      const order = await prisma.order.findUnique({ where: { id: q.orderId }, select: { restaurantId: true } });
      if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
      await requireStaff(req, order.restaurantId);
      const identity = await resolveOrderByInternalId(prisma, q.orderId);
      return { ok: true, identity };
    }

    if (by === "display") {
      if (!q.restaurantId || !q.displaySeq) {
        throw Object.assign(new Error("restaurantId_and_displaySeq_required"), { statusCode: 400 });
      }
      await requireStaff(req, q.restaurantId);
      const identity = await resolveOrderByTenantNumber(
        prisma,
        q.restaurantId,
        Number(q.displaySeq),
        q.displayPeriodKey
      );
      return { ok: true, identity };
    }

    if (by === "payment") {
      if (!q.provider || !q.externalId) {
        throw Object.assign(new Error("provider_and_externalId_required"), { statusCode: 400 });
      }
      const result = await resolveOrderByPaymentReference(prisma, q.provider, q.externalId);
      await requireStaff(req, result.restaurantId);
      return { ok: true, identity: result };
    }

    if (by === "session") {
      if (!q.sessionId) throw Object.assign(new Error("sessionId_required"), { statusCode: 400 });
      const orders = await listOrdersBySessionId(prisma, q.sessionId);
      if (orders.length > 0) await requireStaff(req, orders[0]!.restaurantId);
      return { ok: true, orders };
    }

    if (by === "receipt") {
      if (!q.hash) throw Object.assign(new Error("hash_required"), { statusCode: 400 });
      const identity = await resolveOrderByReceiptHash(prisma, q.hash);
      await requireStaff(req, identity.restaurantId);
      return { ok: true, identity };
    }

    if (by === "gs1") {
      if (!q.gs1) throw Object.assign(new Error("gs1_required"), { statusCode: 400 });
      const identity = await resolveOrderByGs1Identifier(prisma, q.gs1);
      await requireStaff(req, identity.restaurantId);
      return { ok: true, identity };
    }

    if (by === "federation") {
      if (!q.federationId) throw Object.assign(new Error("federationId_required"), { statusCode: 400 });
      const identity = await resolveOrderByFederationId(prisma, q.federationId);
      await requireStaff(req, identity.restaurantId);
      return { ok: true, identity };
    }

    if (by === "partner") {
      if (!q.partnerId || !q.externalOrderId) {
        throw Object.assign(new Error("partnerId_and_externalOrderId_required"), { statusCode: 400 });
      }
      const row = await resolveOrderByPartnerIdentity(prisma, q.partnerId, q.externalOrderId);
      await requireStaff(req, row.restaurantId);
      return { ok: true, partner: row, identity: buildOrderIdentitySnapshot(row.order) };
    }

    if (by === "audit") {
      if (!q.auditLogId) throw Object.assign(new Error("auditLogId_required"), { statusCode: 400 });
      const identity = await resolveOrderFromAuditLog(prisma, q.auditLogId);
      await requireStaff(req, identity.restaurantId);
      return { ok: true, identity };
    }

    throw Object.assign(new Error("invalid_resolve_by"), { statusCode: 400 });
  });

  app.get("/orders/:orderId/ownership", async (req) => {
    const { orderId } = req.params as { orderId: string };
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { restaurantId: true } });
    if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
    await requireStaff(req, order.restaurantId);
    const ownership = await getOrderOwnership(prisma, orderId);
    return { ok: true, ownership };
  });

  const partnerIdentitySchema = z.object({
    partnerId: z.string().min(1),
    externalOrderId: z.string().min(1),
    metadata: z.record(z.unknown()).optional()
  });

  app.post("/orders/:orderId/partner-identity", async (req) => {
    const { orderId } = req.params as { orderId: string };
    const body = partnerIdentitySchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
    await requireStaff(req, order.restaurantId);
    const row = await registerPartnerOrderIdentity(prisma, {
      orderId,
      restaurantId: order.restaurantId,
      partnerId: body.partnerId,
      externalOrderId: body.externalOrderId,
      metadata: body.metadata
    });
    return { ok: true, partnerIdentity: row };
  });

  app.get("/orders/mine", async (req) => {
    const user = requireUser(req);
    const terminatedIds = await autoTerminateStaleActiveOrdersForCustomer(prisma, user.sub, new Date());
    for (const id of terminatedIds) {
      await publishOrderEvent(id);
    }
    const orders = await prisma.order.findMany({
      where: { customerUserId: user.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { restaurant: { select: { id: true, name: true } }, lines: true }
    });
    return {
      ok: true,
      orders: orders.map((o: (typeof orders)[number]) => ({
        id: o.id,
        restaurant: o.restaurant,
        status: o.status,
        source: o.source,
        paymentStatus: o.paymentStatus,
        version: o.version,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        note: o.note ?? null,
        lines: o.lines.map((l: (typeof o.lines)[number]) => ({
          id: l.id,
          menuItemId: l.menuItemId,
          name: l.nameSnapshot,
          quantity: l.quantity,
          lineTotalCents: l.lineTotalCents
        }))
      }))
    };
  });

  app.get("/orders/public/:orderId", async (req, reply) => {
    const { orderId } = req.params as { orderId: string };
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: { select: { name: true } } }
    });
    if (!order) return reply.status(404).send({ ok: false, error: "order_not_found" });
    return {
      ok: true,
      orderId: order.id,
      status: order.status,
      totalCents: order.totalCents,
      restaurantName: order.restaurant.name
    };
  });

  app.get("/orders/:orderId", async (req) => {
    const { orderId } = req.params as { orderId: string };
    const user = requireUser(req);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: true, restaurant: true }
    });
    if (!order) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });

    if (order.customerUserId === user.sub) {
      return { ok: true, order };
    }
    await requireStaff(req, order.restaurantId);
    return { ok: true, order };
  });

  const patchStatusSchema = z.object({
    status: z.enum(ORDER_STATUS_VALUES)
  });

  app.patch("/orders/:orderId/status", async (req) => {
    const { orderId } = req.params as { orderId: string };
    const body = patchStatusSchema.parse(req.body);
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
    const user = await requireStaff(req, existing.restaurantId);

    const approvalTaskId =
      typeof (req.body as { approvalTaskId?: string }).approvalTaskId === "string"
        ? (req.body as { approvalTaskId: string }).approvalTaskId
        : undefined;

    const { trustEventId } = await guardOrderStatusChange(
      prisma,
      {
        orderId,
        actorUserId: user.sub,
        targetStatus: body.status,
        approvalTaskId
      },
      domainEventBus
    );

    const order = await applyOrderStatusOcl(
      prisma,
      {
        orderId,
        status: body.status,
        actorUserId: user.sub,
        idempotencyKey: readIdempotencyKey(req)
      },
      { chatBus, domainEventBus, orderBus },
      app.log
    );

    await finalizeOrderStatusAudit(prisma, {
      trustEventId,
      orderId,
      actorUserId: user.sub,
      beforeStatus: existing.status,
      afterStatus: body.status
    });

    return {
      ok: true,
      order: {
        ...order,
        lines: await prisma.orderLineItem.findMany({ where: { orderId: order.id } })
      }
    };
  });

  const discountSchema = z.object({
    discountCents: z.number().int().positive(),
    reason: z.string().max(500).optional(),
    approvalTaskId: z.string().optional()
  });

  app.post("/orders/:orderId/discount", async (req) => {
    const { orderId } = req.params as { orderId: string };
    const body = discountSchema.parse(req.body);
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
    const user = await requireStaff(req, existing.restaurantId);

    const order = await handleOrderDiscountRequest(
      prisma,
      {
        orderId,
        actorUserId: user.sub,
        discountCents: body.discountCents,
        reason: body.reason,
        approvalTaskId: body.approvalTaskId
      },
      domainEventBus
    );

    await publishOrderEvent(order.id);
    return { ok: true, order };
  });

  const refundSchema = z.object({
    refundCents: z.number().int().positive(),
    reason: z.string().max(500).optional(),
    approvalTaskId: z.string().optional()
  });

  app.post("/orders/:orderId/refund", async (req) => {
    const { orderId } = req.params as { orderId: string };
    const body = refundSchema.parse(req.body);
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
    const user = await requireStaff(req, existing.restaurantId);

    const order = await handleOrderRefundRequest(
      prisma,
      {
        orderId,
        actorUserId: user.sub,
        refundCents: body.refundCents,
        reason: body.reason,
        approvalTaskId: body.approvalTaskId
      },
      domainEventBus
    );

    return { ok: true, order };
  });

  app.post("/orders/:orderId/checkout", async (req, reply) => {
    const { orderId } = z.object({ orderId: z.string().min(1) }).parse(req.params);
    const body = z.object({ provider: z.enum(["stripe", "swish", "cash"]) }).parse(req.body ?? { provider: "stripe" });
    const result = await createOrderCheckout(prisma, orderId, body.provider);
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error, message: mapCheckoutError(result.error) });
    }
    return { ok: true, checkout: result.checkout };
  });

  app.post("/orders/:orderId/checkout/complete", async (req, reply) => {
    const { orderId } = z.object({ orderId: z.string().min(1) }).parse(req.params);
    const body = z.object({ provider: z.string().min(1) }).parse(req.body ?? {});
    const result = await completeOrderCheckout(
      prisma,
      orderId,
      body.provider,
      { domainEventBus, orderBus },
      app.log
    );
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error, message: mapCheckoutError(result.error) });
    }
    return { ok: true, ...result };
  });

  const paymentWebhookSchema = z.object({
    orderId: z.string(),
    externalId: z.string().min(1),
    amountCents: z.number().int().positive(),
    currency: z.string().optional(),
    idempotencyKey: z.string().optional()
  });

  app.post("/webhooks/payments/:provider/succeeded", async (req) => {
    const { provider } = req.params as { provider: string };
    const body = paymentWebhookSchema.parse(req.body);
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
    const provided = req.headers["x-payment-webhook-secret"];
    if (webhookSecret && provided !== webhookSecret) {
      throw Object.assign(new Error("webhook_unauthorized"), { statusCode: 401 });
    }

    const result = await applyPaymentSucceededWebhook(
      prisma,
      {
        provider,
        externalId: body.externalId,
        orderId: body.orderId,
        amountCents: body.amountCents,
        currency: body.currency,
        idempotencyKey: body.idempotencyKey ?? readIdempotencyKey(req)
      },
      { domainEventBus, orderBus },
      app.log
    );

    return { ok: true, ...result };
  });

  app.post("/webhooks/payments/:provider/failed", async (req) => {
    const { provider } = req.params as { provider: string };
    const body = paymentWebhookSchema.parse(req.body);
    const result = await applyPaymentFailedWebhook(
      prisma,
      {
        provider,
        externalId: body.externalId,
        orderId: body.orderId,
        amountCents: body.amountCents,
        currency: body.currency,
        idempotencyKey: body.idempotencyKey ?? readIdempotencyKey(req)
      },
      app.log
    );
    return { ok: true, ...result };
  });

  app.get("/customer/orders/:orderId/ocl", async (req, reply) => {
    const user = requireUser(req);
    if (user.role !== "CUSTOMER") {
      return reply.status(403).send({ ok: false, error: "customer_only" });
    }
    const { orderId } = req.params as { orderId: string };
    try {
      const snapshot = await loadCustomerOrderOcl(prisma, user.sub, orderId);
      return { ok: true, ...snapshot };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.status(err.statusCode ?? 500).send({ ok: false, error: err.message ?? "error" });
    }
  });
}
