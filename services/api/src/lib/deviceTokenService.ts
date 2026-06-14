import type { PrismaClient } from "@prisma/client";
import { sendPushNotification } from "./integrations/pushProvider.js";

export async function registerUserDeviceToken(
  prisma: PrismaClient,
  params: {
    userId: string;
    token: string;
    platform?: string | null;
    deviceName?: string | null;
  }
) {
  const token = params.token.trim();
  if (token.length < 16) return { ok: false as const, error: "invalid_token" };

  const row = await prisma.userDeviceToken.upsert({
    where: { token },
    create: {
      userId: params.userId,
      token,
      platform: params.platform?.trim() || null,
      deviceName: params.deviceName?.trim() || null,
      lastSeenAt: new Date()
    },
    update: {
      userId: params.userId,
      platform: params.platform?.trim() || null,
      deviceName: params.deviceName?.trim() || null,
      lastSeenAt: new Date(),
      revokedAt: null
    }
  });

  return { ok: true as const, deviceToken: row };
}

export async function revokeUserDeviceToken(prisma: PrismaClient, userId: string, token: string) {
  const row = await prisma.userDeviceToken.findFirst({
    where: { userId, token: token.trim(), revokedAt: null }
  });
  if (!row) return { ok: false as const, error: "not_found" };
  await prisma.userDeviceToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() }
  });
  return { ok: true as const };
}

export async function sendPushToUser(
  prisma: PrismaClient,
  userId: string,
  params: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
): Promise<{ status: "SENT" | "FAILED" | "SKIPPED"; externalId?: string; error?: string }> {
  const tokens = await prisma.userDeviceToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    take: 10
  });
  if (!tokens.length) {
    return { status: "SKIPPED", error: "no_device_tokens" };
  }

  let sent = 0;
  let lastMessageId: string | undefined;
  let lastError: string | undefined;

  for (const row of tokens) {
    const result = await sendPushNotification({
      token: row.token,
      title: params.title,
      body: params.body,
      data: params.data
    });

    if (result.ok) {
      sent += 1;
      lastMessageId = result.messageId;
      await prisma.userDeviceToken.update({
        where: { id: row.id },
        data: { lastSeenAt: new Date() }
      });
      continue;
    }

    lastError = result.error;
    if (result.invalidToken) {
      await prisma.userDeviceToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date() }
      });
    }
  }

  if (sent > 0) {
    return { status: "SENT", externalId: lastMessageId };
  }
  return { status: "FAILED", error: lastError ?? "push_send_failed" };
}
