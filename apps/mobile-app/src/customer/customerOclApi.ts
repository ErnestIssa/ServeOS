import { apiFetch } from "../api";

export type CustomerOclTimelineRow = { key: string; content: string; kind: string; at?: string };

export type CustomerOrderOclSnapshot = {
  ok: true;
  entityType: "order";
  orderId: string;
  header: {
    orderId: string;
    shortId: string;
    status: string;
    statusLabel: string;
    restaurantName: string;
    totalCents: number;
    elapsedMinutes: number;
  };
  timeline: Array<{ id: string; kind: string; at: string; title: string; detail?: string }>;
};

export async function fetchCustomerOrderOcl(token: string, orderId: string) {
  return apiFetch<CustomerOrderOclSnapshot | { ok: false; error?: string }>(
    `/customer/orders/${encodeURIComponent(orderId)}/ocl`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}
