import { apiHttpToWsBase } from "../api";

export type OclWsPayload = {
  type?: string;
  entityType?: string;
  entityId?: string;
  orderId?: string;
  reservationId?: string;
};

/** Staff/order workspace — backend pushes `ocl_updated` on order bus rooms. */
export function subscribeOclEntity(
  apiUrl: string,
  entityType: "order" | "reservation",
  entityId: string,
  onUpdate: (payload: OclWsPayload) => void
): () => void {
  if (entityType === "order") {
    const url = `${apiHttpToWsBase(apiUrl)}/orders/events?${new URLSearchParams({ orderId: entityId }).toString()}`;
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as OclWsPayload;
        if (data.type === "ocl_updated" || data.type === "order_updated") onUpdate(data);
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }
  return () => undefined;
}
