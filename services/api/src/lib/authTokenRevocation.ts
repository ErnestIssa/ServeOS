import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { getUpstashRedis } from "@serveos/core-upstash";

const REVOKED_MEMORY = new Set<string>();

function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function revokeKey(fp: string): string {
  return `auth:revoked:${fp}`;
}

function remainingTtlSec(token: string, secret: string): number {
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    if (decoded.exp) {
      return Math.max(60, decoded.exp - Math.floor(Date.now() / 1000));
    }
  } catch {
    /* use default below */
  }
  return 7 * 24 * 60 * 60;
}

export async function revokeAuthToken(token: string, secret: string): Promise<void> {
  jwt.verify(token, secret);
  const fp = tokenFingerprint(token);
  REVOKED_MEMORY.add(fp);

  const redis = getUpstashRedis();
  if (!redis) return;

  const ttl = remainingTtlSec(token, secret);
  await redis.set(revokeKey(fp), "1", { ex: ttl });
}

export async function isAuthTokenRevoked(token: string): Promise<boolean> {
  const fp = tokenFingerprint(token);
  if (REVOKED_MEMORY.has(fp)) return true;

  const redis = getUpstashRedis();
  if (!redis) return false;

  const v = await redis.get<string>(revokeKey(fp));
  if (v === "1") {
    REVOKED_MEMORY.add(fp);
    return true;
  }
  return false;
}
