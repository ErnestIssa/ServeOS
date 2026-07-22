import { useEffect, useRef } from "react";
import { orderEventsWebSocketUrl } from "../../api";

type Options = {
  token: string | null;
  restaurantId: string | null;
  enabled?: boolean;
  /** Soft invalidate — refetch without treating as user recovery. */
  onEvent: () => void;
};

/**
 * Orders realtime (Layer 1). Silent reconnect with backoff.
 * Surfaces no "disconnected" chrome unless reconnect stays broken for a long stretch
 * (callers can read `lastError` later if we add UI — for now keep invisible).
 */
export function useOrdersRealtimeSync({ token, restaurantId, enabled = true, onEvent }: Options) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !token || !restaurantId) return;

    let closed = false;
    let ws: WebSocket | null = null;
    let retryTimer: number | null = null;
    let attempt = 0;

    const clearRetry = () => {
      if (retryTimer != null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const connect = () => {
      if (closed) return;
      clearRetry();
      const url = orderEventsWebSocketUrl({ restaurantId, token });
      ws = new WebSocket(url);

      ws.onopen = () => {
        attempt = 0;
      };

      ws.onmessage = () => {
        onEventRef.current();
      };

      ws.onclose = () => {
        ws = null;
        if (closed) return;
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
        attempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();

    return () => {
      closed = true;
      clearRetry();
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, token, restaurantId]);
}
