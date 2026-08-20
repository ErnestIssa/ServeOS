import { AnimatePresence, motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerViewport
} from "@/components/ui/message-scroller";
import type { CommsMessage } from "./commsApi";
import { CommsColumnLoader } from "./CommsColumnLoader";
import { COMMS_PANE_MOTION } from "./commsPaneMotion";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function deliveryLabel(status: CommsMessage["deliveryStatus"]) {
  if (status === "read") return "Read";
  if (status === "delivered") return "Delivered";
  if (status === "sent") return "Sent";
  return null;
}

type Block =
  | { kind: "system"; message: CommsMessage }
  | { kind: "group"; align: "start" | "end"; role: string; messages: CommsMessage[] };

function blocksFor(messages: CommsMessage[]): Block[] {
  const blocks: Block[] = [];
  for (const message of messages) {
    if (message.isSystem || message.type === "SYSTEM") {
      blocks.push({ kind: "system", message });
      continue;
    }
    const align = message.senderRole === "CUSTOMER" ? "start" : "end";
    const last = blocks[blocks.length - 1];
    if (last?.kind === "group" && last.role === message.senderRole) {
      last.messages.push(message);
    } else {
      blocks.push({ kind: "group", align, role: message.senderRole, messages: [message] });
    }
  }
  return blocks;
}

function initials(role: string) {
  if (role === "CUSTOMER") return "G";
  if (role === "KITCHEN") return "K";
  return "V";
}

export function CommsMessageFeed({
  messages,
  empty,
  loading,
  threadKey = "thread"
}: {
  messages: CommsMessage[];
  empty: boolean;
  loading: boolean;
  threadKey?: string;
}) {
  if (loading) {
    return <CommsColumnLoader className="admin-comms-pane-loading--feed" />;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={threadKey} className="admin-comms-feed-motion" {...COMMS_PANE_MOTION}>
        {empty ? (
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent className="admin-comms-feed-inner">
                <Marker>
                  <MarkerContent>No messages yet. Operational updates will appear here.</MarkerContent>
                </Marker>
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        ) : (
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent className="admin-comms-feed-inner">
                {blocksFor(messages).map((block) => {
                  if (block.kind === "system") {
                    return (
                      <Marker key={block.message.id}>
                        <MarkerContent>
                          <span className="ui-marker-kicker">System</span>
                          {block.message.content}
                          <span className="ui-marker-time">{formatWhen(block.message.createdAt)}</span>
                        </MarkerContent>
                      </Marker>
                    );
                  }
                  const last = block.messages[block.messages.length - 1]!;
                  const footer = block.align === "end" ? deliveryLabel(last.deliveryStatus) : null;
                  const bubbles = block.messages.map((m) => (
                    <Bubble key={m.id} variant={block.align === "start" ? "muted" : "default"}>
                      <BubbleContent>{m.content}</BubbleContent>
                    </Bubble>
                  ));
                  return (
                    <Message key={last.id} align={block.align}>
                      <MessageAvatar>
                        <Avatar>
                          <AvatarFallback>{initials(block.role)}</AvatarFallback>
                        </Avatar>
                      </MessageAvatar>
                      <MessageContent>
                        {block.messages.length > 1 ? <BubbleGroup>{bubbles}</BubbleGroup> : bubbles}
                        {footer ? <MessageFooter>{footer}</MessageFooter> : null}
                      </MessageContent>
                    </Message>
                  );
                })}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
