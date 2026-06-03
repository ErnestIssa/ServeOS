import type { EventEmitter } from "node:events";
import { publishDomainEvent } from "../eventBus.js";
import { createDomainEvent } from "../notificationProcessor.js";

export async function notifyStaffInvited(
  bus: EventEmitter,
  input: {
    restaurantId: string;
    restaurantName: string;
    invitationId: string;
    fullName: string;
    email: string;
    phone?: string | null;
    intendedRole: string;
    acceptUrl: string;
    invitedByUserId: string;
  }
): Promise<void> {
  await publishDomainEvent(
    bus,
    createDomainEvent(
      "staff.invited",
      {
        invitationId: input.invitationId,
        restaurantName: input.restaurantName,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        intendedRole: input.intendedRole,
        acceptUrl: input.acceptUrl
      },
      { restaurantId: input.restaurantId, actorUserId: input.invitedByUserId }
    )
  );
}

export async function notifyStaffPendingApproval(
  bus: EventEmitter,
  input: {
    restaurantId: string;
    restaurantName: string;
    membershipId: string;
    userId: string;
    fullName?: string | null;
    role: string;
  }
): Promise<void> {
  await publishDomainEvent(
    bus,
    createDomainEvent(
      "staff.pending_approval",
      {
        membershipId: input.membershipId,
        userId: input.userId,
        fullName: input.fullName,
        role: input.role,
        restaurantName: input.restaurantName
      },
      { restaurantId: input.restaurantId, actorUserId: input.userId }
    )
  );
}

export async function notifyStaffApproved(
  bus: EventEmitter,
  input: {
    restaurantId: string;
    restaurantName: string;
    userId: string;
    approvedByUserId: string;
  }
): Promise<void> {
  await publishDomainEvent(
    bus,
    createDomainEvent(
      "staff.approved",
      {
        userId: input.userId,
        restaurantName: input.restaurantName
      },
      { restaurantId: input.restaurantId, actorUserId: input.approvedByUserId }
    )
  );
}

export async function notifyStaffRejected(
  bus: EventEmitter,
  input: {
    restaurantId: string;
    restaurantName: string;
    userId: string;
  }
): Promise<void> {
  await publishDomainEvent(
    bus,
    createDomainEvent(
      "staff.rejected",
      { userId: input.userId, restaurantName: input.restaurantName },
      { restaurantId: input.restaurantId }
    )
  );
}
