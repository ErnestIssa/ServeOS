import { AnimatePresence, motion } from "framer-motion";
import type { CommsThread } from "./commsApi";
import { CommsColumnLoader } from "./CommsColumnLoader";
import { COMMS_LIST_ITEM_MOTION } from "./commsPaneMotion";

type Props = {
  threads: CommsThread[];
  activeId: string | null;
  pending: boolean;
  emptyQuery: boolean;
  variant?: "default" | "order";
  formatWhen: (iso: string) => string;
  orderStatusTone?: (status: string | null | undefined) => string;
  onOpen: (id: string) => void;
};

export function CommsThreadsList({
  threads,
  activeId,
  pending,
  emptyQuery,
  variant = "default",
  formatWhen,
  orderStatusTone,
  onOpen
}: Props) {
  if (pending) {
    return <CommsColumnLoader className="admin-comms-pane-loading--threads" />;
  }

  if (threads.length === 0) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={emptyQuery ? "no-match" : "empty"}
          className="admin-comms-empty admin-comms-threads-empty"
          {...COMMS_LIST_ITEM_MOTION}
        >
          {emptyQuery ? "No threads match your search." : "Nothing in this view yet."}
        </motion.p>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {threads.map((thread) => (
        <motion.button
          key={thread.id}
          type="button"
          layout
          className={`admin-comms-thread${activeId === thread.id ? " is-active" : ""}${thread.unread ? " is-unread" : ""}`}
          onClick={() => onOpen(thread.id)}
          {...COMMS_LIST_ITEM_MOTION}
        >
          {variant === "order" ? (
            <>
              <span className="admin-comms-thread-top">
                <span className="admin-comms-thread-name">{thread.name}</span>
                {thread.orderStatus && orderStatusTone ? (
                  <span className={`admin-comms-thread-status admin-comms-thread-status--${orderStatusTone(thread.orderStatus)}`}>
                    {thread.orderStatus.replace(/_/g, " ")}
                  </span>
                ) : null}
              </span>
              <span className="admin-comms-thread-meta">
                {thread.customerLabel ? `${thread.customerLabel} · ` : ""}
                {formatWhen(thread.lastMessageAt)}
              </span>
              <span className="admin-comms-thread-preview">{thread.preview}</span>
            </>
          ) : (
            <>
              <span className="admin-comms-thread-name">{thread.name}</span>
              <span className="admin-comms-thread-meta">
                {thread.customerLabel ? `${thread.customerLabel} · ` : ""}
                {formatWhen(thread.lastMessageAt)}
              </span>
              <span className="admin-comms-thread-preview">{thread.preview}</span>
            </>
          )}
        </motion.button>
      ))}
    </AnimatePresence>
  );
}
