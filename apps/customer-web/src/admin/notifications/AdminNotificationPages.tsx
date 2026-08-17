import { useEffect, useState } from "react";
import { AdminBtnSecondary, AdminEmptyState, AdminPanel, AdminSectionHeader } from "../AdminUi";
import { ADMIN_NOTIFICATION_HASHES } from "../adminTopHashes";
import {
  ADMIN_NOTIFICATION_CATEGORIES,
  isNotificationCategoryHash,
  resolveNotificationCategory,
  type NotificationCategory
} from "./notificationRouting";
import {
  adminHrefFromTarget,
  fetchAdminNotifications,
  fetchCommsAudit,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsWebSocketUrl,
  type AdminNotificationRow,
  type CommsThread
} from "../comms/commsApi";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function NotifyFilters({ activeHref }: { activeHref: string }) {
  return (
    <div className="admin-notify-filters" role="tablist" aria-label="Notification filters">
      {ADMIN_NOTIFICATION_CATEGORIES.map((c) => (
        <a
          key={c.id}
          href={c.href}
          role="tab"
          aria-selected={c.href === activeHref}
          className={`admin-payments-methods-family-chip${c.href === activeHref ? " is-active" : ""}`}
        >
          {c.label}
        </a>
      ))}
    </div>
  );
}

function NotificationList({
  token,
  filter
}: {
  token: string;
  filter: Exclude<NotificationCategory["filter"], "logs">;
}) {
  const [rows, setRows] = useState<AdminNotificationRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetchAdminNotifications(token, filter);
    if (res.ok && res.notifications) setRows(res.notifications);
  };

  useEffect(() => {
    void load();
    const url = notificationsWebSocketUrl(token);
    const ws = new WebSocket(url);
    ws.onmessage = () => {
      void load();
    };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);

  const open = async (row: AdminNotificationRow) => {
    if (!row.readAt) await markNotificationRead(token, row.id);
    const href = adminHrefFromTarget(row.payload as Record<string, unknown>);
    if (href) {
      window.location.hash = href.startsWith("#") ? href : `#${href}`;
    } else {
      void load();
    }
  };

  return (
    <>
      {rows.length === 0 ? (
        <AdminEmptyState>No notifications in this filter.</AdminEmptyState>
      ) : (
        <div className="admin-notify-list">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`admin-notify-row${row.readAt ? "" : " is-unread"}`}
              onClick={() => void open(row)}
            >
              <span className="admin-notify-row-title">{row.title}</span>
              <span className="admin-notify-row-body">{row.body}</span>
              <span className="admin-notify-row-meta">
                {row.category} · {row.priority} · {formatWhen(row.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
      <footer className="admin-notify-footer">
        <AdminBtnSecondary
          type="button"
          disabled={busy || rows.every((r) => r.readAt)}
          onClick={async () => {
            setBusy(true);
            await markAllNotificationsRead(token);
            setBusy(false);
            void load();
          }}
        >
          Mark all read
        </AdminBtnSecondary>
      </footer>
    </>
  );
}

function AuditList({ token, restaurantId }: { token: string; restaurantId: string }) {
  const [events, setEvents] = useState<CommsThread[]>([]);

  useEffect(() => {
    void fetchCommsAudit(token, restaurantId).then((res) => {
      if (res.ok && res.events) setEvents(res.events);
    });
  }, [token, restaurantId]);

  if (!events.length) {
    return <AdminEmptyState>No audit events yet for this venue.</AdminEmptyState>;
  }

  return (
    <div className="admin-notify-list">
      {events.map((ev) => (
        <a key={ev.id} href={ev.href} className="admin-notify-row">
          <span className="admin-notify-row-title">{ev.name}</span>
          <span className="admin-notify-row-body">{ev.preview}</span>
          <span className="admin-notify-row-meta">{formatWhen(ev.lastMessageAt)}</span>
        </a>
      ))}
    </div>
  );
}

export function AdminNotificationPageRouter({
  hash,
  token,
  restaurantId
}: {
  hash: string;
  token?: string | null;
  restaurantId?: string | null;
}) {
  const category =
    resolveNotificationCategory(hash) ??
    (hash === ADMIN_NOTIFICATION_HASHES.logs
      ? ADMIN_NOTIFICATION_CATEGORIES.find((c) => c.id === "logs")
      : null);
  if (!category || !isNotificationCategoryHash(hash)) return null;

  return (
    <AdminPanel id={hash.slice(1)} className="admin-top-page admin-panel--edge">
      <AdminSectionHeader
        eyebrowText="Notifications"
        title={category.label}
        description={category.description}
      />
      <div className="mt-6">
        <NotifyFilters activeHref={category.href} />
        {!token ? (
          <AdminEmptyState>Sign in to load notifications.</AdminEmptyState>
        ) : category.filter === "logs" ? (
          restaurantId ? (
            <AuditList token={token} restaurantId={restaurantId} />
          ) : (
            <AdminEmptyState>Select a venue to view logs.</AdminEmptyState>
          )
        ) : (
          <NotificationList token={token} filter={category.filter} />
        )}
      </div>
    </AdminPanel>
  );
}
