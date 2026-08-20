import type { PlatformSupportSession, PrismaClient } from "@prisma/client";

export type PlatformSupportOpenSource = "FAB" | "PLATFORM_HELP";

export type PlatformSupportPolicy = {
  fabAutoHideMs: number;
  modalIdleCloseMs: number;
};

export type PlatformSupportState = {
  fabVisible: boolean;
  modalOpen: boolean;
  hasActiveThread: boolean;
  fabPinned: boolean;
  policy: PlatformSupportPolicy;
};

function readPolicy(): PlatformSupportPolicy {
  const fabAutoHideMs = Number(process.env.PLATFORM_SUPPORT_FAB_AUTO_HIDE_MS ?? 60_000);
  const modalIdleCloseMs = Number(process.env.PLATFORM_SUPPORT_MODAL_IDLE_CLOSE_MS ?? 300_000);
  return {
    fabAutoHideMs: Number.isFinite(fabAutoHideMs) ? fabAutoHideMs : 60_000,
    modalIdleCloseMs: Number.isFinite(modalIdleCloseMs) ? modalIdleCloseMs : 300_000
  };
}

function deriveFabVisible(
  session: Pick<PlatformSupportSession, "fabPinned" | "modalOpen" | "lastPlatformActivityAt">,
  policy: PlatformSupportPolicy,
  now = Date.now()
) {
  if (session.fabPinned || session.modalOpen) return true;
  return now - session.lastPlatformActivityAt.getTime() <= policy.fabAutoHideMs;
}

function applyIdleRules(
  session: PlatformSupportSession,
  policy: PlatformSupportPolicy,
  now = Date.now()
): Partial<PlatformSupportSession> | null {
  const patch: Partial<PlatformSupportSession> = {};
  let changed = false;

  if (session.modalOpen && !session.hasActiveThread) {
    const idleMs = now - session.lastSupportActivityAt.getTime();
    if (idleMs > policy.modalIdleCloseMs) {
      patch.modalOpen = false;
      patch.openedVia = null;
      changed = true;
    }
  }

  if (!changed) return null;
  return patch;
}

async function loadOrCreateSession(prisma: PrismaClient, userId: string) {
  return prisma.platformSupportSession.upsert({
    where: { userId },
    create: { userId },
    update: {}
  });
}

export async function getPlatformSupportState(
  prisma: PrismaClient,
  userId: string
): Promise<PlatformSupportState> {
  const policy = readPolicy();
  let session = await loadOrCreateSession(prisma, userId);
  const idlePatch = applyIdleRules(session, policy);
  if (idlePatch) {
    session = await prisma.platformSupportSession.update({
      where: { userId },
      data: idlePatch
    });
  }

  return {
    fabVisible: deriveFabVisible(session, policy),
    modalOpen: session.modalOpen,
    hasActiveThread: session.hasActiveThread,
    fabPinned: session.fabPinned,
    policy
  };
}

export async function recordPlatformSupportActivity(prisma: PrismaClient, userId: string) {
  const now = new Date();
  await prisma.platformSupportSession.upsert({
    where: { userId },
    create: { userId, lastPlatformActivityAt: now },
    update: { lastPlatformActivityAt: now }
  });
  return getPlatformSupportState(prisma, userId);
}

export async function openPlatformSupport(
  prisma: PrismaClient,
  userId: string,
  source: PlatformSupportOpenSource
) {
  const now = new Date();
  await prisma.platformSupportSession.upsert({
    where: { userId },
    create: {
      userId,
      modalOpen: true,
      openedVia: source,
      fabPinned: source === "FAB",
      lastSupportActivityAt: now,
      lastPlatformActivityAt: now
    },
    update: {
      modalOpen: true,
      openedVia: source,
      ...(source === "FAB" ? { fabPinned: true } : {}),
      lastSupportActivityAt: now,
      lastPlatformActivityAt: now
    }
  });
  return getPlatformSupportState(prisma, userId);
}

export async function pinPlatformSupportFab(prisma: PrismaClient, userId: string) {
  const now = new Date();
  await prisma.platformSupportSession.upsert({
    where: { userId },
    create: {
      userId,
      fabPinned: true,
      lastPlatformActivityAt: now,
      lastSupportActivityAt: now
    },
    update: {
      fabPinned: true,
      lastPlatformActivityAt: now
    }
  });
  return getPlatformSupportState(prisma, userId);
}

export async function recordPlatformSupportInteraction(
  prisma: PrismaClient,
  userId: string,
  input: { hasActiveThread: boolean }
) {
  const now = new Date();
  await prisma.platformSupportSession.upsert({
    where: { userId },
    create: {
      userId,
      hasActiveThread: input.hasActiveThread,
      lastSupportActivityAt: now,
      lastPlatformActivityAt: now
    },
    update: {
      hasActiveThread: input.hasActiveThread,
      lastSupportActivityAt: now
    }
  });
  return getPlatformSupportState(prisma, userId);
}

export async function closePlatformSupport(prisma: PrismaClient, userId: string) {
  await prisma.platformSupportSession.upsert({
    where: { userId },
    create: { userId },
    update: {
      modalOpen: false,
      openedVia: null,
      hasActiveThread: false
    }
  });
  return getPlatformSupportState(prisma, userId);
}
