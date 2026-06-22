import { useCallback, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { ORDER_SOURCE_LABELS } from "./ordersMockData";
import {
  createKitchenBoard,
  ticketTraceStyle,
  type KitchenColumnId,
  type KitchenTicket
} from "./kitchenMockData";

function WaitingBadge({ minutes }: { minutes: number }) {
  const tone = minutes >= 30 ? "critical" : minutes >= 15 ? "warning" : "normal";
  return <span className={`admin-orders-wait admin-orders-wait--${tone}`}>{minutes} min</span>;
}

function PriorityDot({ priority }: { priority: KitchenTicket["priority"] }) {
  if (priority === "normal") return null;
  return (
    <span className={`admin-orders-priority admin-orders-priority--${priority}`}>
      {priority === "rush" ? "Rush" : "High"}
    </span>
  );
}

const COLUMNS: Array<{
  id: KitchenColumnId;
  title: string;
  actions: string[];
}> = [
  { id: "new", title: "New", actions: ["Accept", "Start"] },
  { id: "preparing", title: "Preparing", actions: ["Ready"] },
  { id: "ready", title: "Ready", actions: ["Complete"] }
];

function ticketsForColumn(tickets: KitchenTicket[], columnId: KitchenColumnId): KitchenTicket[] {
  return tickets.filter((t) => t.kitchenColumn === columnId);
}

function applyColumn(ticket: KitchenTicket, column: KitchenColumnId): KitchenTicket {
  if (ticket.readyLocked && column !== "ready") return ticket;

  if (column === "ready") {
    return {
      ...ticket,
      kitchenColumn: "ready",
      kitchenStatus: "READY",
      status: "READY",
      readyLocked: true
    };
  }
  if (column === "preparing") {
    return {
      ...ticket,
      kitchenColumn: "preparing",
      kitchenStatus: "PREPARING",
      status: "PREPARING",
      readyLocked: false
    };
  }
  return {
    ...ticket,
    kitchenColumn: "new",
    kitchenStatus: "NEW",
    status: "CREATED",
    readyLocked: false
  };
}

type Props = {
  onOpen: (order: KitchenTicket) => void;
  onAction: (label: string) => void;
  fullscreen?: boolean;
};

function PreparingBorderTrace({ ticketId }: { ticketId: string }) {
  const gradId = `kds-trace-${ticketId.replace(/[^a-z0-9-]/gi, "")}`;
  const style = ticketTraceStyle(ticketId) as CSSProperties;
  return (
    <svg className="admin-orders-kds-border-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden style={style}>
      <defs>
        <linearGradient id={gradId} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0" />
          <stop offset="28%" stopColor="#7c3aed" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#2563eb" stopOpacity="1" />
          <stop offset="72%" stopColor="#7c3aed" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        className="admin-orders-kds-border-svg-stroke"
        x="1"
        y="1"
        width="98"
        height="98"
        rx="10"
        ry="10"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        strokeDasharray="0.042 3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function KitchenKanban({ onOpen, onAction, fullscreen = false }: Props) {
  const [tickets, setTickets] = useState<KitchenTicket[]>(() => createKitchenBoard(20));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KitchenColumnId | null>(null);

  const moveToColumn = useCallback((ticketId: string, column: KitchenColumnId) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        if (t.readyLocked) return t;
        return applyColumn(t, column);
      })
    );
  }, []);

  const runAction = useCallback(
    (ticket: KitchenTicket, action: string) => {
      if (action === "Start" || action === "Accept") {
        if (ticket.kitchenColumn === "new" && !ticket.readyLocked) {
          moveToColumn(ticket.id, "preparing");
        }
      } else if (action === "Ready") {
        moveToColumn(ticket.id, "ready");
      } else if (action === "Complete") {
        setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
      }
      onAction(`${action} — ${ticket.displayNumber}`);
    },
    [moveToColumn, onAction]
  );

  const onDragStart = (e: DragEvent<HTMLLIElement>, ticket: KitchenTicket) => {
    if (ticket.readyLocked) {
      e.preventDefault();
      return;
    }
    setDraggingId(ticket.id);
    e.dataTransfer.setData("text/plain", ticket.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
  };

  const onColumnDragOver = (e: DragEvent<HTMLUListElement>, columnId: KitchenColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const onColumnDrop = (e: DragEvent<HTMLUListElement>, columnId: KitchenColumnId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket || ticket.readyLocked) return;
    moveToColumn(id, columnId);
    setDraggingId(null);
    setDragOverColumn(null);
  };

  const columnTickets = useMemo(
    () =>
      COLUMNS.reduce(
        (acc, col) => {
          acc[col.id] = ticketsForColumn(tickets, col.id);
          return acc;
        },
        {} as Record<KitchenColumnId, KitchenTicket[]>
      ),
    [tickets]
  );

  const renderTicket = (ticket: KitchenTicket, col: (typeof COLUMNS)[number], fs: boolean) => {
    const toneClass =
      ticket.kitchenColumn === "ready"
        ? "admin-orders-kds-ticket--ready"
        : ticket.kitchenColumn === "preparing"
          ? "admin-orders-kds-ticket--preparing"
          : "admin-orders-kds-ticket--new";

    const isPreparing = ticket.kitchenColumn === "preparing";
    const traceStyle = isPreparing ? (ticketTraceStyle(ticket.id) as CSSProperties) : undefined;
    const isDragging = draggingId === ticket.id;
    const canDrag = !ticket.readyLocked;

    const inner = (
      <>
        <div className="admin-orders-kds-fs-ticket-info">
          <div className="admin-orders-kds-fs-ticket-top">
            <span className="admin-orders-kds-fs-number">{ticket.displayNumber}</span>
            <WaitingBadge minutes={ticket.waitingMinutes} />
            <PriorityDot priority={ticket.priority} />
            {ticket.readyLocked ? <span className="admin-orders-kds-locked">Locked</span> : null}
          </div>
          <p className="admin-orders-kds-fs-items">{ticket.itemsSummary}</p>
          <p className="admin-orders-kds-fs-meta">
            {ORDER_SOURCE_LABELS[ticket.source]}
            {ticket.tableNumber ? ` · ${ticket.tableNumber}` : ""}
          </p>
        </div>
        <div className="admin-orders-kds-fs-actions">
          {col.actions.map((action) => (
            <button
              key={action}
              type="button"
              className="admin-orders-kds-fs-btn"
              onClick={() => runAction(ticket, action)}
            >
              {action}
            </button>
          ))}
        </div>
      </>
    );

    if (fs) {
      return (
        <li
          key={ticket.id}
          className={`admin-orders-kds-fs-ticket-outer ${toneClass}${isDragging ? " is-dragging" : ""}${!canDrag ? " is-locked" : ""}`}
          style={traceStyle}
          draggable={canDrag}
          onDragStart={(e) => onDragStart(e, ticket)}
          onDragEnd={onDragEnd}
        >
          {isPreparing ? <PreparingBorderTrace ticketId={ticket.id} /> : null}
          <div className="admin-orders-kds-fs-ticket">{inner}</div>
        </li>
      );
    }

    return (
      <li
        key={ticket.id}
        className={`admin-orders-kds-card-outer ${toneClass}${isDragging ? " is-dragging" : ""}${!canDrag ? " is-locked" : ""}`}
        style={traceStyle}
        draggable={canDrag}
        onDragStart={(e) => onDragStart(e, ticket)}
        onDragEnd={onDragEnd}
      >
        {isPreparing ? <PreparingBorderTrace ticketId={ticket.id} /> : null}
        <div className="admin-orders-kds-card">
          <button type="button" className="admin-orders-kds-card-head" onClick={() => onOpen(ticket)}>
            <span className="admin-orders-kds-number">{ticket.displayNumber}</span>
            <WaitingBadge minutes={ticket.waitingMinutes} />
          </button>
          <p className="admin-orders-kds-items">{ticket.itemsSummary}</p>
          <p className="admin-orders-kds-meta">
            {ORDER_SOURCE_LABELS[ticket.source]}
            {ticket.tableNumber ? ` · ${ticket.tableNumber}` : ""}
          </p>
          <PriorityDot priority={ticket.priority} />
          <div className="admin-orders-kds-actions">
            {col.actions.map((action) => (
              <button
                key={action}
                type="button"
                className="admin-orders-kds-btn"
                onClick={() => runAction(ticket, action)}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </li>
    );
  };

  const rootClass = `admin-orders-kds${fullscreen ? " admin-orders-kds--fullscreen" : ""}`;

  return (
    <div className={rootClass}>
      {COLUMNS.map((col) => {
        const colOrders = columnTickets[col.id];
        const listClass = fullscreen
          ? `admin-orders-kds-fs-list${dragOverColumn === col.id ? " is-drag-over" : ""}`
          : `admin-orders-kds-list${dragOverColumn === col.id ? " is-drag-over" : ""}`;

        return fullscreen ? (
          <section key={col.id} className={`admin-orders-kds-fs-col admin-orders-kds-fs-col--${col.id}`}>
            <header className="admin-orders-kds-fs-head">
              <h3>{col.title}</h3>
              <span className="admin-orders-kds-fs-count">{colOrders.length}</span>
            </header>
            <ul
              className={listClass}
              onDragOver={(e) => onColumnDragOver(e, col.id)}
              onDragLeave={() => setDragOverColumn((c) => (c === col.id ? null : c))}
              onDrop={(e) => onColumnDrop(e, col.id)}
            >
              {colOrders.length === 0 ? (
                <li className="admin-orders-kds-fs-empty">Drop tickets here</li>
              ) : (
                colOrders.map((ticket) => renderTicket(ticket, col, true))
              )}
            </ul>
          </section>
        ) : (
          <div key={col.id} className={`admin-orders-kds-col admin-orders-kds-col--${col.id}`}>
            <header className="admin-orders-kds-col-header">
              <h3>{col.title}</h3>
              <span className="admin-orders-kds-count">{colOrders.length}</span>
            </header>
            <ul
              className={listClass}
              onDragOver={(e) => onColumnDragOver(e, col.id)}
              onDragLeave={() => setDragOverColumn((c) => (c === col.id ? null : c))}
              onDrop={(e) => onColumnDrop(e, col.id)}
            >
              {colOrders.length === 0 ? (
                <li className="admin-orders-kds-empty">Drop tickets here</li>
              ) : (
                colOrders.map((ticket) => renderTicket(ticket, col, false))
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
