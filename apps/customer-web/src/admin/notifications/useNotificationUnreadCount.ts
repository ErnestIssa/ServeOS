import { useEffect, useState } from "react";
import { fetchNotificationUnreadCount, notificationsWebSocketUrl } from "../comms/commsApi";

export function useNotificationUnreadCount(token: string | null | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const res = await fetchNotificationUnreadCount(token);
      if (!cancelled && res.ok) setCount(res.count ?? 0);
    };
    void load();
    const ws = new WebSocket(notificationsWebSocketUrl(token));
    ws.onmessage = () => {
      void load();
    };
    return () => {
      cancelled = true;
      ws.close();
    };
  }, [token]);

  return count;
}
