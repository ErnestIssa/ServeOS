import { randomInt } from "node:crypto";
import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import { getUpstashRedis } from "@serveos/core-upstash";
import {
  isSmsProviderConfigured,
  normalizeSmsPhone,
  sendSms
} from "../integrations/smsProvider.js";

const TTL_SEC = 600;
const redisKey = (userId: string) => `serveos:2fa:sms:${userId}`;

/** Optional SMS fallback when authenticator app is unavailable (requires Redis). */
export async function requestTwoFactorSmsCode(
  prisma: PrismaClient,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSmsProviderConfigured()) {
    return { ok: false, error: "sms_not_configured" };
  }

  const row = await prisma.userTwoFactorAuth.findUnique({ where: { userId } });
  if (!row?.enabled) return { ok: false, error: "2fa_not_enabled" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true }
  });
  if (!user?.phone?.trim()) return { ok: false, error: "no_phone" };

  const phone = normalizeSmsPhone(user.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };

  const redis = getUpstashRedis();
  if (!redis) return { ok: false, error: "sms_fallback_unavailable" };

  const code = String(randomInt(100_000, 999_999));
  const hash = await bcrypt.hash(code, 8);
  await redis.set(redisKey(userId), hash, { ex: TTL_SEC });

  const sms = await sendSms({
    to: phone,
    body: `ServeOS sign-in code: ${code}. Expires in 10 minutes.`
  });

  if (!sms.ok) {
    await redis.del(redisKey(userId)).catch(() => undefined);
    return { ok: false, error: sms.error ?? "sms_send_failed" };
  }

  return { ok: true };
}

export async function verifyTwoFactorSmsCode(userId: string, code: string): Promise<boolean> {
  const redis = getUpstashRedis();
  if (!redis) return false;

  const hash = await redis.get<string>(redisKey(userId));
  if (!hash || typeof hash !== "string") return false;

  const normalized = code.replace(/\s/g, "");
  const ok = await bcrypt.compare(normalized, hash);
  if (ok) await redis.del(redisKey(userId));
  return ok;
}
