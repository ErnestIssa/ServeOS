import type { ThreadFeedItem } from "../customerChatApi";

export function isIncomingMessage(item: ThreadFeedItem): boolean {
  return item.kind === "message" && item.senderRole !== "CUSTOMER";
}

export function isMessageUnread(item: ThreadFeedItem, customerLastReadAt: string | null | undefined): boolean {
  if (item.kind !== "message" || !isIncomingMessage(item)) return false;
  const readMs = customerLastReadAt ? new Date(customerLastReadAt).getTime() : 0;
  return new Date(item.createdAt).getTime() > readMs;
}
