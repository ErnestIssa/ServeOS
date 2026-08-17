import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPanel, AdminSectionHeader } from "../AdminUi";
import {
  parseAdminHashQuery,
  resolveWorkspacePreset,
  syncAdminNavHash,
  WORKSPACE_META,
  type WorkspaceId
} from "../adminWorkspaceRouting";
import { useAdminHash } from "../useAdminHash";
import {
  commsViewFromFilter,
  fetchCommsCatchUp,
  fetchCommsContext,
  fetchCommsThread,
  fetchCommsThreadAfter,
  fetchCommsThreads,
  sendCommsMessage,
  venueChatWebSocketUrl,
  type CommsContext,
  type CommsMessage,
  type CommsThread,
  type CommsView
} from "./commsApi";
import {
  demoContextForThread,
  demoMessagesForThread,
  demoStaffReply,
  demoThreadsForView,
  isDemoCommsId
} from "./commsDemoData";
import { MessageScrollerProvider } from "@/components/ui/message-scroller";
import { InputGroup, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { CommsMessageFeed } from "./CommsMessageFeed";

type Props = {
  workspaceId: WorkspaceId;
  activePresetId: string;
  token: string | null;
  restaurantId: string | null;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatSek(cents: number) {
  return `${(cents / 100).toFixed(0)} kr`;
}

export function AdminCommunicationHub({ workspaceId, activePresetId, token, restaurantId }: Props) {
  const meta = WORKSPACE_META[workspaceId];
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);
  const view: CommsView = commsViewFromFilter(preset.filter);
  const hash = useAdminHash();
  const hashRoomId = parseAdminHashQuery(hash).get("roomId");

  const [threads, setThreads] = useState<CommsThread[]>([]);
  const [threadQuery, setThreadQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(hashRoomId);
  const [messages, setMessages] = useState<CommsMessage[]>([]);
  const [context, setContext] = useState<CommsContext | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<CommsMessage[]>([]);
  messagesRef.current = messages;

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId]
  );
  const isSystem = view === "system" || activeThread?.kind === "event";
  const canCompose = Boolean(activeThread && activeThread.kind === "room" && !isSystem);

  const loadThreads = useCallback(async () => {
    const demo = demoThreadsForView(view);
    if (!token || !restaurantId) {
      setThreads(demo);
      return;
    }
    const res = await fetchCommsThreads(token, restaurantId, view, {
      q: threadQuery.trim() || undefined
    });
    if (res.ok && res.threads && res.threads.length > 0) {
      setThreads(res.threads);
      return;
    }
    setThreads(demo);
  }, [token, restaurantId, view, threadQuery]);

  const openThread = useCallback(
    async (id: string, syncHash = true) => {
      setActiveId(id);
      if (syncHash) syncAdminNavHash(`#ws-comms/${activePresetId}?roomId=${encodeURIComponent(id)}`);
      if (id.startsWith("audit:") || id.startsWith("staff-audit:") || id.startsWith("notif:") || id.startsWith("demo:sys-")) {
        setMessages([]);
        setContext(null);
        return;
      }
      if (isDemoCommsId(id)) {
        setLoading(false);
        setMessages(demoMessagesForThread(id));
        setContext(demoContextForThread(id));
        setThreads((cur) => cur.map((t) => (t.id === id ? { ...t, unread: false } : t)));
        return;
      }
      if (!token || !restaurantId) return;
      setLoading(true);
      const [msgRes, ctxRes] = await Promise.all([
        fetchCommsThread(token, restaurantId, id),
        fetchCommsContext(token, restaurantId, id)
      ]);
      setLoading(false);
      if (msgRes.ok) {
        setMessages(msgRes.messages ?? []);
        if (msgRes.room) {
          setThreads((cur) => cur.map((t) => (t.id === id ? { ...t, unread: false } : t)));
        }
      }
      if (ctxRes.ok) setContext(ctxRes.context ?? null);
    },
    [activePresetId, restaurantId, token]
  );

  useEffect(() => {
    setDraft("");
    void loadThreads();
  }, [loadThreads]);

  const threadIds = useMemo(() => threads.map((t) => t.id).join("|"), [threads]);
  const showingDemo = threads.some((t) => isDemoCommsId(t.id));

  useEffect(() => {
    if (!threadIds) return;
    const ids = threadIds.split("|");
    if (hashRoomId && ids.includes(hashRoomId)) {
      void openThread(hashRoomId, false);
      return;
    }
    if (activeId && ids.includes(activeId)) return;
    void openThread(ids[0]!, true);
  }, [hashRoomId, threadIds, openThread, activeId]);

  useEffect(() => {
    if (!token || !restaurantId) return;
    const url = venueChatWebSocketUrl(token, restaurantId);
    const ws = new WebSocket(url);
    ws.onopen = () => {
      if (showingDemo) return;
      const since = new Date(Date.now() - 120_000).toISOString();
      void fetchCommsCatchUp(token, restaurantId, since).then(() => loadThreads());
      const lastId = messagesRef.current.at(-1)?.id;
      if (activeId && lastId && !activeId.startsWith("audit:") && !activeId.startsWith("notif:")) {
        void fetchCommsThreadAfter(token, restaurantId, activeId, lastId).then((res) => {
          if (res.ok && res.messages?.length) {
            setMessages((cur) => {
              const seen = new Set(cur.map((m) => m.id));
              return [...cur, ...res.messages!.filter((m) => !seen.has(m.id))];
            });
          }
        });
      }
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as { type?: string; message?: CommsMessage };
        if (data.type === "new_message") {
          void loadThreads();
          if (data.message && data.message.chatRoomId === activeId) {
            setMessages((cur) => (cur.some((m) => m.id === data.message!.id) ? cur : [...cur, data.message!]));
          }
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [token, restaurantId, activeId, loadThreads, showingDemo]);

  const send = async () => {
    if (!activeId || !draft.trim() || !canCompose) return;
    const text = draft.trim();
    if (isDemoCommsId(activeId)) {
      const local = demoStaffReply(activeId, text);
      setDraft("");
      setMessages((cur) => [...cur, local]);
      setThreads((cur) =>
        cur.map((t) => (t.id === activeId ? { ...t, preview: text, lastMessageAt: local.createdAt, unread: false } : t))
      );
      return;
    }
    if (!token || !restaurantId) return;
    setSending(true);
    const res = await sendCommsMessage(token, restaurantId, activeId, text);
    setSending(false);
    if (res.ok && res.message) {
      setDraft("");
      setMessages((cur) => [...cur, res.message!]);
      void loadThreads();
    }
  };

  return (
    <AdminPanel id="ws-comms" className="admin-top-page admin-panel--edge admin-comms-page">
      <AdminSectionHeader
        eyebrowText={meta.eyebrow}
        title={preset.label}
        description={
          (view === "customer"
            ? "Guest messages that need a reply — each row opens the operational thread."
            : view === "staff"
              ? "Kitchen, front of house, and managers. Operational channels only."
              : view === "system"
                ? "What happened. These lines come from domain events, not a chat."
                : "Order and reservation threads. Chat stays tied to the live order.") +
          (showingDemo ? " Preview layout with sample venue activity." : "")
        }
      />

      <div className="admin-comms-hub">
        <aside className="admin-comms-threads" aria-label="Threads">
          <input
            className="admin-comms-search"
            value={threadQuery}
            onChange={(e) => setThreadQuery(e.target.value)}
            placeholder="Search order, table, customer…"
            aria-label="Search threads"
          />
          {threads.length === 0 ? (
            <p className="admin-comms-empty">Nothing in this view yet.</p>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`admin-comms-thread${activeId === thread.id ? " is-active" : ""}${thread.unread ? " is-unread" : ""}`}
                onClick={() => void openThread(thread.id)}
              >
                <span className="admin-comms-thread-name">{thread.name}</span>
                <span className="admin-comms-thread-meta">
                  {thread.customerLabel ? `${thread.customerLabel} · ` : ""}
                  {formatWhen(thread.lastMessageAt)}
                </span>
                <span className="admin-comms-thread-preview">{thread.preview}</span>
              </button>
            ))
          )}
        </aside>

        <section className="admin-comms-conversation">
          {activeThread ? (
            <MessageScrollerProvider>
              <header className="admin-comms-conv-head">
                <div>
                  <p className="admin-comms-kicker">{activeThread.type.replace(/_/g, " ")}</p>
                  <h2>{activeThread.name}</h2>
                  <p className="admin-comms-sub">
                    {activeThread.orderStatus ? `Status · ${activeThread.orderStatus}` : activeThread.preview}
                  </p>
                </div>
              </header>
              {isSystem && activeThread.kind === "event" ? (
                <div className="admin-comms-feed">
                  <CommsMessageFeed
                    loading={false}
                    empty={false}
                    messages={[
                      {
                        id: activeThread.id,
                        chatRoomId: activeThread.id,
                        senderUserId: null,
                        senderRole: "SYSTEM",
                        content: `${activeThread.name} — ${activeThread.preview}`,
                        type: "SYSTEM",
                        createdAt: activeThread.lastMessageAt,
                        isSystem: true
                      }
                    ]}
                  />
                </div>
              ) : (
                <div className="admin-comms-feed">
                  <CommsMessageFeed loading={loading} empty={messages.length === 0} messages={messages} />
                </div>
              )}
              {canCompose ? (
                <form
                  className="admin-comms-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <InputGroup>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Reply to this thread…"
                      maxLength={2000}
                      aria-label="Message"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton type="submit" size="icon-sm" disabled={sending || !draft.trim()}>
                        <span aria-hidden="true">↑</span>
                        <span className="sr-only">Send</span>
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </form>
              ) : (
                <p className="admin-comms-composer-note">This view is a timeline. Reply from the related order thread.</p>
              )}
            </MessageScrollerProvider>
          ) : (
            <div className="admin-comms-empty-pane">
              <p>Select a thread. The conversation and order context open here.</p>
            </div>
          )}
        </section>

        <aside className="admin-comms-context" aria-label="Order context">
          {context?.order ? (
            <div>
              <p className="admin-comms-kicker">Order</p>
              <h3>{context.order.displayNumber}</h3>
              <dl className="admin-comms-kv">
                <div>
                  <dt>Status</dt>
                  <dd>{context.order.status}</dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>{context.order.paymentStatus}</dd>
                </div>
                <div>
                  <dt>Guest</dt>
                  <dd>{context.order.customerName}</dd>
                </div>
                <div>
                  <dt>Table</dt>
                  <dd>{context.order.tableLabel ?? "—"}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{formatSek(context.order.totalCents)}</dd>
                </div>
              </dl>
              <ul className="admin-comms-items">
                {context.order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.name}
                  </li>
                ))}
              </ul>
              {context.order.note ? <p className="admin-comms-note">{context.order.note}</p> : null}
              <a className="admin-comms-open-order" href={`#ws-orders/all-orders`}>
                Open orders
              </a>
            </div>
          ) : context?.reservation ? (
            <div>
              <p className="admin-comms-kicker">Reservation</p>
              <h3>{context.reservation.confirmationCode}</h3>
              <dl className="admin-comms-kv">
                <div>
                  <dt>Status</dt>
                  <dd>{context.reservation.status}</dd>
                </div>
                <div>
                  <dt>When</dt>
                  <dd>{formatWhen(context.reservation.startsAt)}</dd>
                </div>
              </dl>
            </div>
          ) : context?.table ? (
            <div>
              <p className="admin-comms-kicker">Table</p>
              <h3>{context.table.tableLabel ? `Table ${context.table.tableLabel}` : "Table"}</h3>
              <p className="admin-comms-sub">Guest chat without an order yet.</p>
            </div>
          ) : (
            <p className="admin-comms-empty">
              {view === "staff"
                ? "Staff channels are operational rooms — no guest order on the side."
                : "Select an order thread to see items, payment, and table."}
            </p>
          )}
        </aside>
      </div>
    </AdminPanel>
  );
}
