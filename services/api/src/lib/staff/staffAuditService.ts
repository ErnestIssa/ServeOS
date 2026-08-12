import type { Prisma, PrismaClient, StaffAuditAction } from "@prisma/client";

export async function logStaffAudit(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    actorUserId: string;
    action: StaffAuditAction;
    targetUserId?: string | null;
    targetMembershipId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
) {
  await prisma.staffAuditLog.create({
    data: {
      restaurantId: params.restaurantId,
      actorUserId: params.actorUserId,
      action: params.action,
      targetUserId: params.targetUserId ?? null,
      targetMembershipId: params.targetMembershipId ?? null,
      metadata: params.metadata ?? undefined
    }
  });
}

export async function listStaffAuditLogs(
  prisma: PrismaClient,
  params: {
    restaurantId: string;
    targetUserId?: string;
    targetMembershipId?: string;
    limit?: number;
  }
) {
  const rows = await prisma.staffAuditLog.findMany({
    where: {
      restaurantId: params.restaurantId,
      ...(params.targetUserId ? { targetUserId: params.targetUserId } : {}),
      ...(params.targetMembershipId ? { targetMembershipId: params.targetMembershipId } : {})
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 40,
    include: {
      actor: {
        select: {
          email: true,
          signupProfile: true,
          accountProfile: { select: { fullName: true } }
        }
      }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    actorName: readActorName(row.actor),
    actorEmail: row.actor.email
  }));
}

function readActorName(actor: {
  email: string | null;
  signupProfile: unknown;
  accountProfile: { fullName: string | null } | null;
}): string | null {
  if (actor.accountProfile?.fullName?.trim()) return actor.accountProfile.fullName.trim();
  if (actor.signupProfile && typeof actor.signupProfile === "object" && !Array.isArray(actor.signupProfile)) {
    const n = (actor.signupProfile as Record<string, unknown>).fullName;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  return actor.email;
}
