import type { PrismaClient } from "@prisma/client";

export type PersistedReservationFlowPayload = {
  draft: Record<string, unknown>;
  screen: string;
  scrollByScreen?: Record<string, number>;
  confirmedReservationId?: string | null;
  updatedAt: string;
};

export async function loadCustomerReservationDraft(
  prisma: PrismaClient,
  userId: string,
  restaurantId: string
): Promise<PersistedReservationFlowPayload | null> {
  const row = await prisma.customerReservationDraft.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } }
  });
  if (!row) return null;

  const scrollRaw =
    row.draft && typeof row.draft === "object" && !Array.isArray(row.draft)
      ? (row.draft as Record<string, unknown>)._scrollByScreen
      : undefined;

  const draft =
    row.draft && typeof row.draft === "object" && !Array.isArray(row.draft)
      ? { ...(row.draft as Record<string, unknown>) }
      : {};
  delete draft._scrollByScreen;

  let confirmedReservationId: string | null = null;
  if (row.screenId === "confirmation" && row.confirmationCode) {
    const confirmed = await prisma.customerReservation.findFirst({
      where: {
        userId,
        restaurantId,
        confirmationCode: row.confirmationCode,
        status: "CONFIRMED"
      },
      select: { id: true }
    });
    confirmedReservationId = confirmed?.id ?? null;
  }

  return {
    draft,
    screen: row.screenId,
    scrollByScreen:
      scrollRaw && typeof scrollRaw === "object" && !Array.isArray(scrollRaw)
        ? (scrollRaw as Record<string, number>)
        : undefined,
    confirmedReservationId,
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function saveCustomerReservationDraft(
  prisma: PrismaClient,
  userId: string,
  restaurantId: string,
  payload: {
    draft: Record<string, unknown>;
    screen: string;
    scrollByScreen?: Record<string, number>;
    confirmedReservationId?: string | null;
  }
): Promise<PersistedReservationFlowPayload> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true }
  });
  if (!restaurant) throw Object.assign(new Error("restaurant_not_found"), { statusCode: 404 });

  let confirmationCode: string | null = null;
  if (payload.screen === "confirmation" && payload.confirmedReservationId?.trim()) {
    const res = await prisma.customerReservation.findFirst({
      where: {
        id: payload.confirmedReservationId.trim(),
        userId,
        restaurantId,
        status: "CONFIRMED"
      },
      select: { confirmationCode: true }
    });
    confirmationCode = res?.confirmationCode ?? null;
  }

  const draftToStore = {
    ...payload.draft,
    ...(payload.scrollByScreen ? { _scrollByScreen: payload.scrollByScreen } : {})
  };

  const row = await prisma.customerReservationDraft.upsert({
    where: { userId_restaurantId: { userId, restaurantId } },
    create: {
      userId,
      restaurantId,
      screenId: payload.screen,
      draft: draftToStore,
      confirmationCode
    },
    update: {
      screenId: payload.screen,
      draft: draftToStore,
      confirmationCode
    }
  });

  const scrollRaw =
    row.draft && typeof row.draft === "object" && !Array.isArray(row.draft)
      ? (row.draft as Record<string, unknown>)._scrollByScreen
      : undefined;
  const draft = { ...(row.draft as Record<string, unknown>) };
  delete draft._scrollByScreen;

  return {
    draft,
    screen: row.screenId,
    scrollByScreen:
      scrollRaw && typeof scrollRaw === "object" && !Array.isArray(scrollRaw)
        ? (scrollRaw as Record<string, number>)
        : undefined,
    confirmedReservationId: payload.confirmedReservationId ?? null,
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function clearCustomerReservationDraft(
  prisma: PrismaClient,
  userId: string,
  restaurantId: string
): Promise<void> {
  await prisma.customerReservationDraft.deleteMany({
    where: { userId, restaurantId }
  });
}
