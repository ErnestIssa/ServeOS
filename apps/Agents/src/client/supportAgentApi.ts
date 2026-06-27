import type { SupportAgentChatRequest, SupportAgentChatResponse } from "../support/types.js";

export async function postSupportAgentChat(
  apiBaseUrl: string,
  body: SupportAgentChatRequest
): Promise<SupportAgentChatResponse> {
  const base = apiBaseUrl.replace(/\/$/, "");

  try {
    const res = await fetch(`${base}/api/support-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    try {
      const data = JSON.parse(text) as SupportAgentChatResponse;
      if (data && typeof data === "object" && "ok" in data) {
        return data;
      }
      if (!res.ok) {
        return { ok: false, error: `http_error_${res.status}` };
      }
      return { ok: true, reply: String((data as { reply?: string }).reply ?? "") };
    } catch {
      return { ok: false, error: text ? "bad_response" : "empty_response" };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "request_failed";
    if (/network|failed to fetch|timed out|timeout/i.test(msg)) {
      return {
        ok: false,
        error: "network_error",
        message: "Couldn't reach the server. Check your connection and try again."
      };
    }
    return { ok: false, error: msg };
  }
}
