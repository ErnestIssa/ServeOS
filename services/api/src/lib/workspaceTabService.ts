import type { PrismaClient } from "@prisma/client";
import type { MobileAuthContext } from "./mobileAuthContext.js";
import { assertPermission, requireVenueMembership } from "./mobileAuthContext.js";
import { userHasPermission } from "./mobileExperience.js";
import { VENUE_PERMISSION as P } from "./venuePermissions.js";
import { buildStaffTasks } from "./staffTasksBuilder.js";
import { clockInShift, clockOutShift, getShiftClock, toggleBreakShift } from "./shiftClock.js";
import { listVenueChatThreads } from "./staffVenueChat.js";
import { listVenueStaff } from "./staffMembershipService.js";
import { loadRestaurantPolicy } from "./venueAccessGuard.js";
import { PERMISSION_GROUPS } from "./venuePermissions.js";
import { formatMoneyCentsPlain } from "./formatMoney.js";

const ACTIVE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"] as const;

const NEXT_STATUS: Record<string, string> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED"
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "New",
  CONFIRMED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Done",
  CANCELLED: "Cancelled"
};

function requireActiveRestaurant(ctx: MobileAuthContext): string {
  const rid = ctx.activeRestaurantId?.trim();
  if (!rid) throw Object.assign(new Error("active_restaurant_required"), { statusCode: 400 });
  return rid;
}

function assertTabInManifest(ctx: MobileAuthContext, tabKey: string) {
  const tab = ctx.experience.tabs.find((t) => t.key === tabKey && t.visible !== false);
  if (!tab) throw Object.assign(new Error("tab_not_allowed"), { statusCode: 403 });
  return tab;
}

function minutesSince(iso: Date) {
  return Math.floor((Date.now() - iso.getTime()) / 60_000);
}

function serializeOrderRow(o: {
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  note: string | null;
  customerUserId: string | null;
  lines: Array<{
    id: string;
    nameSnapshot: string;
    quantity: number;
    lineTotalCents: number;
    selectedModifiers: unknown;
  }>;
}) {
  const elapsedMin = minutesSince(o.createdAt);
  const prepMin = o.status === "PREPARING" ? minutesSince(o.updatedAt) : 0;
  const delayed = o.status === "PREPARING" && prepMin >= 18;
  return {
    id: o.id,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status] ?? o.status,
    totalCents: o.totalCents,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    note: o.note,
    serviceLabel: "Pickup",
    tableLabel: null as string | null,
    elapsedMinutes: elapsedMin,
    prepMinutes: prepMin,
    delayed,
    lineCount: o.lines.length,
    nextStatus: NEXT_STATUS[o.status] ?? null,
    nextStatusLabel: NEXT_STATUS[o.status] ? (STATUS_LABEL[NEXT_STATUS[o.status]!] ?? NEXT_STATUS[o.status]) : null,
    lines: o.lines.map((l) => ({
      id: l.id,
      name: l.nameSnapshot,
      quantity: l.quantity,
      lineTotalCents: l.lineTotalCents,
      modifiers: Array.isArray(l.selectedModifiers) ? l.selectedModifiers : []
    }))
  };
}

