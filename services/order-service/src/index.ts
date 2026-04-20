import { loadServeOsEnv } from "@serveos/core-env";
loadServeOsEnv();

import { EventEmitter } from "node:events";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import jwt from "jsonwebtoken";
import { PrismaClient, type Prisma } from "@prisma/client";
import { z } from "zod";

const port = Number(process.env.ORDER_SERVICE_PORT ?? 3003);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

const orderBus = new EventEmitter();
orderBus.setMaxListeners(0);

export type OrderEventPayload = {
  type: "order_updated";
  orderId: string;
  restaurantId: string;
  status: string;
  totalCents: number;
  restaurantName?: string;
};

function roomOrder(id: string) {
  return `order:${id}`;
}
function roomRestaurant(id: string) {
  return `restaurant:${id}`;
}
function roomCustomer(id: string) {
  return `customer:${id}`;
}

/** In-process fan-out (single order-service instance). Swap for Redis pub/sub when scaling horizontally. */
async function publishOrderEvent(orderId: string) {
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
  const payload: OrderEventPayload = {
    type: "order_updated",
    orderId: order.id,
    restaurantId: order.restaurantId,
    status: order.status,
    totalCents: order.totalCents,
    restaurantName: order.restaurant.name
  };
  orderBus.emit(roomOrder(order.id), payload);
  orderBus.emit(roomRestaurant(order.restaurantId), payload);
  if (order.customerUserId) {
    orderBus.emit(roomCustomer(order.customerUserId), payload);
  }
  app.log.info(
    { orderId: order.id, restaurantId: order.restaurantId, status: order.status },
    "order_event_broadcast"
  );
}

app.setErrorHandler((err: any, _req, reply) => {
  if (err?.name === "ZodError") {
    return reply.status(400).send({ ok: false, error: "validation_error" });
  }
  const code = err.statusCode ?? err.status ?? 500;
  const msg = err.message ?? "server_error";
  if (code >= 500) app.log.error(err);
  return reply.status(code).send({ ok: false, error: String(msg) });
});

app.get("/orders/health", async () => ({ ok: true, service: "order-service" }));

await app.register(websocket);

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

    const onEvent = (payload: OrderEventPayload) => send(payload);
    orderBus.on(room!, onEvent);

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
    });
  }
);

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
  if (!m || (m.role !== "OWNER" && m.role !== "STAFF")) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return user;
}

type ModifierSnap = {
  optionId: string;
  groupName: string;
  optionName: string;
  priceDeltaCents: number;
};

const placeOrderSchema = z.object({
  restaurantId: z.string(),
  note: z.string().optional(),
  lines: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().positive(),
        modifierOptionIds: z.array(z.string()).optional()
      })
    )
    .min(1)
});

