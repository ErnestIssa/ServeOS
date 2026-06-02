import type { PrismaClient } from "@prisma/client";
import { countCustomerChatUnread } from "./chatUnread.js";
import { serializeCustomerCart } from "./customerCartService.js";
import {
  readAppSettingsFromProfile,
  readAvatarUriFromProfile,
  readPreferredRestaurantIdFromProfile,
  readQuickPrefsFromProfile,
  type CustomerAppSettings,
  type CustomerQuickPrefs
} from "./customerSignupProfile.js";
import { loadCustomerReservationDraft } from "./customerReservationDraftService.js";
import { upcomingReservationWhere } from "./reservationBooking.js";
import { countActiveCustomerOrders } from "./customerOrdersSummary.js";

export type CustomerAppContext = {
  preferredRestaurantId: string | null;
  avatarUri: string | null;
  quickPrefs: CustomerQuickPrefs;
  appSettings: CustomerAppSettings;
  badges: {
    chatUnread: number;
    upcomingReservations: number;
    activeOrders: number;
    cartTotalQuantity: number;
  };
  cart: Awaited<ReturnType<typeof serializeCustomerCart>> | null;
  reservationFlow: Awaited<ReturnType<typeof loadCustomerReservationDraft>> | null;
};

export async function buildCustomerAppContext(
  prisma: PrismaClient,
  userId: string,
  restaurantId: string | null
): Promise<CustomerAppContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupProfile: true }
  });
  const profile = user?.signupProfile ?? null;

  const rid = restaurantId?.trim() || readPreferredRestaurantIdFromProfile(profile) || null;

  const [chatUnread, upcomingReservations, activeOrders] = await Promise.all([
    countCustomerChatUnread(prisma, userId),
    prisma.customerReservation.count({ where: upcomingReservationWhere(userId) }),
    countActiveCustomerOrders(prisma, userId)
  ]);

  let cart: CustomerAppContext["cart"] = null;
  let cartTotalQuantity = 0;
  if (rid) {
    cart = await serializeCustomerCart(prisma, userId, rid);
    cartTotalQuantity = cart.totalQuantity;
  }

  let reservationFlow: CustomerAppContext["reservationFlow"] = null;
  if (rid) {
    reservationFlow = await loadCustomerReservationDraft(prisma, userId, rid);
  }

  return {
    preferredRestaurantId: readPreferredRestaurantIdFromProfile(profile),
    avatarUri: readAvatarUriFromProfile(profile),
    quickPrefs: readQuickPrefsFromProfile(profile),
    appSettings: readAppSettingsFromProfile(profile),
    badges: {
      chatUnread,
      upcomingReservations,
      activeOrders,
      cartTotalQuantity
    },
    cart,
    reservationFlow
  };
}
