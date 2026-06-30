import { apiFetch } from "../api";

export type OrderingSessionRow = {
  id: string;
  restaurantId: string;
  sessionType: string;
  status: string;
  paymentMode: "PAY_AT_VENUE" | "PREPAY" | "HYBRID";
  tableLabel: string | null;
  expiresAt: string;
  menuUrl: string;
};

export async function createGuestOrderingSession(
  restaurantId: string,
  opts?: { paymentMode?: OrderingSessionRow["paymentMode"]; tableLabel?: string }
) {
  return apiFetch<{ ok: boolean; session?: OrderingSessionRow; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/ordering-sessions/guest`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionType: "LINK_SESSION",
        entryMode: "APP",
        paymentMode: opts?.paymentMode ?? "PAY_AT_VENUE",
        tableLabel: opts?.tableLabel
      })
    }
  );
}

export async function touchOrderingSession(sessionId: string) {
  return apiFetch<{ ok: boolean; session?: OrderingSessionRow; error?: string }>(
    `/ordering-sessions/${encodeURIComponent(sessionId)}/touch`,
    { method: "POST" }
  );
}

export async function fetchSessionMenu(sessionId: string) {
  return apiFetch<{
    ok: boolean;
    restaurant?: { id: string; name: string };
    categories?: unknown[];
    error?: string;
  }>(`/ordering-sessions/${encodeURIComponent(sessionId)}/menu`);
}
