import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function maskIp(ip: string | undefined | null): string | null {
  if (!ip?.trim()) return null;
  const v = ip.trim();
  if (v.includes(".")) {
    const parts = v.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  if (v.includes(":")) {
    const parts = v.split(":");
    return `${parts.slice(0, 3).join(":")}:xxxx`;
  }
  return v.slice(0, Math.min(8, v.length)) + "…";
}

export function requestIp(req: { headers: Record<string, unknown>; ip?: string }): string | undefined {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0]?.trim();
  }
  if (typeof req.ip === "string" && req.ip) return req.ip;
  return undefined;
}

export function parseUserAgent(ua?: string | null): { deviceName: string; browser: string } {
  if (!ua) return { deviceName: "Unknown device", browser: "Unknown browser" };
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  let deviceName = "Computer";
  if (/iPhone/i.test(ua)) deviceName = "iPhone";
  else if (/iPad/i.test(ua)) deviceName = "iPad";
  else if (/Android/i.test(ua)) deviceName = "Android device";
  else if (/Windows/i.test(ua)) deviceName = "Windows";
  else if (/Macintosh|Mac OS/i.test(ua)) deviceName = "Mac";

  return { deviceName, browser };
}

export async function upsertUserSession(
  prisma: PrismaClient,
  params: {
    userId: string;
    token: string;
    userAgent?: string;
    ip?: string;
  }
) {
  const fp = tokenFingerprint(params.token);
  const { deviceName, browser } = parseUserAgent(params.userAgent);
  const ipMasked = maskIp(params.ip);

  await prisma.userSession.upsert({
    where: { tokenFingerprint: fp },
    create: {
      userId: params.userId,
      tokenFingerprint: fp,
      deviceName,
      browser,
      ipMasked,
      location: null,
      userAgent: params.userAgent?.slice(0, 512) ?? null,
      lastActiveAt: new Date()
    },
    update: {
      lastActiveAt: new Date(),
      deviceName,
      browser,
      ipMasked,
      userAgent: params.userAgent?.slice(0, 512) ?? null,
      revokedAt: null
    }
  });
}

export async function touchUserSession(prisma: PrismaClient, token: string) {
  const fp = tokenFingerprint(token);
  await prisma.userSession
    .update({
      where: { tokenFingerprint: fp },
      data: { lastActiveAt: new Date() }
    })
    .catch(() => undefined);
}

export async function isSessionRevoked(prisma: PrismaClient, token: string): Promise<boolean> {
  const fp = tokenFingerprint(token);
  const row = await prisma.userSession.findUnique({
    where: { tokenFingerprint: fp },
    select: { revokedAt: true }
  });
  return Boolean(row?.revokedAt);
}

export async function listUserSessions(prisma: PrismaClient, userId: string, currentToken: string) {
  const currentFp = tokenFingerprint(currentToken);
  const rows = await prisma.userSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastActiveAt: "desc" }
  });
  return rows.map((s) => ({
    id: s.id,
    deviceName: s.deviceName ?? "Unknown device",
    browser: s.browser ?? "Unknown browser",
    ipMasked: s.ipMasked,
    location: s.location,
    lastActiveAt: s.lastActiveAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    isCurrent: s.tokenFingerprint === currentFp
  }));
}

export async function revokeUserSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  currentToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const currentFp = tokenFingerprint(currentToken);
  const row = await prisma.userSession.findFirst({
    where: { id: sessionId, userId, revokedAt: null }
  });
  if (!row) return { ok: false, error: "session_not_found" };
  if (row.tokenFingerprint === currentFp) return { ok: false, error: "cannot_revoke_current_session" };
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() }
  });
  return { ok: true };
}

export async function revokeOtherSessions(prisma: PrismaClient, userId: string, currentToken: string) {
  const currentFp = tokenFingerprint(currentToken);
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      NOT: { tokenFingerprint: currentFp }
    },
    data: { revokedAt: new Date() }
  });
  return result.count;
}

export async function revokeAllSessions(prisma: PrismaClient, userId: string) {
  const result = await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  return result.count;
}

export async function revokeSessionByToken(prisma: PrismaClient, token: string) {
  const fp = tokenFingerprint(token);
  const result = await prisma.userSession.updateMany({
    where: { tokenFingerprint: fp, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  return result.count;
}
