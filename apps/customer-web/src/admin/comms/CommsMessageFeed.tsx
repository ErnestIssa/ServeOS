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
  loading
}: {
  messages: CommsMessage[];
  empty: boolean;
  loading: boolean;
}) {
  if (loading) {
    return <p className="admin-comms-empty">Loading thread…</p>;
  }
  if (empty) {
    return (
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="admin-comms-feed-inner">
            <Marker>
              <MarkerContent>No messages yet. Operational updates will appear here.</MarkerContent>
            </Marker>
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    );
  }

  const blocks = blocksFor(messages);

  return (
    <MessageScroller>
      <MessageScrollerViewport>
        <MessageScrollerContent className="admin-comms-feed-inner">
          {blocks.map((block) => {
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
  );
}