async function fetchOrders(prisma: PrismaClient, restaurantId: string, statuses?: string[]) {
  return prisma.order.findMany({
    where: {
      restaurantId,
      ...(statuses?.length ? { status: { in: statuses } } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { lines: true }
  });
}

function filterOrders(
  orders: ReturnType<typeof serializeOrderRow>[],
  filter: string
) {
  switch (filter) {
    case "new":
      return orders.filter((o) => o.status === "PENDING");
    case "in_progress":
      return orders.filter((o) => o.status === "CONFIRMED" || o.status === "PREPARING");
    case "ready":
      return orders.filter((o) => o.status === "READY");
    case "delayed":
      return orders.filter((o) => o.delayed);
    default:
      return orders;
  }
}

function orderFilters(orders: ReturnType<typeof serializeOrderRow>[]) {
  return [
    { id: "all", label: "All", count: orders.length },
    { id: "new", label: "New", count: orders.filter((o) => o.status === "PENDING").length },
    {
      id: "in_progress",
      label: "In progress",
      count: orders.filter((o) => o.status === "CONFIRMED" || o.status === "PREPARING").length
    },
    { id: "ready", label: "Ready", count: orders.filter((o) => o.status === "READY").length },
    { id: "delayed", label: "Delayed", count: orders.filter((o) => o.delayed).length }
  ];
}

export async function loadWorkspaceTabData(
  prisma: PrismaClient,
  ctx: MobileAuthContext,
  tabKey: string,
  opts?: { restaurantId?: string; filter?: string; queueMode?: string }
) {
  const tab = assertTabInManifest(ctx, tabKey);
  const restaurantId = opts?.restaurantId?.trim() || requireActiveRestaurant(ctx);
  await requireVenueMembership(prisma, ctx, restaurantId);
  const roleType = ctx.experience.roleType;
  const filter = opts?.filter?.trim() || "all";

  if (roleType === "STAFF") {
    switch (tabKey) {
      case "orders": {
        assertPermission(ctx, P.ordersView);
        let statuses = [...ACTIVE_ORDER_STATUSES];
        const queueMode = opts?.queueMode ?? inferStaffQueueMode(ctx);
        if (queueMode === "kitchen") statuses = ["CONFIRMED", "PREPARING"];
        if (queueMode === "checkout") statuses = ["READY"];
        const rows = (await fetchOrders(prisma, restaurantId, statuses)).map(serializeOrderRow);
        const filtered = filterOrders(rows, filter);
        return {
          tabKey,
          title: tab.label,
          view: "staff_orders",
          payload: {
            queueMode,
            filters: orderFilters(rows),
            activeFilter: filter,
            orders: filtered,
            canUpdateStatus:
              userHasPermission(ctx.experience, P.ordersUpdateStatus) ||
              userHasPermission(ctx.experience, P.ordersView)
          }
        };
      }
      case "tasks": {
        const tasks = await buildStaffTasks(prisma, restaurantId, ctx.userId);
        return {
          tabKey,
          title: tab.label,
          view: "staff_tasks",
          payload: { tasks, canResolve: true }
        };
      }
      case "chat": {
        const threads = await listVenueChatThreads(prisma, restaurantId);
        return {
          tabKey,
          title: tab.label,
          view: "staff_chat",
          payload: { threads, canSend: true }
        };
      }
      case "schedule": {
        const membership = ctx.memberships.find((m) => m.restaurantId === restaurantId);
        const shift = await getShiftClock(ctx.userId, restaurantId);
        const team = await prisma.membership.findMany({
          where: { restaurantId, status: "ACTIVE" },
          include: { user: { select: { email: true } } },
          take: 40
        });
        const canSeeTeam = userHasPermission(ctx.experience, P.walkIns);
        return {
          tabKey,
          title: tab.label,
          view: "staff_schedule",
          payload: {
            myShift: {
              role: membership?.role ?? "STAFF",
              restaurantName: membership?.restaurantName ?? "Venue",
              clockedIn: shift.clockedIn,
              clockInAt: shift.clockInAt,
              clockOutAt: shift.clockOutAt,
              onBreak: !!shift.breakStartedAt,
              breakStartedAt: shift.breakStartedAt
            },
            teamSchedule: canSeeTeam
              ? team.map((m) => ({
                  membershipId: m.id,
                  role: m.role,
                  email: m.user.email,
                  onShift: true
                }))
              : [],
            canSeeTeam,
            canClock: true,
            canRequestSwap: false
          }
        };
      }
      case "profile": {
        const user = await prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { id: true, email: true, phone: true, role: true }
        });
        const membership = ctx.memberships.find((m) => m.restaurantId === restaurantId);
        return {
          tabKey,
          title: tab.label,
          view: "staff_profile",
          payload: {
            user,
            venue: membership
              ? { restaurantId, name: membership.restaurantName, role: membership.role }
              : null,
            sections: ctx.experience.meHub.sections
          }
        };
      }
      default:
        throw Object.assign(new Error("unknown_tab"), { statusCode: 404 });
    }
  }

  if (roleType === "ADMIN") {
    switch (tabKey) {
      case "dashboard": {
        assertPermission(ctx, P.dashboard);
        const active = await fetchOrders(prisma, restaurantId, [...ACTIVE_ORDER_STATUSES]);
        const completedToday = await prisma.order.count({
          where: {
            restaurantId,
            status: "COMPLETED",
            updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
          }
        });
        const upcomingReservations = await prisma.customerReservation.count({
          where: { restaurantId, status: "CONFIRMED", startsAt: { gte: new Date() } }
        });
        const revenueToday = await prisma.order.aggregate({
          where: {
            restaurantId,
            status: "COMPLETED",
            updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
          },
          _sum: { totalCents: true }
        });
        const staffOnline = await prisma.membership.count({
          where: { restaurantId, status: "ACTIVE" }
        });
        const alerts = active
          .filter((o) => o.status === "PENDING" && minutesSince(o.createdAt) > 8)
          .slice(0, 5)
          .map((o) => ({
            id: `pending:${o.id}`,
            title: "Order waiting acceptance",
            body: `${o.lines.length} items · ${formatMoneyCentsPlain(o.totalCents)}`
          }));

        return {
          tabKey,
          title: tab.label,
          view: "admin_dashboard",
          payload: {
            kpis: [
              {
                id: "revenue",
                label: "Revenue today",
                value: formatMoneyCentsPlain(revenueToday._sum.totalCents ?? 0)
              },
              { id: "orders", label: "Orders today", value: String(completedToday + active.length) },
              { id: "active", label: "Active orders", value: String(active.length) },
              { id: "bookings", label: "Upcoming bookings", value: String(upcomingReservations) }
            ],
            liveOrdersSummary: active.slice(0, 6).map(serializeOrderRow),
            staffActivity: { activeStaff: staffOnline },
            alerts,
            quickActions: [
              { id: "orders", label: "View orders", tabKey: "orders" },
              { id: "menu", label: "Open menu", tabKey: "menu" },
              { id: "staff", label: "Manage staff", tabKey: "staff" }
            ]
          }
        };
      }
      case "orders": {
        assertPermission(ctx, P.ordersUpdateStatus);
        const rows = (await fetchOrders(prisma, restaurantId, [...ACTIVE_ORDER_STATUSES])).map(serializeOrderRow);
        const reservations = await prisma.customerReservation.findMany({
          where: { restaurantId, status: "CONFIRMED", startsAt: { gte: new Date() } },
          orderBy: { startsAt: "asc" },
          take: 12,
          include: { user: { select: { email: true } } }
        });
        return {
          tabKey,
          title: tab.label,
          view: "admin_orders",
          payload: {
            modes: ["all", "kitchen", "cashier"],
            activeMode: opts?.queueMode ?? "all",
            filters: orderFilters(rows),
            activeFilter: filter,
            orders: filterOrders(rows, filter),
            reservations: reservations.map((r) => ({
              id: r.id,
              confirmationCode: r.confirmationCode,
              startsAt: r.startsAt.toISOString(),
              guestEmail: r.user.email
            })),
            canUpdateStatus: true,
            canCancel: userHasPermission(ctx.experience, P.ordersUpdateStatus)
          }
        };
      }
      case "menu": {
        assertPermission(ctx, P.menuView);
        const categories = await prisma.menuCategory.findMany({
          where: { restaurantId },
          orderBy: { sortOrder: "asc" },
          include: {
            items: { orderBy: { sortOrder: "asc" } }
          }
        });
        return {
          tabKey,
          title: tab.label,
          view: "admin_menu",
          payload: {
            categories: categories.map((c) => ({
              id: c.id,
              name: c.name,
              isActive: c.isActive,
              items: c.items.map((i) => ({
                id: i.id,
                name: i.name,
                description: i.description,
                priceCents: i.priceCents,
                isActive: i.isActive
              }))
            })),
            canEdit: userHasPermission(ctx.experience, P.menuEdit)
          }
        };
      }
      case "staff": {
        assertPermission(ctx, P.staffMgmt);
        const staff = await listVenueStaff(prisma, ctx, restaurantId);
        const accessPolicy = await loadRestaurantPolicy(prisma, restaurantId);
        return {
          tabKey,
          title: tab.label,
          view: "admin_staff",
          payload: {
            ...staff,
            accessPolicy,
            permissionCatalog: PERMISSION_GROUPS,
            canInvite: userHasPermission(ctx.experience, P.staffInvite),
            canApprove: userHasPermission(ctx.experience, P.staffApprove),
            canEditPermissions: userHasPermission(ctx.experience, P.staffPermissionsEdit)
          }
        };
      }
      case "profile": {
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
          tabKey,
          title: tab.label,
          view: "admin_profile",
          payload: {
            restaurant: r,
            integrations: [
              { id: "stripe", label: "Stripe", status: "coming_soon" },
              { id: "swish", label: "Swish", status: "coming_soon" },
              { id: "whatsapp", label: "WhatsApp", status: "coming_soon" }
            ],
            billing: { planLabel: "ServeOS", status: "active" },
            settingsKeys: ctx.experience.settings
          }
        };
      }
      default:
        throw Object.assign(new Error("unknown_tab"), { statusCode: 404 });
    }
  }

  throw Object.assign(new Error("role_not_allowed"), { statusCode: 403 });
}

function inferStaffQueueMode(ctx: MobileAuthContext): string {
  const perms = new Set(ctx.experience.permissions);
  if (perms.has(P.kds) && !perms.has(P.checkout)) return "kitchen";
  if (perms.has(P.checkout) && !perms.has(P.kds)) return "checkout";
  return "assigned";
}

export {
  clockInShift,
  clockOutShift,
  toggleBreakShift,
  NEXT_STATUS
};
