import type { Prisma, PrismaClient } from "@prisma/client";
import type { TrustActionType, TrustEntityType } from "@prisma/client";

export async function writeTrustAuditLog(
  prisma: PrismaClient,
  params: {
    trustEventId: string;
    workspaceId: string;
    actorId: string;
    actionType: TrustActionType;
    entityType: TrustEntityType;
    entityId: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    ipAddress?: string;
    deviceId?: string;
  }
) {
  await prisma.trustAuditLog.create({
    data: {
      trustEventId: params.trustEventId,
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeState: params.beforeState as Prisma.InputJsonValue | undefined,
      afterState: params.afterState as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress ?? null,
      deviceId: params.deviceId ?? null
    }
  });
}

export async function listTrustAuditForEntity(
  prisma: PrismaClient,
  workspaceId: string,
  entityType: TrustEntityType,
  entityId: string,
  limit = 40
) {
  const rows = await prisma.trustAuditLog.findMany({
    where: { workspaceId, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    actionType: r.actionType,
    beforeState: r.beforeState,
    afterState: r.afterState,
    createdAt: r.createdAt.toISOString()
  }));
}
