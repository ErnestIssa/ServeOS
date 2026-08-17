import { getUpstashRedis } from "@serveos/core-upstash";

const memory = new Map<string, { count: number; resetAt: number }>();

export async function consumeChatRateLimit(input: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const redis = getUpstashRedis();
  if (redis) {
    const rkey = `ratelimit:chat:${input.key}`;
    const count = await redis.incr(rkey);
    if (count === 1) await redis.expire(rkey, input.windowSec);
    if (count > input.limit) return { ok: false, retryAfterSec: input.windowSec };
    return { ok: true };
  }

  const now = Date.now();
  const cur = memory.get(input.key);
  if (!cur || cur.resetAt <= now) {
    memory.set(input.key, { count: 1, resetAt: now + input.windowSec * 1000 });
    return { ok: true };
  }
  cur.count += 1;
  if (cur.count > input.limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

export async function limitChatMessages(actorId: string) {
  return consumeChatRateLimit({ key: `msg:${actorId}`, limit: 20, windowSec: 60 });
}

export async function limitChatTyping(actorId: string) {
  return consumeChatRateLimit({ key: `typing:${actorId}`, limit: 40, windowSec: 60 });
}

export async function limitChatWsConnect(actorId: string) {
  return consumeChatRateLimit({ key: `ws:${actorId}`, limit: 15, windowSec: 60 });
}
