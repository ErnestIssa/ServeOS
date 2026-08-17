import type { ThreadFeedItem } from "../../customerChatApi";
import { type ChatUiMessage, formatTimeLabel, type MessageDeliveryStatus } from "./chatUi";

function mapStatus(raw?: string, isOwn?: boolean): MessageDeliveryStatus | undefined {
  if (!isOwn) return undefined;
  if (raw === "read" || raw === "delivered" || raw === "sent" || raw === "failed" || raw === "sending") {
    return raw;
  }
  return "sent";
}

function displayText(content: string, type: string): string {
  if (content.startsWith("DOC|")) {
    const body = content.slice(4);
    const sep = body.indexOf("|");
    return sep > 0 ? `📎 ${body.slice(0, sep)}` : "📎 Document";
  }
  const upper = type.toUpperCase();
  if (upper === "IMAGE" || content.startsWith("data:image/") || /^https?:\/\//.test(content)) {
    if (content.startsWith("http") || content.startsWith("data:")) return "📷 Photo";
  }
  if (upper === "VIDEO") return "🎬 Video";
  if (upper === "AUDIO" || upper === "VOICE") return content.startsWith("🎤") ? content : "🎤 Voice message";
  return content;
}

/**
 * Map ServeOS thread feed → UNITY chat UI messages (display only).
 */
export function feedToUnityMessages(
  feed: ThreadFeedItem[],
  opts: { venueName: string; customerName?: string }
): ChatUiMessage[] {
  const venue = opts.venueName.trim() || "Venue";
  const you = opts.customerName?.trim() || "You";
  const out: ChatUiMessage[] = [];

  for (const item of feed) {
    if (item.kind === "system") {
      out.push({
        id: item.id,
        authorKey: "system-venue",
        author: "System",
        unit: "Venue",
        text: item.content,
        sentAt: item.at,
        timeLabel: formatTimeLabel(item.at),
        isOwn: false,
        isAdmin: true
      });
      continue;
    }

    const isOwn = Boolean(item.isMine ?? item.senderRole === "CUSTOMER");
    const author = isOwn ? you : item.senderRole === "STAFF" ? "Staff" : venue;
    const unit = isOwn ? "You" : "Venue";
    out.push({
      id: item.id,
      authorKey: `${author}-${unit}`,
      author,
      unit,
      text: displayText(item.content, item.type),
      sentAt: item.createdAt,
      timeLabel: formatTimeLabel(item.createdAt),
      isOwn,
      status: mapStatus(item.deliveryStatus, isOwn)
    });
  }
  return out;
}
