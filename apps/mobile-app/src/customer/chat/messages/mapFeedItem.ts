import type { ThreadFeedItem } from "../../customerChatApi";
import { formatDateSeparatorLabel, isEmojiOnlyMessage } from "./formatters";
import type { ChatMessageKind, ChatMessageViewModel, ListRow } from "./types";
import { isDateSeparator } from "./types";

const DOC_PREFIX = "DOC|";

function parseDocumentFeedContent(content: string): { fileName: string; url: string } | null {
  if (!content.startsWith(DOC_PREFIX)) return null;
  const body = content.slice(DOC_PREFIX.length);
  const sep = body.indexOf("|");
  if (sep <= 0) return null;
  const fileName = body.slice(0, sep).trim();
  const url = body.slice(sep + 1).trim();
  if (!fileName || !url) return null;
  return { fileName, url };
}

function mapType(type: string, content: string): ChatMessageKind {
  if (content.startsWith(DOC_PREFIX)) return "document";
  const upper = type.toUpperCase();
  const imageUri =
    content.startsWith("data:image/") || content.startsWith("http://") || content.startsWith("https://");
  if (upper === "IMAGE" || imageUri) return "image";
  if (upper === "VIDEO") return "video";
  if (upper === "AUDIO" || upper === "VOICE") return "voice";
  if (upper === "DOCUMENT" || upper === "FILE") return "document";
  if (upper === "SYSTEM") return "system";
  if (isEmojiOnlyMessage(content)) return "emoji_only";
  return "text";
}

export function mapFeedItemToViewModel(item: ThreadFeedItem): ChatMessageViewModel | null {
  if (item.kind === "system") {
    return {
      id: item.id,
      kind: "system",
      mine: false,
      senderRole: "SYSTEM",
      createdAt: item.at,
      content: item.content,
      raw: item
    };
  }

  const mine = item.isMine ?? item.senderRole === "CUSTOMER";
  const kind = mapType(item.type, item.content);
  let deliveryStatus = item.deliveryStatus ?? "sent";
  if (deliveryStatus === "sent" && mine) deliveryStatus = "sent";

  const doc = parseDocumentFeedContent(item.content);
  const content = doc ? doc.fileName : item.content;

  return {
    id: item.id,
    kind,
    mine,
    senderRole: item.senderRole,
    createdAt: item.createdAt,
    content,
    caption: doc?.url,
    deliveryStatus,
    raw: item
  };
}

export function buildListRows(feed: ThreadFeedItem[]): ListRow[] {
  const rows: ListRow[] = [];
  let lastDay: string | null = null;

  for (const item of feed) {
    const vm = mapFeedItemToViewModel(item);
    if (!vm) continue;
    const dayKey = vm.createdAt.slice(0, 10);
    if (dayKey !== lastDay) {
      rows.push({
        kind: "date_separator",
        id: `sep-${dayKey}`,
        label: formatDateSeparatorLabel(vm.createdAt)
      });
      lastDay = dayKey;
    }
    rows.push(vm);
  }
  return rows;
}

export function sameMessageGroup(a: ListRow, b: ListRow | undefined): boolean {
  if (!b || isDateSeparator(a) || isDateSeparator(b)) return false;
  if (a.kind === "system" || b.kind === "system") return false;
  return a.mine === b.mine && a.senderRole === b.senderRole;
}
