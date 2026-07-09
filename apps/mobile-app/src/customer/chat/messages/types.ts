import type { ThreadFeedItem } from "../../customerChatApi";

export type DeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed" | "uploading";

export type ChatMessageKind =
  | "text"
  | "image"
  | "images"
  | "video"
  | "audio"
  | "voice"
  | "document"
  | "pdf"
  | "zip"
  | "link"
  | "gif"
  | "emoji_only"
  | "sticker"
  | "product"
  | "workout"
  | "post"
  | "location"
  | "contact"
  | "poll"
  | "reply"
  | "forwarded"
  | "edited"
  | "deleted"
  | "system"
  | "scheduled"
  | "loading";

export type ChatMessageViewModel = {
  id: string;
  kind: ChatMessageKind;
  mine: boolean;
  senderRole: string;
  createdAt: string;
  content: string;
  deliveryStatus?: DeliveryStatus;
  edited?: boolean;
  forwarded?: boolean;
  deleted?: boolean;
  failed?: boolean;
  uploading?: boolean;
  replyTo?: { id: string; senderLabel: string; preview: string };
  caption?: string;
  raw: ThreadFeedItem;
};

export type DateSeparatorItem = {
  kind: "date_separator";
  id: string;
  label: string;
};

export type ListRow = ChatMessageViewModel | DateSeparatorItem;

export function isDateSeparator(row: ListRow): row is DateSeparatorItem {
  return "kind" in row && row.kind === "date_separator";
}

export function isChatMessage(row: ListRow): row is ChatMessageViewModel {
  return !isDateSeparator(row);
}
