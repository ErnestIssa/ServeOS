import type { ChatRoomType, Prisma, PrismaClient, Role } from "@prisma/client";
import type { MobileAuthContext } from "../auth/mobileAuthContext.js";

const STAFF_CHANNEL_ROLES: Record<string, ReadonlyArray<string>> = {
  kitchen: ["OWNER", "MANAGER", "KITCHEN"],
  foh: ["OWNER", "MANAGER", "STAFF", "CASHIER"],
  managers: ["OWNER", "MANAGER"],
  all: ["OWNER", "MANAGER", "STAFF", "KITCHEN", "CASHIER"]
};

const CUSTOMER_FACING: ReadonlySet<ChatRoomType> = new Set(["ORDER", "RESERVATION", "VENUE", "TABLE"]);

export function staffRoleForVenue(ctx: MobileAuthContext, restaurantId: string): string | null {
  const m = ctx.memberships.find((row) => row.restaurantId === restaurantId && row.status === "ACTIVE");
  return m?.role ?? null;
}

export function canAccessStaffChannel(role: string, channelKey: string | null | undefined): boolean {
  if (!channelKey) return role === "OWNER" || role === "MANAGER";
  const allowed = STAFF_CHANNEL_ROLES[channelKey] ?? ["OWNER", "MANAGER"];
  return allowed.includes(role);
}

export function allowedStaffChannelKeys(role: string): string[] {
  return Object.entries(STAFF_CHANNEL_ROLES)
    .filter(([, roles]) => roles.includes(role))
    .map(([key]) => key);
}

export function canAccessCommsRoom(
  role: string,
  room: { type: ChatRoomType; channelKey: string | null; restaurantId: string }
): boolean {
  if (role === "OWNER" || role === "MANAGER") return true;
  if (CUSTOMER_FACING.has(room.type)) {
    return role === "STAFF" || role === "KITCHEN" || role === "CASHIER";
  }
  if (room.type === "STAFF") return canAccessStaffChannel(role, room.channelKey);
  return false;
}

export function assertCanAccessCommsRoom(
  role: string | null,
  room: { type: ChatRoomType; channelKey: string | null; restaurantId: string }
) {
  if (!role || !canAccessCommsRoom(role, room)) {
    throw Object.assign(new Error("forbidden_room"), { statusCode: 403 });
  }
}

export async function customerRoomAccessOr(
  prisma: PrismaClient,
  input: { customerUserId?: string | null; sourceSessionId?: string | null }
): Promise<Prisma.ChatRoomWhereInput[]> {
  const clauses: Prisma.ChatRoomWhereInput[] = [];
  if (input.customerUserId) {
    clauses.push(
      { customerUserId: input.customerUserId },
      { order: { customerUserId: input.customerUserId } },
      { reservation: { userId: input.customerUserId } }
    );
  }
  if (input.sourceSessionId) {
    clauses.push(
      { sourceSessionId: input.sourceSessionId },
      { order: { sourceSessionId: input.sourceSessionId } }
    );
  }
  return clauses;
}

export async function assertCustomerOwnsRoom(
  prisma: PrismaClient,
  chatRoomId: string,
  input: { customerUserId?: string | null; sourceSessionId?: string | null }
) {
  const or = await customerRoomAccessOr(prisma, input);
  if (!or.length) {
    throw Object.assign(new Error("room_not_found"), { statusCode: 404 });
  }
  const room = await prisma.chatRoom.findFirst({
    where: { id: chatRoomId, OR: or },
    select: { id: true, type: true, restaurantId: true, lifecycle: true }
  });
  if (!room) throw Object.assign(new Error("room_not_found"), { statusCode: 404 });
  if (room.type === "STAFF" || room.type === "SUPPORT") {
    throw Object.assign(new Error("forbidden_room"), { statusCode: 403 });
  }
  return room;
}

export function isCustomerFacingRoomType(type: ChatRoomType): boolean {
  return CUSTOMER_FACING.has(type);
}

export type VenueStaffRole = Extract<Role, "OWNER" | "MANAGER" | "STAFF" | "KITCHEN" | "CASHIER">;