app.post("/orders/place", async (req) => {
  const body = placeOrderSchema.parse(req.body);
  const customer = tryUser(req);

  const restaurant = await prisma.restaurant.findUnique({ where: { id: body.restaurantId } });
  if (!restaurant) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });

  const lineInputs: Array<{
    menuItemId: string;
    nameSnapshot: string;
    quantity: number;
    unitPriceCents: number;
    selectedModifiers: ModifierSnap[];
    lineTotalCents: number;
  }> = [];

  for (const line of body.lines) {
    const item = await prisma.menuItem.findFirst({
      where: {
        id: line.menuItemId,
        isActive: true,
        category: { restaurantId: body.restaurantId, isActive: true }
      },
      include: {
        modifierGroups: {
          include: { options: { where: { isActive: true } } }
        }
      }
    });
    if (!item) throw Object.assign(new Error("menu_item_not_found"), { statusCode: 400 });

    const optionIds = [...new Set(line.modifierOptionIds ?? [])];

    const optionMeta = new Map<string, { groupId: string; groupName: string; priceDeltaCents: number; name: string }>();
    for (const g of item.modifierGroups) {
      for (const o of g.options) {
        optionMeta.set(o.id, {
          groupId: g.id,
          groupName: g.name,
          priceDeltaCents: o.priceDeltaCents,
          name: o.name
        });
      }
    }

    for (const oid of optionIds) {
      if (!optionMeta.has(oid)) {
        throw Object.assign(new Error("invalid_modifier_option"), { statusCode: 400 });
      }
    }

    const selectedByGroup = new Map<string, string[]>();
    for (const g of item.modifierGroups) {
      selectedByGroup.set(g.id, []);
    }
    for (const oid of optionIds) {
      const meta = optionMeta.get(oid)!;
      selectedByGroup.get(meta.groupId)!.push(oid);
    }

    for (const g of item.modifierGroups) {
      const n = selectedByGroup.get(g.id)!.length;
      if (n < g.minSelect || n > g.maxSelect) {
        throw Object.assign(new Error("modifier_count_invalid"), { statusCode: 400 });
      }
    }

    const selectedModifiers: ModifierSnap[] = optionIds.map((oid) => {
      const m = optionMeta.get(oid)!;
      return {
        optionId: oid,
        groupName: m.groupName,
        optionName: m.name,
        priceDeltaCents: m.priceDeltaCents
      };
    });

    const extras = selectedModifiers.reduce((s, m) => s + m.priceDeltaCents, 0);
    const unitPriceCents = item.priceCents + extras;
    const lineTotalCents = unitPriceCents * line.quantity;

    lineInputs.push({
      menuItemId: item.id,
      nameSnapshot: item.name,
      quantity: line.quantity,
      unitPriceCents,
      selectedModifiers,
      lineTotalCents
    });
  }

  const subtotalCents = lineInputs.reduce((s, l) => s + l.lineTotalCents, 0);
  const taxCents = 0;
  const totalCents = subtotalCents + taxCents;

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        restaurantId: body.restaurantId,
        customerUserId: customer?.sub ?? null,
        status: "PENDING",
        subtotalCents,
        taxCents,
        totalCents,
        note: body.note,
        lines: {
          create: lineInputs.map((l) => ({
            menuItemId: l.menuItemId,
            nameSnapshot: l.nameSnapshot,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            selectedModifiers: l.selectedModifiers as unknown as Prisma.InputJsonValue,
            lineTotalCents: l.lineTotalCents
          }))
        }
      },
      include: { lines: true }
    });
    return o;
  });

  await publishOrderEvent(order.id);

  return {
    ok: true,
    order: {
      id: order.id,
      restaurantId: order.restaurantId,
      status: order.status,
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
  const orders = await prisma.order.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { lines: true }
  });
  return {
    ok: true,
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      totalCents: o.totalCents,
      customerUserId: o.customerUserId,
      createdAt: o.createdAt,
      lines: o.lines.map((l) => ({
        name: l.nameSnapshot,
        quantity: l.quantity,
        lineTotalCents: l.lineTotalCents
      }))
    }))
  };
});

app.get("/orders/mine", async (req) => {
  const user = requireUser(req);
  const orders = await prisma.order.findMany({
    where: { customerUserId: user.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { restaurant: { select: { id: true, name: true } }, lines: true }
  });
  return {
    ok: true,
    orders: orders.map((o) => ({
      id: o.id,
      restaurant: o.restaurant,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
      lines: o.lines
    }))
  };
});

/** Guest / post-checkout tracking (no auth). */
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
  status: z.enum(["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"])
});

app.patch("/orders/:orderId/status", async (req) => {
  const { orderId } = req.params as { orderId: string };
  const body = patchStatusSchema.parse(req.body);
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw Object.assign(new Error("order_not_found"), { statusCode: 404 });
  await requireStaff(req, existing.restaurantId);
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: body.status },
    include: { lines: true }
  });
  await publishOrderEvent(order.id);
  return { ok: true, order };
});

await app.listen({ port, host });
