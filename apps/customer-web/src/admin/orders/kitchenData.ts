import type { AdminOrder, KitchenStatus } from "./ordersTypes";

export type KitchenColumnId = "new" | "preparing" | "ready";

export type KitchenTicket = AdminOrder & {
  kitchenColumn: KitchenColumnId;
  /** Once bumped to Ready, ticket cannot be dragged back. */
  readyLocked: boolean;
};

export function ordersToKitchenTickets(orders: AdminOrder[]): KitchenTicket[] {
  return orders
    .filter((o) => ["CREATED", "ACCEPTED", "PREPARING", "READY"].includes(o.status))
    .map((o) => ({
      ...o,
      kitchenColumn:
        o.kitchenStatus === "READY" || o.status === "READY"
          ? ("ready" as const)
          : o.kitchenStatus === "PREPARING" || o.status === "PREPARING"
            ? ("preparing" as const)
            : ("new" as const),
      readyLocked: o.kitchenStatus === "READY" || o.status === "READY"
    }));
}

export function kitchenStatusForColumn(column: KitchenColumnId): KitchenStatus {
  if (column === "preparing") return "PREPARING";
  if (column === "ready") return "READY";
  return "NEW";
}

export function apiStatusForKitchenAction(
  ticket: KitchenTicket,
  action: string
): string | null {
  const raw = ticket.apiStatus ?? ticket.status;
  if (action === "Accept" || action === "Start") {
    if (raw === "CREATED" || raw === "PENDING_PAYMENT" || raw === "PAID" || raw === "ACCEPTED") return "PREPARING";
    return "PREPARING";
  }
  if (action === "Ready") return "READY";
  if (action === "Complete") return "COMPLETED";
  return null;
}

export function apiStatusForKitchenColumn(ticket: KitchenTicket, column: KitchenColumnId): string | null {
  if (column === "preparing") return "PREPARING";
  if (column === "ready") return "READY";
  if (column === "new") {
    const raw = ticket.apiStatus ?? ticket.status;
    if (raw === "PREPARING" || raw === "READY" || raw === "COMPLETED") return null;
    return "ACCEPTED";
  }
  return null;
}

export function ticketTraceStyle(id: string): Record<string, string> {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const abs = Math.abs(hash);
  const duration = (2.4 + (abs % 280) / 100).toFixed(2);
  const delay = (-(abs % 620) / 100).toFixed(2);
  return {
    "--kds-trace-duration": `${duration}s`,
    "--kds-trace-delay": `${delay}s`
  };
}
