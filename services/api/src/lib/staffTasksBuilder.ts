import type { PrismaClient } from "@prisma/client";
import { getUpstashRedis } from "@serveos/core-upstash";

export type StaffTaskRow = {
  id: string;
  type:
    | "reservation_arriving"
    | "order_accept"
    | "order_delayed"
    | "walk_in"
    | "manager_request";
  title: string;
  subtitle: string;
  urgency: "low" | "medium" | "high";
  dueAt: string | null;
  relatedOrderId: string | null;
  relatedReservationId: string | null;
  assignedStaffLabel: string | null;
  quickAction: "open_order" | "open_reservation" | "resolve" | null;
};

const dismissedMemory = new Set<string>();

function dismissKey(userId: string, restaurantId: string) {
  return `tasks:dismissed:${userId}:${restaurantId}`;
}

export async function listDismissedTaskIds(userId: string, restaurantId: string): Promise<Set<string>> {
  const redis = getUpstashRedis();
  const k = dismissKey(userId, restaurantId);
  if (redis) {
    const members = await redis.smembers(k);
    const list = Array.isArray(members) ? members : members ? [String(members)] : [];
    return new Set(list);
  }
  return new Set([...dismissedMemory].filter((x) => x.startsWith(`${k}:`)).map((x) => x.slice(k.length + 1)));
}

export async function dismissTask(userId: string, restaurantId: string, taskId: string) {
  const redis = getUpstashRedis();
  const k = dismissKey(userId, restaurantId);
  if (redis) {
    await redis.sadd(k, taskId);
    await redis.expire(k, 60 * 60 * 24);
  } else {
    dismissedMemory.add(`${k}:${taskId}`);
  }
}

export async function buildStaffTasks(
  prisma: PrismaClient,
  restaurantId: string,
  userId: string
): Promise<StaffTaskRow[]> {
  const dismissed = await listDismissedTaskIds(userId, restaurantId);
  const now = new Date();
  const tasks: StaffTaskRow[] = [];

  const reservations = await prisma.customerReservation.findMany({
    where: {
      restaurantId,
      status: "CONFIRMED",
      startsAt: { gte: now, lte: new Date(now.getTime() + 45 * 60_000) }
    },
    orderBy: { startsAt: "asc" },
    take: 12,
    include: { user: { select: { email: true } } }
  });

  for (const r of reservations) {
    const id = `reservation:${r.id}`;
    if (dismissed.has(id)) continue;
    const draft = r.draft as { partySize?: number; guestName?: string } | null;
    tasks.push({
      id,
      type: "reservation_arriving",
      title: "Reservation arriving soon",
      subtitle: `${draft?.guestName ?? r.user.email ?? "Guest"} · party of ${draft?.partySize ?? "—"} · ${r.confirmationCode}`,
      urgency: "medium",
      dueAt: r.startsAt.toISOString(),
      relatedOrderId: null,
      relatedReservationId: r.id,
      assignedStaffLabel: null,
      quickAction: "open_reservation"
    });
  }

  const pendingOrders = await prisma.order.findMany({
    where: { restaurantId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { lines: true }
  });

  for (const o of pendingOrders) {
    const ageMin = (now.getTime() - o.createdAt.getTime()) / 60_000;
    if (ageMin < 2) continue;
    const id = `order_accept:${o.id}`;
    if (dismissed.has(id)) continue;
    tasks.push({
      id,
      type: "order_accept",
      title: "Order needs acceptance",
      subtitle: `${o.lines.length} items · ${(o.totalCents / 100).toFixed(2)}`,
      urgency: ageMin > 8 ? "high" : "medium",
      dueAt: o.createdAt.toISOString(),
      relatedOrderId: o.id,
      relatedReservationId: null,
      assignedStaffLabel: null,
      quickAction: "open_order"
    });
  }

  const delayed = await prisma.order.findMany({
    where: { restaurantId, status: "PREPARING" },
    orderBy: { updatedAt: "asc" },
    take: 20
  });

  for (const o of delayed) {
    const ageMin = (now.getTime() - o.updatedAt.getTime()) / 60_000;
    if (ageMin < 18) continue;
    const id = `order_delayed:${o.id}`;
    if (dismissed.has(id)) continue;
    tasks.push({
      id,
      type: "order_delayed",
      title: "Kitchen backlog alert",
      subtitle: `Order in prep for ${Math.floor(ageMin)}m`,
      urgency: ageMin > 30 ? "high" : "medium",
      dueAt: o.updatedAt.toISOString(),
      relatedOrderId: o.id,
      relatedReservationId: null,
      assignedStaffLabel: null,
      quickAction: "open_order"
    });
  }

  tasks.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.urgency] - rank[b.urgency];
  });

  return tasks;
}
