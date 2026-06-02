import type { PrismaClient } from "@prisma/client";
import type { MobileAuthContext } from "./mobileAuthContext.js";
import { assertPermission, requireVenueMembership } from "./mobileAuthContext.js";
import { WORKSPACE_SCREENS, type WorkspaceScreenDef } from "./mobileScreenRegistry.js";
import { userHasPermission } from "./mobileExperience.js";

const ACTIVE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"] as const;

function assertScreenAccess(ctx: MobileAuthContext, screenKey: string): WorkspaceScreenDef {
  const def = WORKSPACE_SCREENS[screenKey];
  if (!def) throw Object.assign(new Error("unknown_screen"), { statusCode: 404 });
  if (!def.roleTypes.includes(ctx.experience.roleType)) {
    throw Object.assign(new Error("role_not_allowed"), { statusCode: 403 });
  }
  assertPermission(ctx, def.permission);
  return def;
}

function requireActiveRestaurant(ctx: MobileAuthContext): string {
  const rid = ctx.activeRestaurantId?.trim();
  if (!rid) throw Object.assign(new Error("active_restaurant_required"), { statusCode: 400 });
  return rid;
}

async function fetchOrdersForVenue(prisma: PrismaClient, restaurantId: string, statusFilter?: string[]) {
  return prisma.order.findMany({
    where: {
      restaurantId,
      ...(statusFilter?.length ? { status: { in: statusFilter } } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      lines: true,
      restaurant: { select: { name: true } }
    }
  });
}

export async function buildWorkspaceContext(prisma: PrismaClient, ctx: MobileAuthContext) {
  const rid = ctx.activeRestaurantId;
  let activeOrders = 0;
  let todayRevenueCents = 0;
  if (rid) {
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: rid,
        status: { in: [...ACTIVE_ORDER_STATUSES] }
      },
      select: { totalCents: true, createdAt: true }
    });
    activeOrders = orders.length;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    todayRevenueCents = orders
      .filter((o) => o.createdAt >= start)
      .reduce((s, o) => s + o.totalCents, 0);
  }

  return {
    roleType: ctx.experience.roleType,
    activeRestaurantId: rid,
    memberships: ctx.memberships,
    summary: {
      activeOrders,
      todayRevenueCents,
      venueCount: ctx.memberships.length
    }
  };
}

export async function loadWorkspaceScreenData(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  screenKey: string,
  restaurantIdParam?: string
) {
  const def = assertScreenAccess(ctx, screenKey);
  const restaurantId = restaurantIdParam?.trim() || requireActiveRestaurant(ctx);
  await requireVenueMembership(prisma, ctx, restaurantId);

  if (def.status === "coming_soon") {
    return { screenKey, status: def.status, title: def.title, subtitle: def.subtitle, payload: null };
  }

  switch (screenKey) {
    case "admin.dashboard": {
      const orders = await fetchOrdersForVenue(prisma, restaurantId, [...ACTIVE_ORDER_STATUSES]);
      const completedToday = await prisma.order.count({
        where: {
          restaurantId,
          status: "COMPLETED",
          updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      });
      const upcomingReservations = await prisma.customerReservation.count({
        where: {
          restaurantId,
          status: "CONFIRMED",
          startsAt: { gte: new Date() }
        }
      });
      return {
        screenKey,
        status: "live" as const,
        title: def.title,
        subtitle: def.subtitle,
        payload: {
          activeOrderCount: orders.length,
          completedToday,
          upcomingReservations,
          revenueActiveCents: orders.reduce((s, o) => s + o.totalCents, 0)
        }
      };
    }
    case "admin.live_orders":
    case "staff.assigned_orders":
    case "staff.kitchen_queue":
    case "staff.checkout_queue": {
      let statuses = [...ACTIVE_ORDER_STATUSES];
      if (screenKey === "staff.kitchen_queue") statuses = ["CONFIRMED", "PREPARING"];
      if (screenKey === "staff.checkout_queue") statuses = ["READY"];
      const orders = await fetchOrdersForVenue(prisma, restaurantId, statuses);
      return {
        screenKey,
        status: "live" as const,
        title: def.title,
        subtitle: def.subtitle,
        payload: {
          orders: orders.map((o) => ({
            id: o.id,
            status: o.status,
            totalCents: o.totalCents,
            createdAt: o.createdAt.toISOString(),
            note: o.note,
            lineCount: o.lines.length,
            lines: o.lines.map((l) => ({
              name: l.nameSnapshot,
              quantity: l.quantity,
              lineTotalCents: l.lineTotalCents
            }))
          }))
        }
      };
    }
    case "admin.restaurant_profile":
    case "admin.restaurant_settings": {
      const r = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          id: true,
          name: true,
          openingHours: true,
          venueSubtype: true,
          establishmentLocation: true,
          offeringsDescription: true
        }
      });
      if (!r) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });
      return {
        screenKey,
        status: "live" as const,
        title: def.title,
        subtitle: def.subtitle,
        payload: { restaurant: r }
      };
    }
    case "admin.menu": {
      const categories = await prisma.menuCategory.findMany({
        where: { restaurantId, isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, priceCents: true, description: true }
          }
        }
      });
      return {
        screenKey,
        status: "live" as const,
        title: def.title,
        subtitle: def.subtitle,
        payload: {
          categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            items: c.items
          }))
        }
      };
    }
    case "admin.reservations": {
      const rows = await prisma.customerReservation.findMany({
        where: { restaurantId, status: "CONFIRMED", startsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 40,
        include: { user: { select: { email: true } } }
      });
      return {
        screenKey,
        status: "live" as const,
        title: def.title,
        subtitle: def.subtitle,
        payload: {
          reservations: rows.map((r) => ({
            id: r.id,
            confirmationCode: r.confirmationCode,
            startsAt: r.startsAt.toISOString(),
            draft: r.draft,
            guestEmail: r.user.email
          }))
        }
      };
    }
    case "shared.help":
    case "shared.about":
      return {
        screenKey,
        status: "live" as const,
        title: def.title,
        subtitle: def.subtitle,
        payload: {
          body:
            screenKey === "shared.about"
              ? "ServeOS — restaurant operating system. Mobile experience is controlled by your account role and server permissions."
              : "Contact your venue manager or ServeOS support. Operational help for staff and owners is available from the web admin."
        }
      };
    default:
      return { screenKey, status: def.status, title: def.title, subtitle: def.subtitle, payload: null };
  }
}

export function assertUserMayOpenScreen(ctx: MobileAuthContext, screenKey: string): boolean {
  if (!WORKSPACE_SCREENS[screenKey]) return false;
  const def = WORKSPACE_SCREENS[screenKey];
  if (!def.roleTypes.includes(ctx.experience.roleType)) return false;
  return userHasPermission(ctx.experience, def.permission);
}
