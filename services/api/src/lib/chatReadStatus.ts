/** WhatsApp-style customer → venue receipt states (server-owned). */
export type OutgoingDeliveryStatus = "sent" | "delivered" | "read";

export function computeOutgoingDeliveryStatus(input: {
  messageCreatedAt: Date;
  deliveredToVenueAt: Date | null;
  restaurantLastReadAt: Date | null;
}): OutgoingDeliveryStatus {
  const readAt = input.restaurantLastReadAt;
  if (readAt && readAt.getTime() >= input.messageCreatedAt.getTime()) return "read";
  if (input.deliveredToVenueAt) return "delivered";
  return "sent";
}

/** Tick color on customer purple bubbles. */
export function deliveryTickColor(status: OutgoingDeliveryStatus): string {
  if (status === "read") return "#53BDEB";
  return "rgba(255,255,255,0.72)";
}
