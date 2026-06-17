import { getUpstashRedis } from "@serveos/core-upstash";

const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_LOCKOUT_SEC = 15 * 60;
const DEFAULT_IP_LIMIT_PER_MIN = 30;

export type LoginProtectionContext = {
  ip?: string | null;
  accountKey?: string | null;
};

function maxFailures(): number {
  return Number(process.env.AUTH_LOGIN_MAX_FAILURES ?? DEFAULT_MAX_FAILURES);
}

function lockoutSec(): number {
  return Number(process.env.AUTH_LOGIN_LOCKOUT_SEC ?? DEFAULT_LOCKOUT_SEC);
}

function ipLimitPerMin(): number {
  return Number(process.env.AUTH_LOGIN_IP_LIMIT_PER_MIN ?? DEFAULT_IP_LIMIT_PER_MIN);
}

function accountKey(userId: string): string {
  return `login:fail:account:${userId}`;
}

function lockKey(userId: string): string {
  return `login:lock:${userId}`;
}

function ipKey(ip: string): string {
  return `login:ip:${ip}`;
}

export async function assertLoginNotRateLimited(
  ctx: LoginProtectionContext
): Promise<{ ok: true } | { ok: false; error: string; retryAfterSec?: number }> {
  const r = getUpstashRedis();
  if (!r) return { ok: true };

  if (ctx.ip?.trim()) {
    const key = ipKey(ctx.ip.trim());
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, 60);
    if (count > ipLimitPerMin()) {
      return { ok: false, error: "too_many_attempts", retryAfterSec: 60 };
    }
  }

  if (ctx.accountKey?.trim()) {
    const locked = await r.get<string>(lockKey(ctx.accountKey.trim()));
    if (locked) {
      const ttl = await r.ttl(lockKey(ctx.accountKey.trim()));
      return {
        ok: false,
        error: "account_temporarily_locked",
        retryAfterSec: ttl > 0 ? ttl : lockoutSec()
      };
    }
  }

  return { ok: true };
}

export async function recordLoginFailure(ctx: LoginProtectionContext): Promise<void> {
  const r = getUpstashRedis();
  if (!r || !ctx.accountKey?.trim()) return;

  const key = accountKey(ctx.accountKey.trim());
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, lockoutSec());

  if (count >= maxFailures()) {
    await r.set(lockKey(ctx.accountKey.trim()), "1", { ex: lockoutSec() });
    await r.del(key);
  }
}

export async function clearLoginFailures(accountId: string): Promise<void> {
  const r = getUpstashRedis();
  if (!r) return;
  await r.del(accountKey(accountId));
  await r.del(lockKey(accountId));
}
