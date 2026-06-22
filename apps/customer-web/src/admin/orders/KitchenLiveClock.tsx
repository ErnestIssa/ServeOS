import { useEffect, useState } from "react";

function formatClock(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function KitchenLiveClock() {
  const [time, setTime] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const tick = () => setTime(formatClock(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time className="admin-orders-kds-clock" dateTime={time}>
      {time}
    </time>
  );
}
