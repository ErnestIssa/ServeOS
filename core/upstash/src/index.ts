import { Redis } from "@upstash/redis";

/** Matches websocket / in-process order fan-out payloads. */
export type OrderEventPayload = {
  type: "order_updated";
  orderId: string;
  restaurantId: string;
  status: string;
  totalCents: number;
  restaurantName?: string;
};

function readRestUrl(): string | undefined {
  return (
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim()
  );
}

function readRestToken(): string | undefined {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim()
  );
}

let client: Redis | null | undefined;

/**
 * Upstash Redis via HTTP REST (dashboard: REST URL + REST token).
 * Returns `null` when credentials are unset — API still runs with in-process events only.
 */
export function getUpstashRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = readRestUrl();
  const token = readRestToken();
  if (!url || !token) {
    client = null;
    return null;
  }
  client = new Redis({ url, token });
  return client;
}

export type UpstashRedisHealth = {
  configured: boolean;
  ok: boolean;
  error?: string;
};

/** Ping Upstash when configured; skips when env is missing. */
export async function upstashRedisHealth(): Promise<UpstashRedisHealth> {
  const configured = Boolean(readRestUrl() && readRestToken());
  if (!configured) {
    return { configured: false, ok: true };
  }
  try {
    const r = getUpstashRedis();
    if (!r) {
      return { configured: true, ok: false, error: "client_init_failed" };
    }
    const key = "__serveos:health__";
    await r.set(key, "ok", { ex: 5 });
    const v = await r.get<string>(key);
    if (v !== "ok") {
      return { configured: true, ok: false, error: "readback_mismatch" };
    }
    return { configured: true, ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { configured: true, ok: false, error: msg };
  }
}

/**
 * Publish order updates for cross-instance consumers (workers, future SUBSCRIBE over TCP, etc.).
 * In-process WebSocket clients still use the local EventEmitter; this mirrors those events to Redis.
 */
export async function publishOrderEventToUpstash(
  payload: OrderEventPayload,
  customerUserId: string | null
): Promise<void> {
  const r = getUpstashRedis();
  if (!r) return;

  const body = JSON.stringify(payload);
  const channels: string[] = [
    `serveos:order:${payload.orderId}`,
    `serveos:restaurant:${payload.restaurantId}:orders`
  ];
  if (customerUserId) {
    channels.push(`serveos:customer:${customerUserId}:orders`);
  }

  await Promise.all(channels.map((ch) => r.publish(ch, body)));
}
